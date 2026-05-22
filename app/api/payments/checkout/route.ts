import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createCheckoutSession } from "@/lib/actions/payments";
import { getUserFriendlyError, logErrorSync } from "@/lib/monitoring/log-error";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { z } from "zod";

const checkoutSchema = z.object({
  plan: z.enum(["starter", "growth"]),
  provider: z.enum(["paystack", "flutterwave"]).default("paystack"),
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
    const parsed = checkoutSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payment checkout request." }, { status: 400 });
    }
    const { plan, provider } = parsed.data;

    // 3. Create checkout session via server action helper
    const result = await createCheckoutSession(plan, provider);

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
