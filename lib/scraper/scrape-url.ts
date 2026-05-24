import * as cheerio from "cheerio";
import {
  assertPublicHttpUrl,
  hasRedirectsRemaining,
  normalizeUrl,
  resolveRedirectUrl,
} from "./url-safety";
import { cleanExtractedText, countWords } from "./text-cleaner";

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB
const FETCH_TIMEOUT = 10_000; // 10 seconds per page
const MAX_CRAWL_PAGES = 15;
const MAX_CRAWL_DEPTH = 2;
const MAX_CRAWL_CONCURRENCY = 3;
const MAX_TOTAL_TEXT_LENGTH = 300_000;
const MAX_SCRIPT_ASSETS = 8;
const MAX_SCRIPT_ASSET_SIZE = 300_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; AgentifyBot/1.0; +https://agentify.ai)";

const REMOVE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "svg",
  "iframe",
  "nav",
  "footer",
  "header",
  "aside",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
  ".cookie-banner",
  ".cookie-consent",
  "#cookie-notice",
].join(", ");

const SKIPPED_PATH_EXTENSIONS =
  /\.(?:7z|avi|css|csv|doc|docx|eot|gif|gz|ico|jpeg|jpg|js|json|map|mov|mp3|mp4|mpeg|otf|pdf|png|ppt|pptx|rar|rss|svg|tar|ttf|txt|wav|webm|webp|woff|woff2|xls|xlsx|xml|zip)$/i;

const SKIPPED_PATH_SEGMENTS = [
  "/admin",
  "/api",
  "/auth",
  "/cart",
  "/checkout",
  "/login",
  "/logout",
  "/signin",
  "/signup",
  "/wp-admin",
];

export type ScrapedPageSummary = {
  url: string;
  title: string;
  wordCount: number;
  characterCount: number;
};

export type FailedScrapedPageSummary = {
  url: string;
  error: string;
};

export type ScrapeResult = {
  title: string;
  description: string;
  text: string;
  wordCount: number;
  characterCount: number;
  pageCount: number;
  pages: ScrapedPageSummary[];
  discoveredUrlCount: number;
  failedPageCount: number;
  failedPages: FailedScrapedPageSummary[];
};

type PageScrapeResult = ScrapedPageSummary & {
  description: string;
  text: string;
  links: string[];
};

type CrawlQueueItem = {
  url: string;
  depth: number;
};

function normalizeCrawlUrl(href: string, baseUrl: string): string | null {
  try {
    const parsed = new URL(href, baseUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

    parsed.hash = "";
    parsed.username = "";
    parsed.password = "";

    if (SKIPPED_PATH_EXTENSIONS.test(parsed.pathname)) return null;

    const pathname = parsed.pathname.toLowerCase();
    if (SKIPPED_PATH_SEGMENTS.some((segment) => pathname === segment || pathname.startsWith(`${segment}/`))) {
      return null;
    }

    if (parsed.pathname !== "/") {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    }

    return normalizeUrl(parsed.toString());
  } catch {
    return null;
  }
}

function isSameOrigin(candidateUrl: string, rootUrl: string): boolean {
  try {
    const candidate = new URL(candidateUrl);
    const root = new URL(rootUrl);
    return candidate.origin === root.origin;
  } catch {
    return false;
  }
}

function isUsefulScriptText(value: string): boolean {
  const text = value.replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();
  const words = countWords(text);
  const exactNoisyValues = new Set([
    "404: this page could not be found.",
    "description",
    "next.metadata",
    "next.metadataoutlet",
    "next-size-adjust",
    "this page could not be found.",
    "viewport",
  ]);

  if (text.length < 4 || text.length > 260) return false;
  if (exactNoisyValues.has(lower)) return false;
  if (text.startsWith("/") || text.startsWith("$") || text.startsWith("#")) return false;
  if (lower.includes("/_next/") || lower.includes(".js") || lower.includes(".css")) return false;
  if (lower.startsWith("http://") || lower.startsWith("https://")) return false;
  if (/[{}[\]=<>]/.test(text)) return false;
  if (/^[a-z0-9_-]{18,}$/i.test(text)) return false;
  if (!/[aeiou]/i.test(text)) return false;
  if (words === 0) return false;

  const noisyTerms = [
    "absolute",
    "animate",
    "background",
    "classname",
    "duration",
    "foreground",
    "function",
    "gradient",
    "hydrate",
    "opacity",
    "rounded",
    "translate",
    "transition",
    "webpack",
  ];

  return !noisyTerms.some((term) => lower.includes(term));
}

function decodeJsonStringValue(value: string): string {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value;
  }
}

function pushUsefulText(target: string[], value: unknown): void {
  if (typeof value !== "string") return;
  const text = value.replace(/\s+/g, " ").trim();
  if (isUsefulScriptText(text)) target.push(text);
}

