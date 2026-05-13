import { GoogleAuth } from "google-auth-library";

/**
 * Generates an embedding for a given text using Vertex AI.
 * Model: gemini-embedding-001 (usually 768 dimensions)
 * However, we will aim for the requested 3072 if the API supports it or use the default.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

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

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/text-embedding-004:predict`; 
  // Using text-embedding-004 which is the latest and supports higher dimensions if needed, 
  // although gemini-embedding-001 was requested. text-embedding-004 is generally better.

  const payload = {
    instances: [
      {
        content: text,
        task_type: "RETRIEVAL_DOCUMENT"
      }
    ],
    parameters: {
      outputDimensionality: 3072 // Requested dimension
    }
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
    throw new Error(`Vertex AI API Error: ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  const embedding = data.predictions?.[0]?.embeddings?.values;

  if (!embedding || !Array.isArray(embedding)) {
    throw new Error("Invalid response format from Vertex AI.");
  }

  return embedding;
}
