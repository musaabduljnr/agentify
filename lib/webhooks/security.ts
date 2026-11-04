import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { createHmac, timingSafeEqual } from "node:crypto";
import { request as httpsRequest, Agent } from "node:https";
import type { LookupFunction } from "node:net";

type ResolvedAddress = { address: string; family: number };
type ValidatedDestination = { url: URL; addresses: ResolvedAddress[] };

function isPublicIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = octets;
  return !(
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99))) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113) ||
    a === 255
  );
}

function ipv6Words(address: string): number[] | null {
  let normalized = address.toLowerCase();
  if (normalized.includes(".")) {
    const lastColon = normalized.lastIndexOf(":");
    const ipv4 = normalized.slice(lastColon + 1);
    if (!isPublicIpv4(ipv4)) return null;
    const [a, b, c, d] = ipv4.split(".").map(Number);
    normalized = `${normalized.slice(0, lastColon)}:${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = normalized.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if ([...left, ...right].some((word) => !/^[0-9a-f]{1,4}$/.test(word))) return null;
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  return [...left.map((word) => parseInt(word, 16)), ...Array(missing).fill(0), ...right.map((word) => parseInt(word, 16))];
}

function isPublicIpv6(address: string): boolean {
  const words = ipv6Words(address);
  if (!words) return false;
  const value = words.reduce((result, word) => (result << BigInt(16)) | BigInt(word), BigInt(0));
  const globalUnicast = (value >> BigInt(125)) === BigInt(1); // 2000::/3
  const documentation = words[0] === 0x2001 && words[1] === 0x0db8;
  const specialUse = words[0] === 0x2001 && words[1] <= 0x01ff;
  const sixToFour = words[0] === 0x2002;
  return globalUnicast && !documentation && !specialUse && !sixToFour;
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

async function resolveWithTimeout(
  hostname: string,
  resolver: (hostname: string) => Promise<ResolvedAddress[]>,
): Promise<ResolvedAddress[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      resolver(hostname),
      new Promise<ResolvedAddress[]>((_, reject) => {
        timer = setTimeout(() => reject(new Error("DNS lookup timed out")), 3_000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function validateWebhookUrl(
  input: string,
  resolver: (hostname: string) => Promise<ResolvedAddress[]> = async (hostname) =>
    lookup(hostname, { all: true, verbatim: true }),
): Promise<ValidatedDestination> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Enter a valid public HTTPS endpoint URL.");
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    (url.port && url.port !== "443") ||
    !url.hostname
  ) {
    throw new Error("Use a public HTTPS URL on port 443 without credentials, query strings, or fragments.");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await resolveWithTimeout(hostname, resolver).catch(() => []);
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error("Endpoint host must resolve only to public IP addresses.");
  }
  return { url, addresses };
}

export function createWebhookSignature(secret: string, body: string): string {
  return `v1=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

export function verifyCronSecret(configured: string | undefined, provided: string | null): boolean {
  if (!configured || !provided) return false;
  const expected = Buffer.from(configured);
  const actual = Buffer.from(provided);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function postWebhook(
  rawUrl: string,
  secret: string,
  eventId: string,
  eventType: string,
  payload: unknown,
  timeoutMs = 5_000,
  onHttpStart?: () => Promise<void>,
): Promise<{ statusCode: number; responseBody: string; durationMs: number }> {
  const body = JSON.stringify(payload);
  const startedAt = Date.now();
  let activeRequest: ReturnType<typeof httpsRequest> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const agent = new Agent({ keepAlive: false });

  try {
    const operation = (async () => {
      const { url, addresses } = await validateWebhookUrl(rawUrl);
      if (Date.now() - startedAt >= timeoutMs) throw new Error("Request timed out");
      const destination = addresses[0];
      await onHttpStart?.();
      if (Date.now() - startedAt >= timeoutMs) throw new Error("Request timed out");
      return await new Promise<{ statusCode: number; responseBody: string; durationMs: number }>((resolve, reject) => {
        const request = httpsRequest(
          url,
          {
            method: "POST",
            agent,
            timeout: timeoutMs,
            lookup: ((hostname, _options, callback) => {
              const expected = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
              if (hostname.toLowerCase() !== expected) {
                callback(new Error("Unexpected destination host"), "", 4);
                return;
              }
              callback(null, destination.address, destination.family);
            }) as LookupFunction,
            headers: {
              "content-type": "application/json",
              "content-length": Buffer.byteLength(body),
              "user-agent": "Agentify-Webhooks/1.0",
              "x-agentify-event-id": eventId,
              "x-agentify-event": eventType,
              "x-agentify-signature": createWebhookSignature(secret, body),
              "x-agentify-timestamp": new Date().toISOString(),
            },
          },
          (response) => {
            let responseBody = "";
            let responseTruncated = false;
            response.setEncoding("utf8");
            response.on("data", (chunk: string) => {
              if (responseBody.length < 2_048) responseBody += chunk.slice(0, 2_048 - responseBody.length);
              if (responseBody.length >= 2_048 && chunk.length > 0) responseTruncated = true;
            });
            response.on("end", () => {
              const statusCode = response.statusCode ?? 0;
              resolve({
                statusCode,
                responseBody: responseTruncated ? "[Response body omitted because it exceeded the 2 KB preview limit.]" : responseBody,
                durationMs: Date.now() - startedAt,
              });
            });
          },
        );
        activeRequest = request;
        request.on("timeout", () => request.destroy(new Error("Request timed out")));
        request.on("error", reject);
        request.end(body);
      });
    })();
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error("Request timed out");
        activeRequest?.destroy(error);
        reject(error);
      }, timeoutMs);
    });
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
    agent.destroy();
  }
}

export function redactWebhookResponse(value: string | null): string | null {
  if (!value) return value;
  try {
    const parsed: unknown = JSON.parse(value);
    return JSON.stringify(redactWebhookValue(parsed)).slice(0, 2_048);
  } catch {
    return "[Non-JSON response body omitted for privacy.]";
  }
}

const SECRET_KEYS = /email|phone|name|address|secret|token|password|authorization|cookie/i;

export function redactWebhookValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactWebhookValue);
  if (typeof value === "string") {
    return value
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[REDACTED_EMAIL]")
      .replace(/\+?\d[\d\s().-]{7,}\d/g, "[REDACTED_PHONE]")
      .replace(/(authorization|cookie|secret|token|password)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]");
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key,
      SECRET_KEYS.test(key) ? "[REDACTED]" : redactWebhookValue(child),
    ]),
  );
}

export function redactWebhookText(value: string | null): string | null {
  if (!value) return value;
  const truncated = value.slice(0, 2_048);
  try {
    return JSON.stringify(redactWebhookValue(JSON.parse(truncated)));
  } catch {
    return truncated
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[REDACTED_EMAIL]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[REDACTED_PHONE]")
    .replace(/(authorization|cookie|secret|token|password)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]");
  }
}
