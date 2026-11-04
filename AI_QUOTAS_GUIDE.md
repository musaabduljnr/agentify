# Agentify AI Quotas & Calculations Guide

This guide explains how AI message quotas, vector embedding limits, API rate limits, and cost calculations are structured across the platform's billing plans and configured AI models.

---

## 1. Platform Subscription Quotas

Each customer business profile is bound to a subscription plan tier. AI replies and lead capture are counted per verified billing cycle. Knowledge-source and assistant limits are caps on resources currently attached to the business. A new billing period begins only after a successful, provider-verified payment.

| Plan Tier | Price (Monthly) | AI Replies / Billing Cycle | Assistants / Widgets | Knowledge Sources | Leads / Billing Cycle | Embeddings |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Starter** | $2 USD | 200 replies | 1 | 25 | 50 | 5,000 chunks |
| **Growth** | $10 USD | 1,500 replies | 3 | 100 | Unlimited | 50,000 chunks |
| **Enterprise** | Custom | Custom volume | Custom | Custom | Unlimited | Custom |

### Quota Consumption Triggers
- **AI Replies**: One unit is consumed after an AI reply is successfully generated and saved. Widget, hosted-chat, and dashboard chat requests share the same business-level monthly quota. Failed generations do not count.
- **Assistants and widgets**: Each assistant counts toward the plan's business-level cap.
- **Knowledge sources**: Each website, document, FAQ, or manual source counts as one source. Pages crawled and embeddings generated do not create extra sources.
- **Leads**: A newly captured lead counts once per billing cycle. Updating an existing lead does not count again. Growth leads are unlimited.
- **Embeddings**: Consumed when trained knowledge is processed. Each text chunk counts as one vector embedding.

---

## 2. Hit-Limit Runout Estimations

To estimate how long the monthly reply quota will last based on daily successful AI replies:

$$\text{Days Before Limit} = \frac{\text{Plan Message Limit}}{\text{Average Chat Messages Per Day}}$$

### Estimations Grid (Days of Operations)

| Successful replies / day | Starter (200 / cycle) | Growth (1,500 / cycle) |
| :--- | :--- | :--- |
| **5 replies/day** | 40 days | 300 days |
| **20 replies/day** | 10 days | 75 days |
| **50 replies/day** | 4 days | 30 days |
| **100 replies/day** | 2 days | 15 days |
| **200 replies/day** | 1 day | 7.5 days |
| **500 replies/day** | Less than 1 day | 3 days |

> [!TIP]
> The billing-cycle quota is authoritative. Usage resets only at the start of a verified billing period.

---

## 3. Underlying LLM Provider Quotas & Rate Limits

Apart from platform subscription quotas, the AI engine is subject to limits enforced by external providers. The system automatically falls back to secondary options if these are exceeded.

### A. Gemini (Google) - Primary Provider
- **Free Tier (for development keys)**:
  - 15 Requests Per Minute (RPM)
  - 1,000,000 Tokens Per Minute (TPM)
  - 1,500 Requests Per Day (RPD)
- **Pay-as-you-go / Enterprise**:
  - Up to 3,000 Requests Per Minute (RPM).
- **Auto-Failover Logic**: If the AI hits a `429 (Resource Exhausted)` error, the platform retries the call on fallback model candidates (e.g. `gemini-2.5-flash-lite` or `gemini-2.0-flash`).

### B. Groq (LPU Speed)
- Typically limits free development keys to:
  - 30 Requests Per Minute (RPM)
  - 14,400 Requests Per Day (RPD)

### C. OpenRouter (Multi-Model Hub)
- The default model `openai/gpt-oss-20b:free` is subject to OpenRouter global free quotas (typically 10-20 RPM).

---

## 4. Token & Cost Margin Calculations

For a typical AI assistant request, the input payload includes:
1. **System Instructions & Tone rules**: ~1,000 tokens
2. **Retrieved RAG Context** (5 chunks of 500 words): ~3,300 tokens
3. **Conversation Memory** (last 8 messages): ~1,500 tokens
4. **User message**: ~100 tokens
5. **Total Input size**: **~5,900 tokens**
6. **AI Response Output**: **~300 tokens**

### Average Cost Per Message (Gemini 2.5 Flash Pricing)
* Gemini 2.5 Flash costs: **$0.075 / 1M Input Tokens** and **$0.30 / 1M Output Tokens**.

$$\text{Input Cost} = 5,900 \times \frac{\$0.075}{1,000,000} = \$0.0004425$$
$$\text{Output Cost} = 300 \times \frac{\$0.300}{1,000,000} = \$0.0000900$$
$$\text{Total Cost Per Message} = \$0.0005325 \text{ USD}$$

At an exchange rate of **$1 USD = ₦1,500 NGN**:
$$\text{Cost Per Message} \approx \text{₦0.80 NGN}$$

---

## 5. Platform Profitability Analysis

Admin tracking of raw API costs against the pricing of subscription packages:

### A. Starter Plan ($2 USD)
- **Quota Limit**: 200 replies
- **Estimated maximum raw API cost**: $200 \times \$0.0005325 = \$0.1065 \text{ USD}$
- **Estimated gross margin at 100% usage**: **94.7%**

### B. Growth Plan ($10 USD)
- **Quota Limit**: 1,500 replies
- **Estimated maximum raw API cost**: $1,500 \times \$0.0005325 = \$0.79875 \text{ USD}$
- **Estimated gross margin at 100% usage**: **92.0%**

> These estimates use the example token and model pricing assumptions above; actual provider costs vary by model and request size.
