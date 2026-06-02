/**
 * Clean extracted text by removing excessive whitespace, short junk lines, etc.
 */
export function cleanExtractedText(raw: string): string {
  return raw
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim()) // collapse whitespace
    .filter((line) => {
      if (line.length > 3) return true;
      // Keep short lines if they look like currency values or words like "Free"
      const isPriceOrFree = /^(?:[\$\£\€\₦\¥]\s*\d+|\d+\s*(?:usd|eur|gbp|mo|yr|\/mo|\/yr|€|£|\$)|free|0)$/i.test(line);
      return isPriceOrFree;
    })
    .filter((line, i, arr) => {
      // Keep short/pricing lines even if they are duplicate, but remove duplicates for longer sentences
      if (line.length <= 15) return true;
      const isPriceOrFree = /^(?:[\$\£\€\₦\¥]\s*\d+|\d+\s*(?:usd|eur|gbp|mo|yr|\/mo|\/yr|€|£|\$)|free|0)$/i.test(line);
      if (isPriceOrFree) return true;
      return arr.indexOf(line) === i;
    })
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
