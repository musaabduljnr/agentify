import { assertPublicHttpUrl } from "./url-safety";

export async function fetchRobotsRules(baseUrl: string): Promise<string[]> {
  try {
    const rootUrl = new URL("/", baseUrl).toString().replace(/\/+$/, "");
    const robotsUrl = `${rootUrl}/robots.txt`;

    await assertPublicHttpUrl(robotsUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(robotsUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "AgentifyBot/1.0",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) return [];

    const text = await response.text();
    return parseRobotsTxt(text);
  } catch {
    return [];
  }
}

function parseRobotsTxt(content: string): string[] {
  const disallowedPaths: string[] = [];
  const lines = content.split("\n");
  let isTargetUserAgent = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const parts = line.split(":");
    if (parts.length < 2) continue;

    const key = parts[0].trim().toLowerCase();
    const val = parts.slice(1).join(":").trim();

    if (key === "user-agent") {
      const ua = val.toLowerCase();
      isTargetUserAgent = ua === "*" || ua === "agentifybot";
    } else if (key === "disallow" && isTargetUserAgent) {
      if (val) {
        disallowedPaths.push(val);
      }
    }
  }

  return disallowedPaths;
}

export function isUrlAllowedByRobots(urlStr: string, disallowedPaths: string[]): boolean {
  if (disallowedPaths.length === 0) return true;

  try {
    const parsed = new URL(urlStr);
    const path = parsed.pathname + parsed.search;

    for (const rule of disallowedPaths) {
      // Simplify wildcard rules to matching prefixes
      const normalizedRule = rule.replace(/\*$/, "");
      if (normalizedRule === "/") {
        return false;
      }
      if (path.startsWith(normalizedRule)) {
        return false;
      }
    }
  } catch {
    return false;
  }

  return true;
}
