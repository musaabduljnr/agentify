import "server-only";

/**
 * Detects if a user message shows buying or contact intent.
 */
export function detectLeadIntent(message: string): boolean {
  const buyingIntentPhrases = [
    "i want to hire you",
    "how much",
    "pricing",
    "quote",
    "book a call",
    "contact me",
    "interested",
    "consultation",
    "let's work together",
    "i need your service",
    "can you help me",
    "i want to buy",
    "purchase",
    "cost",
    "book an appointment",
    "schedule a meeting",
    "how to register",
    "pricing options",
  ];

  const lowerMsg = message.toLowerCase();
  return buyingIntentPhrases.some((phrase) => lowerMsg.includes(phrase));
}

/**
 * Extracts contact information from a text string.
 * Supports international and Nigerian phone formats.
 */
export function extractLeadInfo(text: string) {
  if (!text) return { email: null, phone: null, name: null };

  const emailRegex = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/gi;
  
  // Matches Nigerian formats: 070X, 080X, 081X, 090X, 091X (optional +234/234) and standard international formats
  const phoneRegex = /(?:\+?234|0)[789][01]\d{8}\b|\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/g;

  const emails = text.match(emailRegex);
  
  const rawPhones = text.match(phoneRegex) || [];
  // Filter out short matches that are probably years or codes
  const phones = rawPhones
    .map(p => p.trim())
    .filter(p => p.replace(/[^0-9]/g, "").length >= 7);

  // Name detection patterns: "my name is [Name]", "I am [Name]", "this is [Name]", "call me [Name]"
  let name: string | null = null;
  const namePatterns = [
    /(?:my name is|i am|this is|call me)\s+([A-Z][a-zA-Z'-]*(?:\s+[A-Z][a-zA-Z'-]*)*)/i,
    /hello,\s+i'm\s+([A-Z][a-zA-Z'-]*(?:\s+[A-Z][a-zA-Z'-]*)*)/i,
    /hi,\s+i'm\s+([A-Z][a-zA-Z'-]*(?:\s+[A-Z][a-zA-Z'-]*)*)/i,
  ];

  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Exclude matches that are obviously not names (e.g. "interested", "ready")
      const candidate = match[1].trim();
      const forbidden = ["interested", "ready", "here", "fine", "good", "okay", "trying", "looking"];
      if (!forbidden.includes(candidate.toLowerCase())) {
        name = candidate;
        break;
      }
    }
  }

  return {
    email: emails ? emails[0] : null,
    phone: phones ? phones[0] : null,
    name: name,
  };
}

export type IntentType = 
  | "sales" 
  | "booking" 
  | "support_ticket" 
  | "complaint" 
  | "pricing" 
  | "consultation" 
  | "general_inquiry";

/**
 * Detects the specific intent type of a conversation.
 */
export function detectConversationIntent(message: string): {
  intentType: IntentType;
  confidence: number;
  requestedAction: string | null;
} {
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes("book") || lowerMsg.includes("appointment") || lowerMsg.includes("schedule") || lowerMsg.includes("reserve")) {
    return { intentType: "booking", confidence: 0.9, requestedAction: "Schedule appointment" };
  }

  if (lowerMsg.includes("support") || lowerMsg.includes("issue") || lowerMsg.includes("problem") || lowerMsg.includes("ticket") || lowerMsg.includes("not working") || lowerMsg.includes("help with")) {
    return { intentType: "support_ticket", confidence: 0.9, requestedAction: "Technical support" };
  }

  if (lowerMsg.includes("complaint") || lowerMsg.includes("angry") || lowerMsg.includes("bad service") || lowerMsg.includes("disappointed")) {
    return { intentType: "complaint", confidence: 0.8, requestedAction: "Escalate complaint" };
  }

  if (lowerMsg.includes("pricing") || lowerMsg.includes("cost") || lowerMsg.includes("how much") || lowerMsg.includes("quote") || lowerMsg.includes("price")) {
    return { intentType: "pricing", confidence: 0.9, requestedAction: "Request pricing" };
  }

  if (lowerMsg.includes("hire") || lowerMsg.includes("work together") || lowerMsg.includes("buy") || lowerMsg.includes("purchase") || lowerMsg.includes("sign up")) {
    return { intentType: "sales", confidence: 0.8, requestedAction: "Sales inquiry" };
  }

  if (lowerMsg.includes("consultation") || lowerMsg.includes("expert") || lowerMsg.includes("advice")) {
    return { intentType: "consultation", confidence: 0.8, requestedAction: "Request consultation" };
  }

  return { intentType: "general_inquiry", confidence: 0.5, requestedAction: null };
}
