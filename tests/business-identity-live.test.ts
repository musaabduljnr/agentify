import { describe, it, expect } from "vitest";
import { generateGeminiChat } from "@/lib/ai/providers/gemini";
import { buildBusinessSystemPrompt } from "@/lib/ai/prompts/business-system-prompt";

// Opt-in only: makes real Gemini calls and requires credentials.
// Run with: RUN_LIVE_AI_TESTS=1 GEMINI_API_KEY=... npx vitest run tests/business-identity-live.test.ts --pool=threads
const liveEnabled =
  process.env.RUN_LIVE_AI_TESTS === "1" && Boolean(process.env.GEMINI_API_KEY);

const systemInstruction = buildBusinessSystemPrompt({
  business: {
    name: "NovaTech Solutions",
    contact_email: "hello@novatech.example",
    phone: "+2348000000000",
    address: "12 Marina Road, Lagos",
    industry: "Software development",
    description: "NovaTech Solutions builds websites, mobile apps, and business automation.",
  },
  assistant: {
    name: "Nova",
    tone: "professional",
    welcome_message: "Hello! How can I help you today?",
  },
  contextText: [
    "NovaTech Solutions offers website design for ₦250,000.",
    "NovaTech Solutions offers mobile app development from ₦800,000.",
    "NovaTech Solutions offers business automation for ₦150,000.",
    "Website delivery takes 14 working days after the requirements and content are received.",
    "A 50% deposit is required before work begins.",
    "You can contact NovaTech Solutions at hello@novatech.example.",
    "Working hours are Monday to Friday, 9am to 5pm.",
    "NovaTech Solutions integrates with Paystack for payments. Paystack is a separate company.",
  ].join("\n"),
});

const cases = [
  {
    question: "What services do you offer?",
    expected: [/website design/i, /mobile app/i, /automation/i],
    forbidden: [] as RegExp[],
  },
  {
    question: "How much does website design cost?",
    expected: [/₦\s?250,000/],
    forbidden: [] as RegExp[],
  },
  {
    question: "What are your working hours?",
    expected: [/Monday/i, /Friday/i, /9/i, /5/i],
    forbidden: [] as RegExp[],
  },
  {
    question: "Do you require a deposit?",
    expected: [/50%/],
    forbidden: [] as RegExp[],
  },
  {
    question: "How can I contact the company?",
    expected: [/hello@novatech\.example/i],
    forbidden: [] as RegExp[],
  },
  {
    question: "How long does your website development take?",
    expected: [/14\s+working days/i],
    forbidden: [] as RegExp[],
  },
  {
    question: "Do you offer mobile app development?",
    expected: [/₦\s?800,000/],
    forbidden: [] as RegExp[],
  },
  {
    question: "Can you explain your business automation service?",
    expected: [/₦\s?150,000/],
    forbidden: [] as RegExp[],
  },
  {
    question: "Do you integrate with Paystack?",
    expected: [/Paystack/i],
    forbidden: [/we (?:developed|created|founded) Paystack/i],
  },
];

describe.skipIf(!liveEnabled)("NovaTech live first-person generation", () => {
  it.each(cases)(
    "$question",
    async ({ question, expected, forbidden }) => {
      const reply = await generateGeminiChat({
        model: process.env.LIVE_GEMINI_MODEL || "gemini-2.5-flash",
        systemInstruction,
        userMessage: question,
        temperature: 0.2,
        maxOutputTokens: 400,
      });

      expect(reply).toMatch(/\b(we|our|us)\b/i);
      expect(reply).not.toMatch(/NovaTech Solutions (?:offers|provides|charges)/i);
      expect(reply).not.toMatch(/\b(?:the company|the business) (?:offers|provides|charges)\b/i);
      for (const pattern of expected) expect(reply).toMatch(pattern);
      for (const pattern of forbidden) expect(reply).not.toMatch(pattern);
    },
    60000
  );
});
