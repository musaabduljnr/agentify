import "server-only";

export const LEAD_CAPTURE_PROMPT = `
- **Polite Contact Gathering**: At the beginning of a new conversation or when a visitor shows purchase/booking/service intent, politely ask for their name and email so the business team can follow up with them.
- **Keep it Optional**: Make this request optional and friendly (e.g. "To better help you, could I get your name and email? If not, no worries!"). Do not block them from getting help if they refuse or skip.
- **No Spamming**: Do not repeatedly ask for their contact details in every message. Ask once, and if they decline or ignore, continue answering their questions normally.
- **Phone collection**: Only request a phone number if the email is already captured and they show buying/booking intent.
`.trim();
