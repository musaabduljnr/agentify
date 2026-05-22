import * as pdfParseModule from "pdf-parse";
import mammoth from "mammoth";

type PdfParse = (buffer: Buffer) => Promise<{ text: string }>;

const pdfParse = (
  typeof pdfParseModule === "function"
    ? pdfParseModule
    : (pdfParseModule as unknown as { default?: PdfParse }).default || pdfParseModule
) as PdfParse;

export async function extractTextFromTxt(buffer: Buffer): Promise<string> {
  return buffer.toString("utf-8");
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text;
}

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export function cleanExtractedText(text: string): string {
  if (!text) return "";

  // Replace multiple newlines with a single newline
  let cleaned = text.replace(/\n{3,}/g, "\n\n");

  // Replace multiple spaces with a single space
  cleaned = cleaned.replace(/[ \t]{2,}/g, " ");

  // Trim leading/trailing whitespace
  return cleaned.trim();
}

export async function extractDocumentText(buffer: Buffer, fileType: string): Promise<string> {
  let text = "";

  if (fileType === "application/pdf") {
    text = await extractTextFromPdf(buffer);
  } else if (
    fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileType.includes("wordprocessingml")
  ) {
    text = await extractTextFromDocx(buffer);
  } else if (fileType === "text/plain") {
    text = await extractTextFromTxt(buffer);
  } else {
    throw new Error(`Unsupported file type: ${fileType}`);
  }

  return cleanExtractedText(text);
}

export function getWordCount(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).length;
}

export function getCharacterCount(text: string): number {
  if (!text) return 0;
  return text.length;
}
