import * as cheerio from "cheerio";
import { assertPublicHttpUrl, normalizeUrl } from "./url-safety";

const SKIPPED_PATH_EXTENSIONS =
  /\.(?:7z|avi|css|csv|doc|docx|eot|gif|gz|ico|jpeg|jpg|js|json|map|mov|mp3|mp4|mpeg|otf|pdf|png|ppt|pptx|rar|rss|svg|tar|ttf|txt|wav|webm|webp|woff|woff2|xls|xlsx|zip)$/i;

async function fetchSitemapContent(url: string): Promise<string | null> {
  try {
    await assertPublicHttpUrl(url);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "AgentifyBot/1.0",
        Accept: "application/xml,text/xml,*/*",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export async function getSitemapUrls(baseUrl: string, maxUrls = 50): Promise<string[]> {
  const rootUrl = new URL("/", baseUrl).toString().replace(/\/+$/, "");
  const sitemaps = [`${rootUrl}/sitemap.xml`, `${rootUrl}/sitemap_index.xml`];
  const discovered = new Set<string>();

  let baseHostname = "";
  try {
    baseHostname = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return [];
  }

  for (const sitemapUrl of sitemaps) {
    const xml = await fetchSitemapContent(sitemapUrl);
    if (!xml) continue;

    try {
      const $ = cheerio.load(xml, { xmlMode: true });
      
      $("loc").each((_, el) => {
        const urlText = $(el).text().trim();
        if (!urlText) return;

        try {
          const absoluteUrl = new URL(urlText);
          if (absoluteUrl.protocol !== "http:" && absoluteUrl.protocol !== "https:") return;

          // Keep same origin/hostname
          if (absoluteUrl.hostname.toLowerCase() !== baseHostname) return;

          // Ignore static files
          if (SKIPPED_PATH_EXTENSIONS.test(absoluteUrl.pathname)) return;

          // Remove hash/credentials
          absoluteUrl.hash = "";
          absoluteUrl.username = "";
          absoluteUrl.password = "";

          // Normalize trailing slash
          if (absoluteUrl.pathname !== "/") {
            absoluteUrl.pathname = absoluteUrl.pathname.replace(/\/+$/, "");
          }

          discovered.add(normalizeUrl(absoluteUrl.toString()));
        } catch {
          // Ignore invalid URL
        }
      });
    } catch {
      // Ignore parsing errors
    }

    if (discovered.size > 0) break; // If we found URLs in the first sitemap, skip the next
  }

  return Array.from(discovered).slice(0, maxUrls);
}
