export async function generateVertexChat({
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
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  if (!projectId || projectId.includes("placeholder")) {
    throw new Error("Vertex AI is not configured. Please set GOOGLE_CLOUD_PROJECT_ID in environment variables.");
  }

  // Placeholder for GCP IAM token authentication & Vertex REST API call
  throw new Error("Vertex AI integration is in staging mode. Please configure GCP IAM Service Account keys to proceed.");
}

export async function generateVertexEmbedding({
  model,
  text,
}: {
  model: string;
  text: string;
}): Promise<number[]> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  if (!projectId || projectId.includes("placeholder")) {
    throw new Error("Vertex AI Embeddings are not configured. Please set GOOGLE_CLOUD_PROJECT_ID.");
  }

  throw new Error("Vertex Embeddings integration is in staging mode. Please configure GCP IAM Service Account keys to proceed.");
}
