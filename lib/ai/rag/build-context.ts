import "server-only";
import { type RetrievedChunk } from "./retrieve-context";

export function formatContext(chunks: RetrievedChunk[]): string {
  if (!chunks || chunks.length === 0) {
    return "No specific knowledge found for this query.";
  }

  return chunks
    .map((chunk, index) => {
      const sourceTitle = chunk.metadata?.source_title || "Unknown Source";
      const sourceType = chunk.metadata?.source_type || "document";
      const headingText = chunk.metadata?.section_heading ? ` (Section: ${chunk.metadata.section_heading})` : "";
      
      return `[Knowledge ${index + 1}] Source: ${sourceTitle} [type: ${sourceType}]${headingText}\n${chunk.content}`;
    })
    .join("\n\n");
}
