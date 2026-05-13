import * as cheerio from "cheerio";
import { isValidHttpUrl, isPrivateOrLocalUrl, normalizeUrl } from "./url-safety";
import { cleanExtractedText, countWords } from "./text-cleaner";

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB
const FETCH_TIMEOUT = 15_000; // 15 seconds
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

export type ScrapeResult = {
  title: string;
  description: string;
  text: string;
  wordCount: number;
  characterCount: number;
};

export async function scrapeUrl(rawUrl: string): Promise<ScrapeResult> {
  const url = normalizeUrl(rawUrl);

  // Safety checks
  if (!isValidHttpUrl(url)) {
    throw new Error("Invalid URL. Only http and https URLs are allowed.");
  }
  if (isPrivateOrLocalUrl(url)) {
    throw new Error("Cannot scrape private or local URLs.");
  }

  // Fetch with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error("Request timed out. The website took too long to respond.");
    }
    throw new Error(`Failed to fetch URL: ${err.message}`);
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
  if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
    throw new Error("Page is too large to process (over 5MB).");
  }

  const html = await response.text();
  if (html.length > MAX_RESPONSE_SIZE) {
    throw new Error("Page content is too large to process (over 5MB).");
  }

  // Parse with Cheerio
  const $ = cheerio.load(html);

  // Extract metadata
  const title = $("title").first().text().trim() || $("h1").first().text().trim() || "";
  const description =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    "";

  // Remove unwanted elements
  $(REMOVE_SELECTORS).remove();

  // Extract meaningful text
  const textParts: string[] = [];

  if (title) textParts.push(title);
  if (description) textParts.push(description);

  // Headings
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const text = $(el).text().trim();
    if (text) textParts.push(text);
  });

  // Paragraphs
  $("p").each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 10) textParts.push(text);
  });

  // List items
  $("li").each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 5) textParts.push(`• ${text}`);
  });

  // Table cells
  $("td, th").each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 3) textParts.push(text);
  });

  // Blockquotes
  $("blockquote").each((_, el) => {
    const text = $(el).text().trim();
    if (text) textParts.push(text);
  });

  const rawText = textParts.join("\n");
  const cleanedText = cleanExtractedText(rawText);

  if (!cleanedText || countWords(cleanedText) < 5) {
    throw new Error("Could not extract meaningful text from this page.");
  }

  return {
    title,
    description,
    text: cleanedText,
    wordCount: countWords(cleanedText),
    characterCount: cleanedText.length,
  };
}
