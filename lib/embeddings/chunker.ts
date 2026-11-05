import { createHash } from "crypto";

/**
 * Chunks text into smaller pieces for embedding.
 * Splits by paragraphs first, then handles length constraints.
 */
export function chunkText(
  text: string,
  options: { maxChunkSize?: number; overlap?: number } = {}
): string[] {
  const { maxChunkSize = 1200, overlap = 150 } = options;

  if (!text) return [];

  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const p = paragraph.trim();
    if (!p) continue;

    if (p.length > maxChunkSize) {
      const sentences = p.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        if (sentence.length > maxChunkSize) {
          if (currentChunk) {
            chunks.push(currentChunk);
            currentChunk = "";
          }
          chunks.push(...hardSplit(sentence, maxChunkSize));
          continue;
        }

        if ((currentChunk + " " + sentence).length <= maxChunkSize) {
          currentChunk += (currentChunk ? " " : "") + sentence;
        } else {
          if (currentChunk) chunks.push(currentChunk);
          currentChunk = sentence;
        }
      }
    } else {
      if ((currentChunk + "\n\n" + p).length <= maxChunkSize) {
        currentChunk += (currentChunk ? "\n\n" : "") + p;
      } else {
        const previousChunk = currentChunk;
        if (previousChunk) chunks.push(previousChunk);

        // Only prepend overlap if the result still fits the size limit.
        const lastPortion = previousChunk.slice(-overlap);
        currentChunk =
          lastPortion && lastPortion.length + 2 + p.length <= maxChunkSize
            ? `${lastPortion}\n\n${p}`
            : p;
      }
    }
  }

  if (currentChunk) chunks.push(currentChunk);

  // Final cleanup: remove duplicates and discard only empty/noisy fragments.
  // Short scraped pages can still contain useful product or business facts.
  return Array.from(new Set(chunks))
    .filter((c) => c.trim().length >= 10)
    .map((c) => c.trim());
}

function hardSplit(text: string, maxChunkSize: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const parts: string[] = [];
  let current = "";

  for (const word of words) {
    if ((current + " " + word).trim().length <= maxChunkSize) {
      current += (current ? " " : "") + word;
    } else {
      if (current) parts.push(current);
      current = word.length > maxChunkSize ? word.slice(0, maxChunkSize) : word;
    }
  }

  if (current) parts.push(current);
  return parts;
}

/**
 * Roughly estimates tokens based on character count.
 * Approx 4 chars per token.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function hashContent(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export interface SourceChunk {
  content: string;
  contentHash: string;
  sectionHeading: string | null;
  pageUrl: string | null;
  pageTitle: string | null;
}

interface PageSection {
  title: string | null;
  url: string | null;
  lines: string[];
}

const PAGE_MARKER = /^===\s*Page:\s*(.*?)\s*===$/;
const URL_LINE = /^URL:\s*(\S+)\s*$/;
const MARKDOWN_HEADING = /^#{1,6}\s+(.+)$/;

function splitPageSections(text: string): PageSection[] {
  const lines = text.split(/\r?\n/);
  const sections: PageSection[] = [];
  let current: PageSection = { title: null, url: null, lines: [] };
  let expectUrl = false;

  for (const line of lines) {
    const marker = line.match(PAGE_MARKER);
    if (marker) {
      if (current.lines.some((entry) => entry.trim()) || current.title) {
        sections.push(current);
      }
      current = { title: marker[1].trim() || null, url: null, lines: [] };
      expectUrl = true;
      continue;
    }

    if (expectUrl) {
      const urlMatch = line.match(URL_LINE);
      if (urlMatch) {
        current.url = urlMatch[1].trim();
        expectUrl = false;
        continue;
      }
      expectUrl = false;
    }

    current.lines.push(line);
  }

  if (current.lines.some((entry) => entry.trim()) || current.title) {
    sections.push(current);
  }

  return sections;
}

function deriveSectionHeading(chunk: string, pageTitle: string | null): string | null {
  const headings = chunk
    .split(/\r?\n/)
    .map((line) => line.trim().match(MARKDOWN_HEADING)?.[1]?.trim())
    .filter((value): value is string => Boolean(value));

  return headings.length > 0 ? headings[0] : pageTitle;
}

/**
 * Chunks crawled content while preserving its page (URL/title) and the last
 * markdown heading in each chunk. This metadata makes retrieval traceable and
 * lets the assistant cite the page it used.
 */
export function chunkSourceText(
  text: string,
  options: { maxChunkSize?: number; overlap?: number } = {}
): SourceChunk[] {
  if (!text) return [];

  const sections = splitPageSections(text);
  const records: SourceChunk[] = [];

  for (const section of sections.length > 0 ? sections : [{ title: null, url: null, lines: [text] }]) {
    const sectionText = section.lines.join("\n").trim();
    if (!sectionText) continue;

    for (const content of chunkText(sectionText, options)) {
      records.push({
        content,
        contentHash: hashContent(content),
        sectionHeading: deriveSectionHeading(content, section.title),
        pageUrl: section.url,
        pageTitle: section.title,
      });
    }
  }

  return records;
}