function collectJsonText(value: unknown, target: string[]): void {
  if (!value) return;

  if (typeof value === "string") {
    pushUsefulText(target, value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectJsonText(entry, target));
    return;
  }

  if (typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      const lowerKey = key.toLowerCase();
      if (
        [
          "alt",
          "answer",
          "articlebody",
          "buttontext",
          "content",
          "description",
          "headline",
          "label",
          "name",
          "question",
          "subtitle",
          "text",
          "title",
        ].includes(lowerKey)
      ) {
        collectJsonText(entry, target);
      } else if (typeof entry === "object") {
        collectJsonText(entry, target);
      }
    });
  }
}

function extractJsonLdText(script: string): string[] {
  const textParts: string[] = [];

  try {
    collectJsonText(JSON.parse(script), textParts);
  } catch {
    // Invalid JSON-LD should not fail the scrape.
  }

  return textParts;
}

function extractNextFlightText(script: string): string[] {
  const textParts: string[] = [];
  const matches = script.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)/g);
  const semanticValueRegex =
    /"(?:alt|answer|buttonText|children|content|description|headline|label|name|question|subtitle|text|title)"\s*:\s*"((?:\\.|[^"\\])*)"/g;

  for (const match of matches) {
    try {
      const payload = JSON.parse(match[1]);
      const flightText = String(payload[1] || "");
      let semanticMatch: RegExpExecArray | null;

      while ((semanticMatch = semanticValueRegex.exec(flightText))) {
        pushUsefulText(textParts, decodeJsonStringValue(semanticMatch[1]));
      }
    } catch {
      // Next flight chunks are best-effort enrichment.
    }
  }

  return textParts;
}

