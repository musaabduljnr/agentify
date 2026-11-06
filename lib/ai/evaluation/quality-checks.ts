import "server-only";

const FALLBACK_MESSAGE = "I don’t have enough information to answer that accurately, but I can collect your details so the business can follow up.";

interface Business {
  contact_email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
}

export interface QualityCheckResult {
  passed: boolean;
  sanitizedText: string;
  reason?: string;
}

export function runResponseQualityChecks(
  text: string,
  business: Business,
  contextText: string
): QualityCheckResult {
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

  // 5. Unverified price check
  // Every monetary claim in the reply must be supported by the retrieved
  // knowledge, either as an exact amount or as a value derived from supported
  // amounts (totals and percentage deposits). Formatting differences between
  // ₦, NGN, N and currency codes must not change the verdict.
  const context = contextText || "";
  const evidence = extractMoneyAmounts(context);
  const contextNumbers = new Set(extractNumericTokens(context).map((token) => token.value));
  const multipliers = extractMultipliers(context);

  const replyMoney = extractMoneyAmounts(text);
  const replyNumbers = extractNumericTokens(text);

  for (const amount of replyMoney) {
    if (isExactEvidence(amount, evidence)) continue;
    if (isDerivedMoney(amount, evidence, multipliers)) continue;
    console.warn(`[Quality Check] Unverified price detected: ${formatMoney(amount)}`);
    return { passed: false, sanitizedText: FALLBACK_MESSAGE, reason: "unverified_price" };
  }

  // Bare amounts are only treated as monetary claims when they are written like
  // prices (thousands separators or large values) and sit next to price wording.
  // This catches format-laundered figures without flagging dates or quantities.
  for (const token of replyNumbers) {
    if (replyMoney.some((amount) => overlaps(token, amount))) continue;
    if (!looksLikeBarePrice(token)) continue;
    if (QUANTITY_UNIT_REGEX.test(text.slice(token.end, token.end + 24))) continue;
    if (!hasPriceTrigger(text, token.index, token.end)) continue;
    if (contextNumbers.has(token.value)) continue;
    if (isDerivedNumeric(token.value, evidence, multipliers)) continue;

    console.warn(`[Quality Check] Unverified bare amount detected: ${token.raw}`);
    return { passed: false, sanitizedText: FALLBACK_MESSAGE, reason: "unverified_price" };
  }

  return { passed: true, sanitizedText: text };
}

type CurrencyCode = "NGN" | "USD" | "EUR" | "GBP";

interface MoneyAmount {
  value: number;
  currency: CurrencyCode | null;
  index: number;
  end: number;
}

interface NumericToken {
  value: number;
  raw: string;
  index: number;
  end: number;
}

