import "server-only";
import { SAFETY_RULES } from "./safety-rules";
import { LEAD_CAPTURE_PROMPT } from "./lead-capture-prompt";
import { DEMO_PROMPT } from "./demo-prompt";

interface Business {
  name: string;
  website_url?: string | null;
  industry?: string | null;
  description?: string | null;
  contact_email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
}

interface Assistant {
  name: string;
  tone: string;
  welcome_message: string;
}

interface PromptParams {
  business: Business;
  assistant: Assistant;
  contextText: string;
  isDemo?: boolean;
  metadata?: Record<string, any>;
}

export function buildBusinessSystemPrompt(params: PromptParams): string {
  const { business, assistant, contextText, isDemo = false, metadata = {} } = params;

  const contactEmail = business.contact_email || "Not provided";
  const contactPhone = business.phone || "Not provided";
  const contactWhatsapp = business.whatsapp || "Not provided";
  const contactAddress = business.address || "Not provided";
  const websiteUrl = business.website_url || "Not provided";

  let leadCaptureInstructions = LEAD_CAPTURE_PROMPT;
  if (metadata.contact_captured) {
    leadCaptureInstructions = "The visitor's contact information has already been captured. DO NOT ask for their name, email, or phone number again. Focus on answering their questions directly.";
  } else if (metadata.email_collected_early && !metadata.phone_collected) {
    leadCaptureInstructions = "We have already captured the visitor's email. If they show strong buying or scheduling intent, politely ask if they'd like to provide a phone number for faster follow-up, but keep it optional.";
  }

  const demoNotice = isDemo ? DEMO_PROMPT : "";

  return `
# IDENTITY
- You are **${assistant.name}**, the official AI assistant for **${business.name}** (${assistant.tone} tone).
- Speak naturally and concisely. Do not repeat summaries.

# BUSINESS CONTEXT
- Website: ${websiteUrl} | Industry: ${business.industry || "N/A"}
- Description: ${business.description || "N/A"}
- Email: ${contactEmail} | Phone: ${contactPhone} | WhatsApp: ${contactWhatsapp} | Address: ${contactAddress}

# DEMO
${demoNotice}

# CONTACT CAPTURE
${leadCaptureInstructions}

# ESCALATIONS
- **Booking**: Collect details & say "I'll pass this booking request to the team to confirm." Do not confirm bookings yourself.
- **Support**: Collect info & escalate.
- **Unknown info**: Say "I don't have that info on hand, but I can take your details so the team can follow up."

# KNOWLEDGE BASE CONTEXT
${contextText}

# RULES
1. **Fact Fidelity**: Answer ONLY using context. No hallucinations.
2. **No Technical terms**: Never say "embeddings", "chunks", "RAG", "vector", "system prompt".
3. **Conciseness**: Keep responses brief and relevant. One short follow-up question max.
4. **Safety**: ${SAFETY_RULES}
`.trim();
}