function extractReadableJavaScriptStrings(script: string): string[] {
  const textParts: string[] = [];
  const stringRegex = /(["'`])((?:\\.|(?!\1)[^\\]){4,260})\1/g;
  let match: RegExpExecArray | null;

  while ((match = stringRegex.exec(script))) {
    pushUsefulText(textParts, decodeJsonStringValue(match[2]));
  }

  return textParts;
}

async function fetchScriptAsset(url: string): Promise<string | null> {
  await assertPublicHttpUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/javascript,text/javascript,*/*",
      },
    });

    if (!response.ok) return null;

    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_SCRIPT_ASSET_SIZE) return null;

    const text = await response.text();
    if (text.length > MAX_SCRIPT_ASSET_SIZE) return null;

    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function extractScriptText($: cheerio.CheerioAPI, pageUrl: string, rootUrl: string): Promise<string[]> {
  const textParts: string[] = [];
  const scriptAssetUrls: string[] = [];

  $("script").each((_, el) => {
    const type = ($(el).attr("type") || "").toLowerCase();
    const src = $(el).attr("src");
    const inlineScript = $(el).text();

    if (type.includes("ld+json") && inlineScript) {
      textParts.push(...extractJsonLdText(inlineScript));
    }

    if (inlineScript.includes("self.__next_f.push")) {
      textParts.push(...extractNextFlightText(inlineScript));
    }

    if (!src) return;

    const normalized = normalizeCrawlUrl(src, pageUrl);
    if (!normalized || !isSameOrigin(normalized, rootUrl)) return;

    const pathname = new URL(normalized).pathname;
    if (!pathname.startsWith("/_next/static/") || !pathname.endsWith(".js")) return;

    scriptAssetUrls.push(normalized);
  });

  const uniqueAssetUrls = [...new Set(scriptAssetUrls)].slice(0, MAX_SCRIPT_ASSETS);
  const scriptAssets = await Promise.all(uniqueAssetUrls.map((url) => fetchScriptAsset(url)));

  for (const asset of scriptAssets) {
    if (!asset) continue;
    textParts.push(...extractReadableJavaScriptStrings(asset));
  }

  return [...new Set(textParts)];
}

function crawlPriority(url: string): number {
  const pathname = new URL(url).pathname.toLowerCase();
  const priorityTerms = [
    "about",
    "service",
    "product",
    "pricing",
    "menu",
    "faq",
    "contact",
    "support",
    "help",
    "policy",
    "terms",
  ];

  const matchedIndex = priorityTerms.findIndex((term) => pathname.includes(term));
  return matchedIndex === -1 ? priorityTerms.length : matchedIndex;
}

async function fetchHtml(rawUrl: string): Promise<{ url: string; html: string }> {
  let url = rawUrl;

  await assertPublicHttpUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  let response: Response;
  try {
    for (let redirectCount = 0; ; redirectCount++) {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "manual",
      });

      if (![301, 302, 303, 307, 308].includes(response.status)) {
        break;
      }

      if (!hasRedirectsRemaining(redirectCount)) {
        throw new Error("Too many redirects while fetching the website.");
      }

      url = normalizeUrl(resolveRedirectUrl(url, response.headers.get("location")));
      await assertPublicHttpUrl(url);
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Request timed out. The website took too long to respond.");
    }
    if (err instanceof Error) {
      throw new Error(`Failed to fetch URL: ${err.message}`);
    }
    throw new Error("Failed to fetch URL.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Website returned status ${response.status} (${response.statusText}).`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    throw new Error("URL does not return HTML content.");
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
    throw new Error("Page is too large to process (over 5MB).");
  }

  const html = await response.text();
  if (html.length > MAX_RESPONSE_SIZE) {
    throw new Error("Page content is too large to process (over 5MB).");
  }

  return { url, html };
}

function extractLinks($: cheerio.CheerioAPI, pageUrl: string, rootUrl: string): string[] {
  const links = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    const normalized = normalizeCrawlUrl(href, pageUrl);
    if (!normalized || !isSameOrigin(normalized, rootUrl)) return;

    links.add(normalized);
  });

  return [...links].sort((a, b) => {
    const priorityDiff = crawlPriority(a) - crawlPriority(b);
    return priorityDiff !== 0 ? priorityDiff : a.localeCompare(b);
  });
}

async function scrapePage(rawUrl: string, rootUrl: string): Promise<PageScrapeResult> {
  const { url, html } = await fetchHtml(rawUrl);
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim() || $("h1").first().text().trim() || "";
  const description =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    "";
  const links = extractLinks($, url, rootUrl);
  const scriptTextParts = await extractScriptText($, url, rootUrl);

  $(REMOVE_SELECTORS).remove();

  const textParts: string[] = [];

  textParts.push(`Source URL: ${url}`);
  if (title) textParts.push(title);
  if (description) textParts.push(description);

  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const text = $(el).text().trim();
    if (text) textParts.push(text);
  });

  $("p").each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 10) textParts.push(text);
  });

  $("li").each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 5) textParts.push(`- ${text}`);
  });

  $("td, th").each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 3) textParts.push(text);
  });

  $("blockquote").each((_, el) => {
    const text = $(el).text().trim();
    if (text) textParts.push(text);
  });

  textParts.push(...scriptTextParts);

  const rawText = textParts.join("\n");
  const cleanedText = cleanExtractedText(rawText);

  if (!cleanedText || (countWords(cleanedText) < 3 && cleanedText.length < 20)) {
    throw new Error("Could not extract meaningful text from this page.");
  }

  return {
    url,
    title,
    description,
    text: cleanedText,
    wordCount: countWords(cleanedText),
    characterCount: cleanedText.length,
    links,
  };
}

function combinePages(pages: PageScrapeResult[]): Pick<ScrapeResult, "text" | "wordCount" | "characterCount"> {
  const combined = cleanExtractedText(
    pages
      .map((page, index) => {
        const heading = `Page ${index + 1}: ${page.title || page.url}\nURL: ${page.url}`;
        return `${heading}\n${page.text}`;
      })
      .join("\n\n")
  ).slice(0, MAX_TOTAL_TEXT_LENGTH);

  return {
    text: combined,
    wordCount: countWords(combined),
    characterCount: combined.length,
  };
}

export async function scrapeUrl(rawUrl: string): Promise<ScrapeResult> {
  const startUrl = normalizeUrl(rawUrl);
  await assertPublicHttpUrl(startUrl);

  const queue: CrawlQueueItem[] = [{ url: startUrl, depth: 0 }];
  const queued = new Set<string>([startUrl]);
  const visited = new Set<string>();
  const pages: PageScrapeResult[] = [];
  const errors: FailedScrapedPageSummary[] = [];

  while (queue.length > 0 && pages.length < MAX_CRAWL_PAGES) {
    const batch = queue.splice(0, MAX_CRAWL_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (item) => {
        if (visited.has(item.url)) return null;
        visited.add(item.url);

        try {
          return {
            item,
            page: await scrapePage(item.url, startUrl),
            error: null,
          };
        } catch (err: unknown) {
          return {
            item,
            page: null,
            error: err instanceof Error ? err.message : "Unknown scrape error",
          };
        }
      })
    );

    for (const result of results) {
      if (!result) continue;

      if (result.error || !result.page) {
        errors.push({ url: result.item.url, error: result.error || "Unknown scrape error" });
        continue;
      }

      const { item, page } = result;
      pages.push(page);

      if (pages.length >= MAX_CRAWL_PAGES || item.depth >= MAX_CRAWL_DEPTH) continue;

      for (const link of page.links) {
        if (queued.has(link) || visited.has(link)) continue;
        queued.add(link);
        queue.push({ url: link, depth: item.depth + 1 });
      }

      queue.sort((a, b) => {
        const depthDiff = a.depth - b.depth;
        if (depthDiff !== 0) return depthDiff;
        const priorityDiff = crawlPriority(a.url) - crawlPriority(b.url);
        return priorityDiff !== 0 ? priorityDiff : a.url.localeCompare(b.url);
      });
    }
  }

  if (pages.length === 0) {
    throw new Error(errors[0]?.error || "Could not extract meaningful text from this website.");
  }

  const combined = combinePages(pages);

  if (!combined.text || countWords(combined.text) < 3) {
    throw new Error("Could not extract meaningful text from this website.");
  }

  return {
    title: pages[0].title,
    description: pages[0].description,
    text: combined.text,
    wordCount: combined.wordCount,
    characterCount: combined.characterCount,
    pageCount: pages.length,
    pages: pages.map(({ url, title, wordCount, characterCount }) => ({
      url,
      title,
      wordCount,
      characterCount,
    })),
    discoveredUrlCount: queued.size,
    failedPageCount: errors.length,
    failedPages: errors.slice(0, 10),
  };
}
