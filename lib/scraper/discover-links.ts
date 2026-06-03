import * as cheerio from "cheerio";
import { normalizeUrl } from "./url-safety";

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

const SOCIAL_MEDIA_DOMAINS = [
  "facebook.com",
  "twitter.com",
  "instagram.com",
  "linkedin.com",
  "youtube.com",
  "pinterest.com",
  "github.com",
  "t.me",
  "wa.me",
];

export function discoverInternalLinks({
  baseUrl,
  html,
  maxLinks = 50,
}: {
  baseUrl: string;
  html: string;
  maxLinks?: number;
}): string[] {
  const discovered = new Set<string>();
  const $ = cheerio.load(html);

  let baseHostname = "";
  try {
    baseHostname = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return [];
  }

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")?.trim();
    if (!href) return;

    // Ignore javascript:, mailto:, tel:, whatsapp:
    const lowerHref = href.toLowerCase();
    if (
      lowerHref.startsWith("javascript:") ||
      lowerHref.startsWith("mailto:") ||
      lowerHref.startsWith("tel:") ||
      lowerHref.startsWith("whatsapp:") ||
      lowerHref.startsWith("sms:")
    ) {
      return;
    }

    try {
      const absoluteUrl = new URL(href, baseUrl);
      
      // Enforce http/https protocol
      if (absoluteUrl.protocol !== "http:" && absoluteUrl.protocol !== "https:") return;

      // Keep only same origin/hostname
      const candidateHostname = absoluteUrl.hostname.toLowerCase();
      if (candidateHostname !== baseHostname) return;

      // Filter social media domains if somehow same host or subdomains
      if (SOCIAL_MEDIA_DOMAINS.some(domain => candidateHostname.includes(domain))) return;

      // Remove hash fragments and credentials
      absoluteUrl.hash = "";
      absoluteUrl.username = "";
      absoluteUrl.password = "";

      // Ignore non-HTML static extensions
      if (SKIPPED_PATH_EXTENSIONS.test(absoluteUrl.pathname)) return;

      // Normalize trailing slashes (remove except for "/")
      if (absoluteUrl.pathname !== "/") {
        absoluteUrl.pathname = absoluteUrl.pathname.replace(/\/+$/, "");
      }

      // Ignore administrative, auth, checkout segments
      const pathname = absoluteUrl.pathname.toLowerCase();
      if (
        SKIPPED_PATH_SEGMENTS.some(
          (segment) => pathname === segment || pathname.startsWith(`${segment}/`)
        )
      ) {
        return;
      }

      discovered.add(normalizeUrl(absoluteUrl.toString()));
    } catch {
      // Ignore unparseable URLs
    }
  });

  // Prioritize useful business pages
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

  const getPriority = (urlStr: string): number => {
    try {
      const pathname = new URL(urlStr).pathname.toLowerCase();
      const idx = priorityTerms.findIndex((term) => pathname.includes(term));
      return idx === -1 ? priorityTerms.length : idx;
    } catch {
      return priorityTerms.length;
    }
  };

  return Array.from(discovered)
    .sort((a, b) => {
      const pA = getPriority(a);
      const pB = getPriority(b);
      if (pA !== pB) return pA - pB;
      return a.localeCompare(b);
    })
    .slice(0, maxLinks);
}
