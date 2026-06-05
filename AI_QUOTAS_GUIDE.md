# Agentify AI Quotas & Calculations Guide

This guide explains how AI message quotas, vector embedding limits, API rate limits, and cost calculations are structured across the platform's billing plans and configured AI models.

---

## 1. Platform Subscription Quotas

Each customer business profile is bound to a subscription plan tier. Quotas are monitored monthly and reset at the end of the billing period.

| Plan Tier | Price (Monthly) | AI Message Limit | Knowledge Sources | Leads Limit | Embeddings Limit |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Free Trial** | Free | 100 messages | 5 sources | 50 leads | 1,000 chunks |
| **Starter** | ₦5,000 NGN | 5,000 messages | 25 sources | 1,000 leads | 20,000 chunks |
| **Growth** | ₦15,000 NGN | 25,000 messages | 100 sources | 10,000 leads | 100,000 chunks |
| **Enterprise**| Custom | Unlimited | Unlimited | Unlimited | Unlimited |

### Quota Consumption Triggers
- **AI Messages**: Consumed when a visitor sends a chat message through the widget/hosted chat, or when the admin uses the dashboard message simulator.
- **Embeddings**: Consumed when RAG files (PDFs, text files, crawled site URLs) are processed. Each file is split into chunks of text, and each chunk generates one vector embedding.
- **Leads**: Consumed when the AI extracts contact details (Email, Phone, Name) from a conversation and updates the CRM lead pipeline.

---

## 2. Hit-Limit Runout Estimations

To estimate how long a tenant's message quota will last based on daily incoming visitor volume:

$$\text{Days Before Limit} = \frac{\text{Plan Message Limit}}{\text{Average Chat Messages Per Day}}$$

### Estimations Grid (Days of Operations)

| Daily Messages | Free Trial (100) | Starter (5,000) | Growth (25,000) |
| :--- | :--- | :--- | :--- |
| **5 msgs/day** | 20 days | 1,000 days | 5,000 days |
| **20 msgs/day** | 5 days | 250 days | 1,250 days |
| **100 msgs/day** | 1 day | 50 days | 250 days |
| **500 msgs/day** | < 1 day | 10 days | 50 days |
| **1,000 msgs/day**| < 1 day | 5 days | 25 days |

> [!TIP]
> Standard monthly billing runs on a 30-day cycle. A Starter plan easily supports up to **166 messages per day** without hitting the limit. A Growth plan supports up to **833 messages per day**.

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

### A. Starter Plan (₦5,000 NGN)
- **Quota Limit**: 5,000 messages
- **Max Raw API Cost**: $5,000 \times \$0.0005325 = \$2.66 \text{ USD}$
- **Max Raw Cost in NGN**: $\approx \text{₦3,990 NGN}$
- **Gross Profit Margin (At 100% usage)**: **20.2%** (Profit: ₦1,010 NGN)
- **Gross Profit Margin (At average 20% usage)**: **84.0%** (Profit: ₦4,202 NGN)

### B. Growth Plan (₦15,000 NGN)
- **Quota Limit**: 25,000 messages
- **Max Raw API Cost**: $25,000 \times \$0.0005325 = \$13.31 \text{ USD}$
- **Max Raw Cost in NGN**: $\approx \text{₦19,965 NGN}$
- **Gross Profit Margin (At 100% usage)**: **-33.1%** (Gross Loss: -₦4,965 NGN)
- **Gross Profit Margin (At average 20% usage)**: **73.4%** (Profit: ₦11,007 NGN)

> [!WARNING]
> Growth plan users who utilize 100% of their quotas represent a negative margin due to the high volume of input tokens sent via RAG (3,300 tokens context retrieved per chat). Keep an eye on high-usage accounts inside the dashboard's "High Usage Businesses" monitor. Consider adding prompt caches or system prompt reductions to optimize input sizes if margins decay.
