import { GoogleGenAI } from "@google/genai";

/**
 * Generates a response from Gemini using the @google/genai SDK.
 */
export async function generateGeminiResponse({
  systemInstruction,
  userMessage,
  history = [],
  temperature = 0.4,
}: {
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
  const model = process.env.GOOGLE_GEMINI_MODEL || "gemini-2.0-flash"; // Use stable 2.0 flash

  // Map history to Google AI format
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

  try {
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
  } catch (error: any) {
    throw new Error(`Gemini API Error: ${error.message || JSON.stringify(error)}`);
  }
}
