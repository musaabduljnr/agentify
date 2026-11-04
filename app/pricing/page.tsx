import { Metadata } from "next";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { PricingView } from "@/components/pricing/pricing-view";
import { createClient } from "@/utils/supabase/server";
import { getEffectivePlanConfigs } from "@/lib/billing/platform";

export const metadata: Metadata = {
  title: "Pricing & Plans — Agentify",
  description:
    "Simple, predictable pricing for autonomous AI customer support. Choose Starter ($2/mo) or Growth ($10/mo) with zero surprise overage fees.",
};

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const planConfigs = await getEffectivePlanConfigs();
  const publicPlan = (planId: "starter" | "growth" | "enterprise") => {
    const { name, price_usd, messages, daily_messages, knowledge_sources, leads, widgets, features } =
      planConfigs[planId];
    return { name, price_usd, messages, daily_messages, knowledge_sources, leads, widgets, features };
  };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let subscription: {
    plan: string;
    status: string;
    current_period_end?: string | null;
  } | null = null;

  if (user) {
    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (business) {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan, status, current_period_end")
        .eq("business_id", business.id)
        .maybeSingle();

      if (sub) {
        subscription = sub;
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#07080c] flex flex-col justify-between">
      <Navbar />
      <main className="flex-1">
        <PricingView
          user={user ? { id: user.id, email: user.email } : null}
          subscription={subscription}
          plans={{
            starter: publicPlan("starter"),
            growth: publicPlan("growth"),
            enterprise: publicPlan("enterprise"),
          }}
        />
      </main>
      <Footer />
    </div>
  );
}
