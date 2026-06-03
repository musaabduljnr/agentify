import "server-only";

export type QueryIntent =
  | "pricing"
  | "product"
  | "service"
  | "booking"
  | "support"
  | "refund"
  | "shipping"
  | "contact"
  | "business_hours"
  | "location"
  | "sales"
  | "complaint"
  | "general";

const INTENT_RULES: { intent: QueryIntent; regex: RegExp }[] = [
  {
    intent: "pricing",
    regex: /\b(price|pricing|cost|how much|fee|fees|rate|rates|charge|subscription|cheap|expensive|package|plan|plans|payment)\b/i,
  },
  {
    intent: "booking",
    regex: /\b(book|booking|appointment|schedule|reserve|reservation|slot|slots|meeting|calendar|time slot)\b/i,
  },
  {
    intent: "refund",
    regex: /\b(refund|money back|return policy|return|chargeback|cancellation|cancel plan|cancel subscription)\b/i,
  },
  {
    intent: "shipping",
    regex: /\b(ship|shipping|deliver|delivery|post|postage|mail|package|transit|tracking|track order)\b/i,
  },
  {
    intent: "contact",
    regex: /\b(contact|email|phone|whatsapp|number|call|reach|support email|phone number|representative|human|speak to)\b/i,
  },
  {
    intent: "business_hours",
    regex: /\b(hours|operating hours|business hours|open|close|opening time|closing time|when are you open|weekday|weekend)\b/i,
  },
  {
    intent: "location",
    regex: /\b(location|address|where|where are you|find us|branch|office|store|headquarters|coordinates|map)\b/i,
  },
  {
    intent: "sales",
    regex: /\b(buy|purchase|order|checkout|cart|shop|hire|deal|discount|coupon|promo|interest|interested)\b/i,
  },
  {
    intent: "complaint",
    regex: /\b(complaint|complain|worst|bad|fault|annoyed|broken|broken link|awful|terrible|slow|disappointed|unsatisfied)\b/i,
  },
  {
    intent: "support",
    regex: /\b(support|help|issue|problem|broken|fail|error|bug|crash|stuck|reset|password|account|login)\b/i,
  },
  {
    intent: "product",
    regex: /\b(product|products|item|items|goods|catalog|inventory|feature|features|spec|specs|specification)\b/i,
  },
  {
    intent: "service",
    regex: /\b(service|services|offer|offers|offerings|consult|consultation|expert|consulting|work|do you do)\b/i,
  },
];

export function classifyQueryIntent(query: string): QueryIntent {
  if (!query) return "general";
  const cleaned = query.trim().toLowerCase();

  for (const rule of INTENT_RULES) {
    if (rule.regex.test(cleaned)) {
      return rule.intent;
    }
  }

  return "general";
}
