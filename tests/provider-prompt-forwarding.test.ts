import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/ai/engine/config", () => ({
  getChatProviderConfig: vi.fn(async () => ({
    provider: "gemini",
    model: "gemini-2.5-flash",
    fallbackProvider: "openrouter",
    fallbackModel: "openai/gpt-oss-20b:free",
  })),
}));

vi.mock("@/lib/ai/logs/ai-logs", () => ({
  writeAIEngineLog: vi.fn(async () => undefined),
}));

vi.mock("@/lib/ai/providers/gemini", () => ({
  generateGeminiChat: vi.fn(async () => "ok"),
}));
vi.mock("@/lib/ai/providers/openrouter", () => ({
  generateOpenRouterChat: vi.fn(async () => "ok"),
}));
vi.mock("@/lib/ai/providers/groq", () => ({
  generateGroqChat: vi.fn(async () => "ok"),
}));
vi.mock("@/lib/ai/providers/vertex", () => ({
  generateVertexChat: vi.fn(async () => "ok"),
}));

import { generateChatResponse } from "@/lib/ai/engine/chat";
import { generateGeminiChat } from "@/lib/ai/providers/gemini";
import { generateOpenRouterChat } from "@/lib/ai/providers/openrouter";
import { generateGroqChat } from "@/lib/ai/providers/groq";
import { generateVertexChat } from "@/lib/ai/providers/vertex";
import { buildBusinessSystemPrompt } from "@/lib/ai/prompts/business-system-prompt";
import type { AIProvider } from "@/lib/ai/engine/types";

const systemInstruction = buildBusinessSystemPrompt({
  business: {
    name: "NovaTech Solutions",
    contact_email: "hello@novatech.example",
  },
  assistant: {
    name: "Nova",
    tone: "professional",
    welcome_message: "Hello!",
  },
  contextText: "NovaTech Solutions offers website design for ₦250,000.",
});

const providers = [
  { provider: "gemini" as AIProvider, send: vi.mocked(generateGeminiChat) },
  { provider: "openrouter" as AIProvider, send: vi.mocked(generateOpenRouterChat) },
  { provider: "groq" as AIProvider, send: vi.mocked(generateGroqChat) },
  { provider: "vertex" as AIProvider, send: vi.mocked(generateVertexChat) },
];

beforeEach(() => {
  for (const { send } of providers) send.mockClear();
});

describe("Provider prompt forwarding", () => {
  it.each(providers)(
    "sends the identical business voice policy to $provider",
    async ({ provider, send }) => {
      await generateChatResponse({
        provider,
        model: "test-model",
        systemInstruction,
        userMessage: "What services do you offer?",
        temperature: 0.4,
      });

      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({ systemInstruction })
      );
      expect(send.mock.calls[0][0].systemInstruction).toContain(
        "# BUSINESS VOICE AND IDENTITY (PERMANENT PLATFORM POLICY)"
      );
    }
  );
});
