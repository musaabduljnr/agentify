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

    // If paragraph itself is too large, split by sentences (rough)
    if (p.length > maxChunkSize) {
      const sentences = p.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        if ((currentChunk + " " + sentence).length <= maxChunkSize) {
          currentChunk += (currentChunk ? " " : "") + sentence;
        } else {
          if (currentChunk) chunks.push(currentChunk);
          currentChunk = sentence;
        }
      }
    } else {
      // If adding this paragraph exceeds limit
      if ((currentChunk + "\n\n" + p).length <= maxChunkSize) {
        currentChunk += (currentChunk ? "\n\n" : "") + p;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        
        // Handle overlap: take last 'overlap' characters of previous chunk if possible
        const lastPortion = currentChunk.slice(-overlap);
        currentChunk = (lastPortion ? lastPortion + "\n\n" : "") + p;
      }
    }
  }

  if (currentChunk) chunks.push(currentChunk);

  // Final cleanup: remove duplicates and very small chunks
  return Array.from(new Set(chunks))
    .filter(c => c.length > 50)
    .map(c => c.trim());
}

/**
 * Roughly estimates tokens based on character count.
 * Approx 4 chars per token.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
