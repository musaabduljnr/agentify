import { GoogleGenAI } from "@google/genai";

/**
 * Generates an embedding for a given text using @google/genai.
 * Model: text-embedding-004
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY in environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: text,
      config: {
        outputDimensionality: 768,
      }
    });

    const embedding = response.embeddings?.[0]?.values;

    if (!embedding || !Array.isArray(embedding)) {
      throw new Error("Invalid response format from Gemini Embeddings.");
    }

    if (embedding.length !== 768) {
      throw new Error(`Expected 768 dimensions, got ${embedding.length}`);
    }

    return embedding;
  } catch (error: any) {
    throw new Error(`Gemini API Error: ${error.message || JSON.stringify(error)}`);
  }
}
