import "server-only";
import { type RetrievedChunk } from "./types";

export const NO_KNOWLEDGE_CONTEXT = "No specific knowledge found for this query.";

export function formatContext(chunks: RetrievedChunk[]): string {
  if (!chunks || chunks.length === 0) {
    return NO_KNOWLEDGE_CONTEXT;
  }

  const formattedChunks = chunks
    .map((chunk, index) => {
      const sourceTitle = chunk.metadata?.source_title || "Unknown Source";
      const sourceType = chunk.metadata?.source_type || "document";
      const headingText = chunk.metadata?.section_heading
        ? ` (Section: ${chunk.metadata.section_heading})`
        : "";
      const pageUrl = chunk.metadata?.page_url || chunk.metadata?.source_url;
      const urlText = pageUrl ? ` (Page: ${pageUrl})` : "";

      return `[Knowledge ${index + 1}] Source: ${sourceTitle} [type: ${sourceType}]${headingText}${urlText}\n${chunk.content}`;
    })
    .join("\n\n");

  return `Verified excerpts from the business knowledge base:\n\n${formattedChunks}`;
}