const NUMBER_PATTERN = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`;
const CURRENCY_CODE_PATTERN = String.raw`NGN|USD|EUR|GBP|naira|dollars?|euros?|pounds?`;
const PREFIX_CURRENCY_REGEX = new RegExp(
  String.raw`(?:(₦|\$|€|£|\b[Nn])\s*(${NUMBER_PATTERN}))|(?:\b(${CURRENCY_CODE_PATTERN})\s*(${NUMBER_PATTERN}))`,
  "gi"
);
const SUFFIX_CURRENCY_REGEX = new RegExp(
  String.raw`(${NUMBER_PATTERN})\s*\b(${CURRENCY_CODE_PATTERN})\b`,
  "gi"
);
const NUMERIC_TOKEN_REGEX = new RegExp(NUMBER_PATTERN, "gi");
const PERCENTAGE_REGEX = /(\d+(?:\.\d+)?)\s*%/g;
const DECIMAL_FRACTION_REGEX = /\b0\.\d+\b/g;
const PRICE_TRIGGER_REGEX =
  /\b(?:costs?|prices?|priced|pricing|fees?|charges?|deposits?|totals?|amounts?|pays?|payments?|budget|rates?|quotes?|starting|starts?|from)\b|₦|naira|ngn/i;
const QUANTITY_UNIT_REGEX =
  /^\s*\+?\s*(?:users?|customers?|businesses?|clients?|projects?|days?|hours?|weeks?|months?|years?|people|messages?|conversations?|employees?|staff|countries?)\b/i;
const AMOUNT_TOLERANCE = 0.005;

function normalizeCurrency(token: string): CurrencyCode | null {
  const normalized = token.toLowerCase();
  if (normalized === "₦" || normalized === "n" || normalized === "ngn" || normalized === "naira") {
    return "NGN";
  }
  if (normalized === "$" || normalized === "usd" || normalized === "dollar" || normalized === "dollars") {
    return "USD";
  }
  if (normalized === "€" || normalized === "eur" || normalized === "euro" || normalized === "euros") {
    return "EUR";
  }
  if (normalized === "£" || normalized === "gbp" || normalized === "pound" || normalized === "pounds") {
    return "GBP";
  }
  return null;
}

function parseAmount(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

function amountsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= AMOUNT_TOLERANCE;
}

function formatMoney(amount: MoneyAmount): string {
  return `${amount.currency ?? "unknown"} ${amount.value}`;
}

function overlaps(a: { index: number; end: number }, b: { index: number; end: number }): boolean {
  return a.index < b.end && a.end > b.index;
}

function extractMoneyAmounts(source: string): MoneyAmount[] {
  const matches: MoneyAmount[] = [];

  for (const match of source.matchAll(PREFIX_CURRENCY_REGEX)) {
    const token = match[1] || match[3] || "";
    const raw = match[2] || match[4] || "";
    const currency = normalizeCurrency(token);
    if (!currency || !raw) continue;
    const index = match.index ?? 0;
    matches.push({
      value: parseAmount(raw),
      currency,
      index,
      end: index + match[0].length,
    });
  }

  for (const match of source.matchAll(SUFFIX_CURRENCY_REGEX)) {
    const raw = match[1] || "";
    const currency = normalizeCurrency(match[2] || "");
    if (!currency || !raw) continue;
    const index = match.index ?? 0;
    matches.push({
      value: parseAmount(raw),
      currency,
      index,
      end: index + match[0].length,
    });
  }

  matches.sort((a, b) => a.index - b.index || b.end - b.index - (a.end - a.index));

  const deduped: MoneyAmount[] = [];
  for (const match of matches) {
    const previous = deduped[deduped.length - 1];
    if (previous && overlaps(match, previous)) {
      if (match.end - match.index > previous.end - previous.index) {
        deduped[deduped.length - 1] = match;
      }
      continue;
    }
    deduped.push(match);
  }

  return deduped;
}

function extractNumericTokens(source: string): NumericToken[] {
  return [...source.matchAll(NUMERIC_TOKEN_REGEX)].map((match) => {
    const raw = match[0];
    const index = match.index ?? 0;
    return {
      value: parseAmount(raw),
      raw,
      index,
      end: index + raw.length,
    };
  });
}

function extractMultipliers(context: string): number[] {
  const multipliers = new Set<number>();

  for (const match of context.matchAll(PERCENTAGE_REGEX)) {
    const percentage = Number(match[1]);
    if (percentage > 0 && percentage <= 100) {
      multipliers.add(percentage / 100);
    }
  }

  for (const match of context.matchAll(DECIMAL_FRACTION_REGEX)) {
    const fraction = Number(match[0]);
    if (fraction > 0 && fraction < 1) {
      multipliers.add(fraction);
    }
  }

  return [...multipliers];
}

function uniqueEvidence(evidence: MoneyAmount[]): MoneyAmount[] {
  const seen = new Set<string>();
  return evidence.filter((amount) => {
    const key = `${amount.currency ?? "none"}:${amount.value.toFixed(2)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isExactEvidence(amount: MoneyAmount, evidence: MoneyAmount[]): boolean {
  return evidence.some(
    (candidate) =>
      amountsEqual(candidate.value, amount.value) &&
      (candidate.currency === null || candidate.currency === amount.currency)
  );
}

// Sums may only combine distinct supported amounts, so one price cannot be
// counted twice to manufacture a larger figure.
function possibleSums(evidence: MoneyAmount[], limit: number): Array<{ value: number; currency: CurrencyCode | null }> {
  const supported = uniqueEvidence(evidence);
  const sums: Array<{ value: number; currency: CurrencyCode | null }> = [];

  const addSum = (left: MoneyAmount, right: MoneyAmount) => {
    if (left.currency && right.currency && left.currency !== right.currency) return;
    sums.push({
      value: left.value + right.value,
      currency: left.currency ?? right.currency ?? null,
    });
  };

  for (let i = 0; i < supported.length && sums.length < limit; i++) {
    for (let j = i + 1; j < supported.length && sums.length < limit; j++) {
      addSum(supported[i], supported[j]);

      for (let k = j + 1; k < supported.length && sums.length < limit; k++) {
        const pairCurrency = supported[i].currency ?? supported[j].currency;
        if (supported[i].currency && supported[j].currency && supported[i].currency !== supported[j].currency) {
          continue;
        }
        if (pairCurrency && supported[k].currency && pairCurrency !== supported[k].currency) continue;
        sums.push({
          value: supported[i].value + supported[j].value + supported[k].value,
          currency: pairCurrency ?? supported[k].currency ?? null,
        });
      }
    }
  }

  return sums;
}

function isDerivedMoney(amount: MoneyAmount, evidence: MoneyAmount[], multipliers: number[]): boolean {
  for (const supported of uniqueEvidence(evidence)) {
    if (supported.currency !== amount.currency) continue;
    for (const multiplier of multipliers) {
      if (amountsEqual(supported.value * multiplier, amount.value)) return true;
    }
  }

  for (const sum of possibleSums(evidence, 500)) {
    if (sum.currency !== amount.currency) continue;
    if (amountsEqual(sum.value, amount.value)) return true;
    for (const multiplier of multipliers) {
      if (amountsEqual(sum.value * multiplier, amount.value)) return true;
    }
  }

  return false;
}

function isDerivedNumeric(value: number, evidence: MoneyAmount[], multipliers: number[]): boolean {
  for (const supported of uniqueEvidence(evidence)) {
    for (const multiplier of multipliers) {
      if (amountsEqual(supported.value * multiplier, value)) return true;
    }
  }

  for (const sum of possibleSums(evidence, 500)) {
    if (amountsEqual(sum.value, value)) return true;
    for (const multiplier of multipliers) {
      if (amountsEqual(sum.value * multiplier, value)) return true;
    }
  }

  return false;
}

function looksLikeBarePrice(token: NumericToken): boolean {
  if (token.raw.includes(",")) return true;
  const integerDigits = token.raw.split(".")[0].length;
  if (integerDigits >= 5) return true;
  if (integerDigits === 4) {
    return !(token.value >= 1900 && token.value <= 2100);
  }
  return false;
}

function hasPriceTrigger(text: string, index: number, end: number): boolean {
  return PRICE_TRIGGER_REGEX.test(text.slice(Math.max(0, index - 60), Math.min(text.length, end + 60)));
}
