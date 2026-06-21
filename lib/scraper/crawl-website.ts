import { assertPublicHttpUrl, normalizeUrl } from "./url-safety";
import { fetchRobotsRules, isUrlAllowedByRobots } from "./robots";
import { getSitemapUrls } from "./sitemap";
import { scrapePage } from "./scrape-url";
import { type FeatureSource } from "../ai/logs/ai-logs";

export interface CrawledPage {
  url: string;
  title: string;
  description: string;
  text: string;
  wordCount: number;
  characterCount: number;
  status: "scraped" | "skipped_low_value";
}

export interface FailedPage {
  url: string;
  error: string;
}

export interface CrawlResult {
  startUrl: string;
  pagesFound: number;
  pagesScraped: number;
  pagesFailed: number;
  combinedText: string;
  pages: CrawledPage[];
  failedPages: FailedPage[];
}

export async function crawlWebsite({
  startUrl: rawStartUrl,
  maxPages = 10,
  depth = 1,
  timeoutMs = 10000,
  businessId,
  featureSource,
}: {
  startUrl: string;
  maxPages?: number;
  depth?: number;
  timeoutMs?: number;
  businessId?: string;
  featureSource?: FeatureSource;
}): Promise<CrawlResult> {
  const startUrl = normalizeUrl(rawStartUrl);
  
  // 1. Enforce safety checks
  await assertPublicHttpUrl(startUrl);

  const baseHostname = new URL(startUrl).hostname.toLowerCase();

  // 2. Fetch robots.txt rules
  const disallowedPaths = await fetchRobotsRules(startUrl);
  if (!isUrlAllowedByRobots(startUrl, disallowedPaths)) {
    throw new Error("The start URL is disallowed by the website's robots.txt rules.");
  }

  // 3. Fetch sitemap URLs (pre-populate queue)
  const sitemapUrls = await getSitemapUrls(startUrl);

  const visited = new Set<string>();
  const queued = new Set<string>();
  const pages: CrawledPage[] = [];
  const failedPages: FailedPage[] = [];

  // Initialize Queue with start URL at depth 0
  interface QueueItem {
    url: string;
    depth: number;
  }
  const queue: QueueItem[] = [{ url: startUrl, depth: 0 }];
  queued.add(startUrl);

  // Pre-seed queue with sitemap URLs (treated as depth 1)
  for (const sUrl of sitemapUrls) {
    if (!queued.has(sUrl)) {
      queued.add(sUrl);
      queue.push({ url: sUrl, depth: 1 });
    }
  }

  // Concurrency limit of 2
  const CONCURRENCY = 2;

  while (queue.length > 0 && (pages.length + failedPages.length) < maxPages) {
    const batch = queue.splice(0, CONCURRENCY);
    
    await Promise.all(
      batch.map(async (item) => {
        if (visited.has(item.url)) return;
        visited.add(item.url);

        // Check robots.txt exclusion
        if (!isUrlAllowedByRobots(item.url, disallowedPaths)) {
          failedPages.push({ url: item.url, error: "Disallowed by robots.txt rules" });
          return;
        }

        try {
          // Scrape individual page
          const scraped = await scrapePage(item.url, startUrl, businessId, featureSource);
          
          // Skip low-value content (less than 10 words)
          if (scraped.wordCount < 10) {
            pages.push({
              url: scraped.url,
              title: scraped.title,
              description: scraped.description,
              text: scraped.text,
              wordCount: scraped.wordCount,
              characterCount: scraped.characterCount,
              status: "skipped_low_value"
            });
            return;
          }

          pages.push({
            url: scraped.url,
            title: scraped.title,
            description: scraped.description,
            text: scraped.text,
            wordCount: scraped.wordCount,
            characterCount: scraped.characterCount,
            status: "scraped"
          });

          // If depth allows, discover new links from the page
          if (item.depth < depth) {
            for (const link of scraped.links) {
              if (!queued.has(link) && !visited.has(link)) {
                queued.add(link);
                queue.push({ url: link, depth: item.depth + 1 });
              }
            }
          }
        } catch (err: any) {
          failedPages.push({
            url: item.url,
            error: err.message || "Failed to scrape page"
          });
        }
      })
    );
  }

  // Filter successfully scraped pages for combining
  const scrapedPages = pages.filter(p => p.status === "scraped");

  // Combine page content in the standard format
  const combinedText = scrapedPages
    .map((page) => {
      return `=== Page: ${page.title || page.url} ===\nURL: ${page.url}\n\n${page.text}`;
    })
    .join("\n\n");

  return {
    startUrl,
    pagesFound: queued.size,
    pagesScraped: scrapedPages.length,
    pagesFailed: failedPages.length,
    combinedText,
    pages,
    failedPages
  };
}
