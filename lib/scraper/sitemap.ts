import * as cheerio from "cheerio";
import { assertPublicHttpUrl, canonicalizeCrawlUrl, normalizedHostname } from "./url-safety";

const SKIPPED_PATH_EXTENSIONS =
  /\.(?:7z|avi|css|csv|doc|docx|eot|gif|gz|ico|jpeg|jpg|js|json|map|mov|mp3|mp4|mpeg|otf|pdf|png|ppt|pptx|rar|rss|svg|tar|ttf|txt|wav|webm|webp|woff|woff2|xls|xlsx|zip)$/i;

const MAX_CHILD_SITEMAPS = 8;

async function fetchSitemapContent(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    await assertPublicHttpUrl(url);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "AgentifyBot/1.0",
        Accept: "application/xml,text/xml,*/*",
      },
    });

    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseSitemap(
  xml: string,
  sitemapUrl: string,
  baseHostname: string
): { pages: string[]; childSitemaps: string[] } {
  const pages = new Set<string>();
  const childSitemaps = new Set<string>();

  try {
    const $ = cheerio.load(xml, { xmlMode: true });
    const isSitemapIndex = $("sitemap").length > 0 && $("url").length === 0;

    $("loc").each((_, el) => {
      const urlText = $(el).text().trim();
      if (!urlText) return;

      try {
        const absoluteUrl = new URL(urlText, sitemapUrl);
        if (absoluteUrl.protocol !== "http:" && absoluteUrl.protocol !== "https:") return;
        if (normalizedHostname(absoluteUrl.toString()) !== baseHostname) return;

        if (isSitemapIndex) {
          childSitemaps.add(canonicalizeCrawlUrl(absoluteUrl));
          return;
        }

        if (SKIPPED_PATH_EXTENSIONS.test(absoluteUrl.pathname)) return;
        pages.add(canonicalizeCrawlUrl(absoluteUrl));
      } catch {
        // Ignore invalid URL entries.
      }
    });
  } catch {
    // Ignore parsing errors.
  }

  return { pages: [...pages], childSitemaps: [...childSitemaps] };
}

export async function getSitemapUrls(baseUrl: string, maxUrls = 50): Promise<string[]> {
  const rootUrl = new URL("/", baseUrl).toString().replace(/\/+$/, "");
  const candidates = [`${rootUrl}/sitemap.xml`, `${rootUrl}/sitemap_index.xml`];
  const discovered = new Set<string>();
  const pendingSitemaps: string[] = [];

  const baseHostname = normalizedHostname(baseUrl);
  if (!baseHostname) return [];

  for (const sitemapUrl of candidates) {
    if (discovered.size >= maxUrls) break;

    const xml = await fetchSitemapContent(sitemapUrl);
    if (!xml) continue;

    const { pages, childSitemaps } = parseSitemap(xml, sitemapUrl, baseHostname);
    pages.forEach((page) => discovered.add(page));
    childSitemaps.forEach((child) => {
      if (!pendingSitemaps.includes(child)) pendingSitemaps.push(child);
    });

    // A flat sitemap already gave us page URLs; a sitemap index only gave us
    // child sitemap URLs, so keep going.
    if (pages.length > 0) break;
  }

  for (const childSitemap of pendingSitemaps.slice(0, MAX_CHILD_SITEMAPS)) {
    if (discovered.size >= maxUrls) break;

    const xml = await fetchSitemapContent(childSitemap);
    if (!xml) continue;

    const { pages } = parseSitemap(xml, childSitemap, baseHostname);
    pages.forEach((page) => discovered.add(page));
  }

  return [...discovered].slice(0, maxUrls);
}
