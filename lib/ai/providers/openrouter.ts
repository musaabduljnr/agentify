export async function generateOpenRouterChat({
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
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY in environment variables.");
  }

  // Format messages for OpenAI standard compatibility
  const messages = [
    { role: "system", content: systemInstruction },
    ...history.map((msg) => ({
      role: msg.role === "model" ? ("assistant" as const) : ("user" as const),
      content: msg.content,
    })),
    { role: "user", content: userMessage },
  ];

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://agentify.com", // Optional OpenRouter site identifier
      "X-Title": "Agentify AI",
    },
    body: JSON.stringify({
      model: model || "meta-llama/llama-3.1-8b-instruct:free",
      messages,
      temperature,
    }),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error?.message || data.message || "Failed to call OpenRouter API.");
  }

  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("Invalid response format from OpenRouter.");
  }

  return text;
}
