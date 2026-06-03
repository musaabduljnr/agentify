import "server-only";
import { type RetrievedChunk } from "./retrieve-context";
import { type QueryIntent } from "../intent/classify-query";

export function scoreChunkRelevance(
  chunk: RetrievedChunk,
  intent: QueryIntent,
  query: string
): number {
  let boost = 0;
  const content = chunk.content.toLowerCase();
  const title = (chunk.metadata?.source_title || "").toLowerCase();
  const type = (chunk.metadata?.source_type || "").toLowerCase();

  // 1. FAQ priority boost
  if (type === "faq") {
    boost += 0.05; // Base boost for clean FAQ question/answer structures
    
    // Exact or near matching question query
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    let matchedWords = 0;
    for (const word of words) {
      if (title.includes(word)) {
        matchedWords++;
      }
    }
    if (words.length > 0 && (matchedWords / words.length) >= 0.5) {
      boost += 0.15; // Significant boost if question matches query keyword words
    }
  }

  // 2. Intent-specific keyword boosts
  switch (intent) {
    case "pricing":
      if (
        content.includes("price") ||
        content.includes("cost") ||
        content.includes("ngn") ||
        content.includes("₦") ||
        content.includes("fee") ||
        content.includes("subscription") ||
        content.includes("package") ||
        content.includes("plan")
      ) {
        boost += 0.15;
      }
      break;

    case "booking":
      if (
        content.includes("book") ||
        content.includes("appointment") ||
        content.includes("schedule") ||
        content.includes("reserve") ||
        content.includes("slot") ||
        content.includes("meeting")
      ) {
        boost += 0.15;
      }
      break;

    case "refund":
      if (
        content.includes("refund") ||
        content.includes("return") ||
        content.includes("cancel") ||
        content.includes("money back") ||
        content.includes("policy")
      ) {
        boost += 0.15;
      }
      break;

    case "contact":
      if (
        content.includes("email") ||
        content.includes("phone") ||
        content.includes("whatsapp") ||
        content.includes("call") ||
        content.includes("number") ||
        content.includes("contact")
      ) {
        boost += 0.15;
      }
      break;

    case "business_hours":
      if (
        content.includes("hour") ||
        content.includes("open") ||
        content.includes("close") ||
        content.includes("time") ||
        content.includes("schedule")
      ) {
        boost += 0.15;
      }
      break;

    case "location":
      if (
        content.includes("address") ||
        content.includes("located") ||
        content.includes("street") ||
        content.includes("where") ||
        content.includes("branch") ||
        content.includes("office")
      ) {
        boost += 0.15;
      }
      break;

    case "shipping":
      if (
        content.includes("ship") ||
        content.includes("deliver") ||
        content.includes("delivery") ||
        content.includes("courier") ||
        content.includes("post") ||
        content.includes("tracking")
      ) {
        boost += 0.15;
      }
      break;

    case "sales":
      if (
        content.includes("buy") ||
        content.includes("purchase") ||
        content.includes("order") ||
        content.includes("hire") ||
        content.includes("deal") ||
        content.includes("discount")
      ) {
        boost += 0.1;
      }
      break;
      
    case "support":
      if (
        content.includes("help") ||
        content.includes("issue") ||
        content.includes("problem") ||
        content.includes("broken") ||
        content.includes("error") ||
        content.includes("reset")
      ) {
        boost += 0.1;
      }
      break;
  }

  return boost;
}
