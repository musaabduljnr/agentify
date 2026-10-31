import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createCheckoutSession } from "@/lib/actions/payments";
import { getUserFriendlyError, logErrorSync } from "@/lib/monitoring/log-error";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { z } from "zod";

const checkoutSchema = z.object({
  plan: z.enum(["starter", "growth"]),
  // Currency is strictly USD; client overrides are ignored or validated
  currency: z.literal("USD").optional().default("USD"),
});

export async function POST(request: Request) {
  try {
    // 1. Authenticate check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await rateLimit(user.id, "payment_checkout");
    if (!rl.success) return rateLimitResponse(rl);

    // 2. Read body
    const body = await request.json().catch(() => ({}));
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payment checkout request. Only USD Starter and Growth plans are supported." },
        { status: 400 }
      );
    }
    const { plan } = parsed.data;

    // 3. Create checkout session via Bachs server action helper
    const result = await createCheckoutSession(plan);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ checkoutUrl: result.checkoutUrl });
  } catch (error: unknown) {
    logErrorSync(error, "payment-checkout");
    return NextResponse.json(
      { error: getUserFriendlyError("payment-checkout") },
      { status: 500 }
    );
  }
}
