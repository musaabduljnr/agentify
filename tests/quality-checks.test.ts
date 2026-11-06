import { describe, it, expect } from "vitest";
import { runResponseQualityChecks } from "@/lib/ai/evaluation/quality-checks";

const business = {
  contact_email: "hello@novatech.example",
  phone: "+2348000000000",
  whatsapp: null,
  address: "Lagos",
};

const knowledge = [
  "Website design costs ₦250,000.",
  "Mobile applications start from ₦800,000.",
  "Business automation costs ₦150,000.",
  "Maintenance is ₦12,500.50 per month.",
  "Delivery takes 14 working days.",
  "A 50% deposit is required before work begins.",
].join("\n");

function check(reply: string, context = knowledge) {
  return runResponseQualityChecks(reply, business, context);
}

describe("Price verification gate", () => {
  it("accepts an exact naira-symbol price", () => {
    expect(check("Website design costs ₦250,000.").passed).toBe(true);
  });

  it("accepts an exact NGN price with the code before the amount", () => {
    expect(check("Website design costs NGN 250,000.").passed).toBe(true);
  });

  it("accepts the N prefix used in Nigerian pricing", () => {
    expect(check("Website design costs N250,000.").passed).toBe(true);
  });

  it("accepts an exact price with the currency code after the amount", () => {
    expect(check("Website design costs 250,000 NGN.").passed).toBe(true);
  });

  it("accepts an exact price written with the naira word", () => {
    expect(check("Website design costs 250,000 naira.").passed).toBe(true);
  });

  it("accepts decimal price formatting", () => {
    expect(check("Maintenance is ₦12,500.50 per month.").passed).toBe(true);
    expect(check("Maintenance is NGN 12,500.50 per month.").passed).toBe(true);
  });

  it("accepts multiple supported prices in one response", () => {
    expect(check("Website design is ₦250,000 and automation is ₦150,000.").passed).toBe(true);
  });

  it("accepts a correctly calculated total of supported prices", () => {
    expect(check("The total for both services is ₦1,050,000.").passed).toBe(true);
    expect(check("The combined total is 1,050,000 NGN.").passed).toBe(true);
  });

  it("accepts a correctly calculated percentage deposit", () => {
    expect(check("The deposit is ₦125,000.").passed).toBe(true);
  });

  it("accepts a deposit calculated from a supported total", () => {
    expect(check("The total is ₦1,050,000 and the deposit is ₦525,000.").passed).toBe(true);
  });

  it("rejects an incorrectly calculated total", () => {
    const result = check("The total for both services is ₦1,000,000.");
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("unverified_price");
  });

  it("rejects an invented product price", () => {
    const result = check("Our CRM setup costs ₦975,000.");
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("unverified_price");
  });

  it("rejects an unverified bare numerical amount in a price sentence", () => {
    const result = check("The price is 500,000.");
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("unverified_price");
  });

  it("accepts a bare amount that appears in the knowledge context", () => {
    const result = check(
      "Automation costs 150,000.",
      "Business automation costs 150,000."
    );
    expect(result.passed).toBe(true);
  });

  it("does not treat quantities or dates as prices", () => {
    expect(check("Delivery takes 14 working days and we are open Monday to Friday.").passed).toBe(true);
    expect(check("Our pricing plan serves 1,000+ businesses.").passed).toBe(true);
  });

  it("does not accept a numeral laundered into a different currency", () => {
    const result = check("The setup fee is ₦1,234.", "The setup fee is $1,234.");
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("unverified_price");
  });

  it("rejects a response when any one of several prices is unsupported", () => {
    const result = check("Website design is ₦250,000 and hosting is ₦90,000.");
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("unverified_price");
  });
});

describe("Existing quality checks stay in force", () => {
  it("rejects hallucinated email addresses", () => {
    const result = check("Email us at fake@elsewhere.test.");
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("hallucinated_email");
  });

  it("rejects hallucinated phone numbers", () => {
    const result = check("Call us on 0803 555 0199.");
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("hallucinated_phone");
  });

  it("rejects system prompt leakage", () => {
    const result = check("As per the system prompt, I must answer only from context.");
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("system_prompt_leakage");
  });

  it("rejects retrieval internals", () => {
    const result = check("The retrieved document has a high similarity score.");
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("technical_rag_leakage");
  });

  it("rejects empty responses", () => {
    const result = check("   ");
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("empty_response");
  });

  it("rejects oversized responses", () => {
    const result = check("word ".repeat(600));
    expect(result.passed).toBe(false);
    expect(result.reason).toBe("response_too_long");
  });
});
