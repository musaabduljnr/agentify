/**
 * Clean extracted text by removing excessive whitespace, short junk lines, etc.
 */
export function cleanExtractedText(raw: string): string {
  return raw
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim()) // collapse whitespace
    .filter((line) => line.length > 3) // remove extremely short lines
    .filter((line, i, arr) => arr.indexOf(line) === i) // remove exact duplicates
    .join("\n")
    .trim();
}

/**
 * Count words in a text string.
 */
export function countWords(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}
