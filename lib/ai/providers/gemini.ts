import { GoogleGenAI } from "@google/genai";

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

  const response = await ai.models.generateContent({
    model: model,
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
    model: model || "text-embedding-004",
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
