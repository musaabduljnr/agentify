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
  ];

  const lowerMsg = message.toLowerCase();
  return buyingIntentPhrases.some((phrase) => lowerMsg.includes(phrase));
}

/**
 * Extracts contact information from a text string.
 */
export function extractLeadInfo(text: string) {
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
  const phoneRegex = /(\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9})/g;

  const emails = text.match(emailRegex);
  const phones = text.match(phoneRegex);

  // Basic name detection (heuristic: "my name is [Name]" or "I am [Name]")
  let name = null;
  const nameMatch = text.match(/(?:my name is|i am|this is|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (nameMatch) {
    name = nameMatch[1];
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

  if (lowerMsg.includes("support") || lowerMsg.includes("issue") || lowerMsg.includes("problem") || lowerMsg.includes("ticket") || lowerMsg.includes("not working")) {
    return { intentType: "support_ticket", confidence: 0.9, requestedAction: "Technical support" };
  }

  if (lowerMsg.includes("complaint") || lowerMsg.includes("angry") || lowerMsg.includes("bad service")) {
    return { intentType: "complaint", confidence: 0.8, requestedAction: "Escalate complaint" };
  }

  if (lowerMsg.includes("pricing") || lowerMsg.includes("cost") || lowerMsg.includes("how much") || lowerMsg.includes("quote")) {
    return { intentType: "pricing", confidence: 0.9, requestedAction: "Request pricing" };
  }

  if (lowerMsg.includes("hire") || lowerMsg.includes("work together") || lowerMsg.includes("buy") || lowerMsg.includes("purchase")) {
    return { intentType: "sales", confidence: 0.8, requestedAction: "Sales inquiry" };
  }

  if (lowerMsg.includes("consultation") || lowerMsg.includes("expert") || lowerMsg.includes("advice")) {
    return { intentType: "consultation", confidence: 0.8, requestedAction: "Request consultation" };
  }

  return { intentType: "general_inquiry", confidence: 0.5, requestedAction: null };
}
