const DEFAULT_OPENROUTER_MODEL = "openai/gpt-oss-20b:free";
const DEPRECATED_OPENROUTER_MODELS = new Set([
  "meta-llama/llama-3.1-8b-instruct:free",
  "google/gemini-2.0-flash-exp:free",
  "mistralai/mistral-7b-instruct:free",
]);

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

  const requestedModel = model || DEFAULT_OPENROUTER_MODEL;
  const selectedModel = DEPRECATED_OPENROUTER_MODELS.has(requestedModel)
    ? DEFAULT_OPENROUTER_MODEL
    : requestedModel;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://agentifyhq.vercel.app",
      "X-Title": "Agentify AI",
    },
    body: JSON.stringify({
      model: selectedModel,
      messages,
      temperature,
    }),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    const message = data.error?.message || data.message || "Failed to call OpenRouter API.";
    if (/no endpoints found/i.test(message)) {
      throw new Error(
        `OpenRouter could not find an active endpoint for "${selectedModel}". Choose another OpenRouter model in Admin > AI Engine, or use "openai/gpt-oss-20b:free" as the default.`
      );
    }
    throw new Error(message);
  }

  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("Invalid response format from OpenRouter.");
  }

  return text;
}
