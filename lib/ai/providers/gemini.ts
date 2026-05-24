import { GoogleGenAI } from "@google/genai";

const DEFAULT_GEMINI_CHAT_MODEL = "gemini-2.5-flash";
const GEMINI_CHAT_FALLBACK_MODELS = ["gemini-2.5-flash-lite", "gemini-2.0-flash"];

function isGeminiQuotaError(error: any): boolean {
  if (!error) return false;
  const parts: string[] = [];
  if (typeof error === "string") {
    parts.push(error);
  } else {
    if (error.message) parts.push(String(error.message));
    if (error.statusText) parts.push(String(error.statusText));
    if (error.status) parts.push(String(error.status));
    if (error.code) parts.push(String(error.code));
    if (error.error) {
      if (typeof error.error === "string") {
        parts.push(error.error);
      } else {
        if (error.error.message) parts.push(String(error.error.message));
        if (error.error.status) parts.push(String(error.error.status));
        if (error.error.code) parts.push(String(error.error.code));
      }
    }
    try {
      const stringified = JSON.stringify(error);
      if (stringified && stringified !== "{}") {
        parts.push(stringified);
      }
    } catch (_) {}
    if (error instanceof Error) {
      parts.push(error.name || "");
      parts.push(error.message || "");
      if (error.stack) parts.push(error.stack);
    }
  }
  const searchSpace = parts.join(" ");
  return /429|quota|RESOURCE_EXHAUSTED|rate-limit|rate limit|limit exceeded/i.test(searchSpace);
}

export async function generateGeminiChat({
  model,
  systemInstruction,
  userMessage,
  history = [],
  temperature = 0.4,
}: {
  model: string;
  systemInstruction: string;
  userMessage: string;
  history?: { role: "user" | "model"; content: string }[];
  temperature?: number;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY in environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Format history for @google/genai SDK
  const contents = [
    ...history.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    })),
    {
      role: "user",
      parts: [{ text: userMessage }],
    },
  ];

  async function callGeminiChat(selectedModel: string): Promise<string> {
    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: temperature,
        maxOutputTokens: 800,
      },
    });

    if (!response.text) {
      throw new Error("Invalid response format from Gemini.");
    }

    return response.text;
  }

  const selectedModel = model || DEFAULT_GEMINI_CHAT_MODEL;

  try {
    return await callGeminiChat(selectedModel);
  } catch (error) {
    if (!isGeminiQuotaError(error)) throw error;

    const fallbackModel = GEMINI_CHAT_FALLBACK_MODELS.find(
      (candidate) => candidate !== selectedModel
    );

    if (!fallbackModel) throw error;

    console.warn(
      `[Gemini Warning] ${selectedModel} quota/rate limit hit. Retrying chat with ${fallbackModel}.`
    );
    return callGeminiChat(fallbackModel);
  }
}

export async function generateGeminiEmbedding({
  model,
  text,
}: {
  model: string;
  text: string;
}): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY in environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.embedContent({
    model: model || "gemini-embedding-001",
    contents: text,
    config: {
      outputDimensionality: 768,
    },
  });

  const embedding = response.embeddings?.[0]?.values;
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error("Invalid response format from Gemini Embeddings.");
  }

  return embedding;
}
