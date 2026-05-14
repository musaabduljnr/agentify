import { GoogleAuth } from "google-auth-library";

/**
 * Generates a response from Gemini using Vertex AI.
 */
export async function generateGeminiResponse({
  systemInstruction,
  userMessage,
  temperature = 0.4,
}: {
  systemInstruction: string;
  userMessage: string;
  temperature?: number;
}): Promise<string> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const model = process.env.GOOGLE_GEMINI_MODEL || "gemini-2.5-flash";

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Vertex AI credentials in environment variables.");
  }

  const auth = new GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: "https://www.googleapis.com/auth/cloud-platform",
  });

  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

  const payload = {
    systemInstruction: {
      parts: [
        {
          text: systemInstruction,
        },
      ],
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: userMessage,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: temperature,
      maxOutputTokens: 800,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Vertex AI Gemini API Error: ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const assistantText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!assistantText) {
    throw new Error("Invalid response format from Vertex AI Gemini.");
  }

  return assistantText;
}
