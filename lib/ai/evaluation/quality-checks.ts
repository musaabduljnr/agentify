import "server-only";

const FALLBACK_MESSAGE = "I don’t have enough information to answer that accurately, but I can collect your details so the business can follow up.";

interface Business {
  contact_email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
}

export function runResponseQualityChecks(
  text: string,
  business: Business,
  contextText: string
): { passed: boolean; sanitizedText: string; reason?: string } {
  if (!text || text.trim().length === 0) {
    return { passed: false, sanitizedText: FALLBACK_MESSAGE, reason: "empty_response" };
  }

  const lowerText = text.toLowerCase();

  // 1. System Prompt Leakage check
  const systemPromptKeywords = [
    "system instruction",
    "hidden instruction",
    "system prompt",
    "hidden rule",
    "prompt injection",
    "developer rule",
    "instructions above",
    "ignore previous instructions",
  ];
  if (systemPromptKeywords.some((keyword) => lowerText.includes(keyword))) {
    return { passed: false, sanitizedText: FALLBACK_MESSAGE, reason: "system_prompt_leakage" };
  }

  // 2. RAG/Embeddings Technical Leakage check
  const technicalKeywords = [
    "chunk",
    "embedding",
    "vector search",
    "retrieved context",
    "retrieved document",
    "knowledge base context",
    "document context",
    "similarity score",
  ];
  if (technicalKeywords.some((keyword) => lowerText.includes(keyword))) {
    return { passed: false, sanitizedText: FALLBACK_MESSAGE, reason: "technical_rag_leakage" };
  }

  // 3. Excessive response length check
  if (text.length > 2500) {
    return { passed: false, sanitizedText: FALLBACK_MESSAGE, reason: "response_too_long" };
  }

  // 4. Hallucinated Contact Information check
  // Extract emails in response
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
  const responseEmails = text.match(emailRegex) || [];

  for (const email of responseEmails) {
    const cleanEmail = email.toLowerCase().trim();
    const isBizEmail = business.contact_email && business.contact_email.toLowerCase().includes(cleanEmail);
    const isInContext = contextText && contextText.toLowerCase().includes(cleanEmail);

    if (!isBizEmail && !isInContext) {
      console.warn(`[Quality Check] Hallucinated email detected: ${email}`);
      return { passed: false, sanitizedText: FALLBACK_MESSAGE, reason: "hallucinated_email" };
    }
  }

  // Extract phone numbers (minimum 7 digits to avoid matching years/timestamps)
  const phoneRegex = /(\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{3,4}[-.\s]?\d{4})/g;
  const responsePhones = text.match(phoneRegex) || [];

  for (const phone of responsePhones) {
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    if (cleanPhone.length >= 7) {
      const bizPhone = business.phone ? business.phone.replace(/[^0-9]/g, "") : "";
      const bizWhatsapp = business.whatsapp ? business.whatsapp.replace(/[^0-9]/g, "") : "";
      const contextPhones = contextText ? contextText.replace(/[^0-9]/g, "") : "";

      const isBizPhone = bizPhone && bizPhone.includes(cleanPhone);
      const isBizWhatsapp = bizWhatsapp && bizWhatsapp.includes(cleanPhone);
      const isInContext = contextPhones && contextPhones.includes(cleanPhone);

      if (!isBizPhone && !isBizWhatsapp && !isInContext) {
        console.warn(`[Quality Check] Hallucinated phone detected: ${phone}`);
        return { passed: false, sanitizedText: FALLBACK_MESSAGE, reason: "hallucinated_phone" };
      }
    }
  }

  return { passed: true, sanitizedText: text };
}
