# Crawler Architecture

This document describes how Agentify discovers, fetches, extracts, and stores
website knowledge after the reliability overhaul. It covers both crawler entry
points and how their output reaches the RAG index.

## Entry points

| Action | Module | Purpose |
| --- | --- | --- |
| `crawlWebsite()` | `lib/scraper/crawl-website.ts:32` | Multi-page BFS crawl used by "Crawl Website". |
| `scrapeUrl()` | `lib/scraper/scrape-url.ts:710` | Single-page scrape (with optional discovered links) used by "Scrape Page". |
| `getSitemapUrls()` | `lib/scraper/sitemap.ts:72` | Sitemap discovery used by the multi-page crawl. |
| `processWebsiteSource()` | `lib/actions/knowledge.ts:421` | Server action: single-page scrape, persistence, auto-index. |
| `crawlWebsiteSource()` | `lib/actions/knowledge.ts:527` | Server action: multi-page crawl, persistence, auto-index. |
| `processDocumentSource()` | `lib/actions/knowledge.ts:696` | Server action: document extraction, persistence, auto-index. |

Both webpage entry points share the same URL canonicalization, extraction
helpers, page-marker format, and indexing pipeline.

## 1. URL safety and identity

`lib/scraper/url-safety.ts`

1. `assertPublicHttpUrl()` rejects non-HTTP(S) schemes and private/link-local
   addresses (including IPv6-mapped forms), and resolves DNS before fetching.
2. `normalizeUrl()` adds a missing scheme.
3. `canonicalizeCrawlUrl()` (line 42) produces a stable crawl identity:
   - removes fragments and URL credentials;
   - strips `utm_*`, `fbclid`, `gclid`, `msclkid`, and related tracking params;
   - sorts remaining query parameters;
   - removes trailing slashes (except the root).
4. `normalizedHostname()` compares hosts without the `www.` prefix, so
   `https://example.com` and `https://www.example.com` are one site. HTTP and
   HTTPS variants of the same host are also treated as the same origin.

The crawl queue and the visited set both use canonical URLs, so tracking links
and parameter-order variants cannot consume the page budget twice.

## 2. Discovery

`lib/scraper/crawl-website.ts`, `lib/scraper/sitemap.ts`

1. The start URL is normalized and canonicalized.
2. Sitemaps are tried at `/sitemap.xml` and `/sitemap_index.xml`.
3. `parseSitemap()` detects `<sitemapindex>` documents (a sitemap listing other
   sitemaps) and recursively follows up to `MAX_CHILD_SITEMAPS = 8` children.
4. Every sitemap URL is canonicalized, same-host filtered, deduplicated, and
   capped by `maxUrls`.
5. Remaining capacity is filled by internal-link BFS. Links are collected even
   from low-value pages so a thin landing page cannot hide the rest of the site.
6. Skipped path segments (assets, auth, admin, API) are not queued.

`pagesFound` is the number of unique queued URLs. `pagesScraped` counts only
pages that produced usable text. A page that returns no meaningful content is
not counted as scraped, but its links are still followed.

## 3. Fetching

`lib/scraper/scrape-url.ts` (`fetchHtml`)

- Per-page timeout: 10 seconds.
- Maximum response size: 5 MB.
- Redirects are resolved manually and each hop is re-validated by
  `assertPublicHttpUrl()` before it is followed.
- A redirect to an external or private host is rejected.
- The final page identity is the canonicalized post-redirect URL. Duplicate
  pages reached by different redirects are discarded.
- Concurrency is capped at 3 during a multi-page crawl, and total crawl pages
  are capped at 15 per invocation (`MAX_CRAWL_PAGES` / `MAX_CRAWL_DEPTH`).

## 4. Extraction

### 4.1 Boilerplate removal

Before extraction, these elements are removed:

- `script`, `style`, `noscript`, `svg`, `iframe`
- `nav`, `[role="navigation"]`, `.nav`, `.navbar`, `.navigation`, `.menu`,
  `.main-menu`
- breadcrumbs, `.sidebar`
- cookie/consent banners where identifiable

Footers are intentionally retained because they often contain valid contact,
address, and hours information.

### 4.2 Deterministic extraction

`buildDeterministicText()` (`lib/scraper/scrape-url.ts:474`) always runs. It
collects:

- source URL, `<title>`, and meta description;
- headings `h1`–`h6`;
- paragraphs, list items, table cells, blockquotes, definition lists, details;
- substantial direct text in layout containers;
- price-like fragments from containers whose class/id indicates pricing;
- structured data extracted from JSON-LD and Next.js flight payloads.

This guarantees that content is available even when no AI provider is
configured.

### 4.3 AI extraction (optional)

When `GEMINI_API_KEY` is set, the cleaned HTML is sent to `gemini-2.5-flash`
with an extraction prompt that forbids invention and summarization of pricing.
The AI output passes through two gates:

1. `sanitizeAiExtraction()` (`lib/scraper/scrape-url.ts:553`) removes code
   fences, HTML tags, and entities.
2. `isUsableAiExtraction()` (`lib/scraper/scrape-url.ts:580`) rejects:
   - empty output;
   - fewer than 25 words or fewer than 120 characters;
   - refusal/assistant boilerplate (`I'm sorry`, `cannot access the page`, ...);
   - JavaScript/script fragments;
   - output that dropped more than 80% of the deterministic words when the
     deterministic pass found at least 200 words.

If the AI output is unusable, a warning is logged and the deterministic text is
used. If the AI call fails, the crawl continues with deterministic text. An AI
failure never fails the whole page.

### 4.4 Structured data

JSON-LD and Next.js flight data are collected before scripts are removed.
Structured facts (including email, telephone, street address, opening hours,
price, and price currency) are appended to the deterministic text and, when not
already present, to accepted AI output. This preserves schema-only facts such as
prices and opening hours that are not visible in rendered HTML.

### 4.5 Page markers

Every page contributes a section marker followed by its URL:

```
=== Page: <page title or URL> ===
URL: <canonical page URL>

<page text>
```

`combinePages()` uses the same marker format for single-page scrapes, so the
chunker can attach page metadata consistently in both modes.

## 5. Status model and failure handling

`knowledge_sources` keeps its existing status enum. Crawl progress is recorded
in the existing `crawl_status` column:

| `crawl_status` | Meaning |
| --- | --- |
| `discovering` | Crawl started, URL discovery in progress. |
| `completed` | Every attempted page was scraped successfully. |
| `partial` | At least one page succeeded and at least one failed. |
| `failed` | Zero pages produced usable content, or an unrecoverable error occurred. |

Additional fields: `pages_found`, `pages_scraped`, `pages_failed`,
`crawled_pages`, `failed_pages`, `crawl_started_at`, `crawl_completed_at`.

Failure behavior:

- **Complete crawl failure on a re-crawl**: previous content, status, and the
  previous vector index are preserved. The source returns to `trained` when it
  previously had content; otherwise it becomes `failed`. The error is stored in
  `error_message` and a business notification is created.
- **Complete failure of a first crawl**: status `failed`, no content, explicit
  error.
- **Partial crawl**: successful pages are stored, `crawl_status = "partial"`,
  failed page URLs are retained in `failed_pages`, and the UI reports that some
  pages failed. It is never reported as fully completed.
- **Exception during crawl**: previous content and status are preserved, and the
  error is surfaced.

After content is saved, indexing runs through `indexSourceContent()`
(`lib/actions/knowledge.ts:62`). If embedding fails, the content remains saved,
the action returns a warning, and the UI offers "Embed Content" to retry.
`metadata.embedding_status` records `pending`, `completed`, or `failed`.

## 6. Handoff to chunking and retrieval

`chunkSourceText()` (`lib/embeddings/chunker.ts:167`) parses the page markers
and produces chunks with:

- `content` and SHA-256 `contentHash`;
- `pageUrl` and `pageTitle`;
- `sectionHeading` (first markdown heading in the chunk, else page title).

These fields are copied into `knowledge_chunks.metadata`, so retrieval results
carry traceable source/page/section information into the prompt context.

## 7. Known limitations

- AI extraction depends on `GEMINI_API_KEY`; without it, deterministic
  extraction is used.
- JavaScript-rendered content that never appears in HTML or embedded JSON is
  not visible to the crawler.
- A partial re-crawl stores the successfully scraped pages and records the
  failed ones; it does not merge old content for pages that newly fail.
- `robots.txt` is fetched before a multi-page crawl. Disallowed start URLs abort
  the crawl; disallowed discovered URLs are recorded as failed pages. Every
  fetched page is also subject to per-page fetch limits and URL safety checks.
