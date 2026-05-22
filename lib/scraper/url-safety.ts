import { lookup } from "dns/promises";
import { isIP } from "net";

const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "169.254.169.254",
];

const MAX_REDIRECTS = 5;

export function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isPrivateIp(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const ipVersion = isIP(normalized);

  if (ipVersion === 4) {
    const parts = normalized.split(".").map(Number);
    const [a, b] = parts;

    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }

  if (ipVersion === 6) {
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb") ||
      normalized.startsWith("ff")
    );
  }

  return false;
}

export function isPrivateOrLocalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    if (BLOCKED_HOSTS.includes(hostname)) return true;
    if (hostname.endsWith(".local")) return true;
    if (hostname.endsWith(".internal")) return true;
    if (isPrivateIp(hostname)) return true;

    return false;
  } catch {
    return true; // If we can't parse, block it
  }
}

export function normalizeUrl(url: string): string {
  let normalized = url.trim();
  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    normalized = "https://" + normalized;
  }
  // Remove trailing slash for consistency
  return normalized.replace(/\/+$/, "");
}

export async function assertPublicHttpUrl(url: string): Promise<void> {
  if (!isValidHttpUrl(url)) {
    throw new Error("Invalid URL. Only http and https URLs are allowed.");
  }

  if (isPrivateOrLocalUrl(url)) {
    throw new Error("Cannot scrape private or local URLs.");
  }

  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  if (isIP(hostname)) return;

  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new Error("Could not resolve the website hostname.");
  }

  if (addresses.length === 0) {
    throw new Error("Could not resolve the website hostname.");
  }

  if (addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new Error("Cannot scrape URLs that resolve to private or local networks.");
  }
}

export function resolveRedirectUrl(currentUrl: string, location: string | null): string {
  if (!location) {
    throw new Error("Redirect response did not include a Location header.");
  }

  return new URL(location, currentUrl).toString();
}

export function hasRedirectsRemaining(count: number): boolean {
  return count < MAX_REDIRECTS;
}
