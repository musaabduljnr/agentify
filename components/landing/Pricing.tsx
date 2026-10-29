import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { 
  getEffectivePlanConfigs, 
  getBillingPlatformSettings, 
  formatCurrencyAmount 
} from "@/lib/billing/platform";
import type { PlanId } from "@/lib/billing/plans";

const planMeta = {
  free_trial: {
    description: "Ideal for exploring platform capabilities with zero commitment.",
    buttonText: "Start 14-Day Trial",
    href: "/signup",
    popular: false,
  },
  starter: {
    description: "Designed for small businesses, founders, and growing stores.",
    buttonText: "Get Started",
    href: "/signup",
    popular: true,
  },
  growth: {
    description: "Engineered for scaling businesses with higher visitor volume.",
    buttonText: "Scale with Growth",
    href: "/signup",
    popular: false,
  },
  enterprise: {
    description: "Tailored volume, custom SLA, and dedicated engineering support.",
    buttonText: "Contact Sales",
    href: "mailto:support@agentify.app",
    popular: false,
  },
  business: {
    description: "For established operations requiring multi-agent teams.",
    buttonText: "Get Business",
    href: "/signup",
    popular: false,
  },
};

export async function Pricing() {
  const configs = await getEffectivePlanConfigs();
  const settings = await getBillingPlatformSettings();

  const plans = (["free_trial", "starter", "growth", "enterprise"] as PlanId[]).map((planId) => {
    const config = configs[planId];
    const meta = planMeta[planId];
    
    let priceDisplay = formatCurrencyAmount(config.price_ngn, settings);
    if (config.price_ngn === 0 || planId === "free_trial") {
      priceDisplay = "Free";
    }

    return {
      name: config.name,
      price: priceDisplay,
      description: meta.description,
      features: config.features || [],
      buttonText: meta.buttonText,
      href: meta.href,
      popular: meta.popular,
      priceVal: config.price_ngn,
    };
  });

  return (
    <section id="pricing" className="py-28 bg-[#07080c] relative overflow-hidden border-t border-white/[0.06]">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-20 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-white/10 bg-white/[0.03] text-slate-400 text-xs font-semibold tracking-wider uppercase">
            <span>Predictable Pricing</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Transparent plans for every scale
          </h2>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
            No unexpected overage surprises. Upgrade, downgrade, or cancel your subscription anytime.
          </p>
        </div>
        
        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {plans.map((plan, index) => (
            <div 
              key={index} 
              className={`relative rounded-2xl p-7 flex flex-col justify-between transition-all duration-300 ${
                plan.popular 
                  ? "bg-gradient-to-b from-[#121422] to-[#0c0d16] border-2 border-indigo-500/80 shadow-2xl shadow-indigo-600/10 ring-1 ring-indigo-500/20" 
                  : "bg-[#0b0c13] border border-white/[0.08] hover:border-white/[0.15]"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 bg-indigo-600 text-white px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-lg shadow-indigo-600/40">
                  <Sparkles className="w-3 h-3" />
                  Most Popular
                </div>
              )}

              <div>
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">{plan.price}</span>
                    {plan.priceVal !== null && plan.priceVal !== 0 ? (
                      <span className="text-xs font-medium text-slate-400">/month</span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed min-h-[36px]">{plan.description}</p>
                </div>
                
                <div className="h-px bg-white/[0.06] mb-6" />

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-start gap-2.5 text-xs text-slate-300 font-medium leading-relaxed">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <Link href={plan.href} className="w-full">
                <Button
                  className={`w-full rounded-xl h-11 text-sm font-semibold transition-all ${
                    plan.popular 
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30" 
                      : "bg-white/[0.05] hover:bg-white/[0.10] text-slate-200 border border-white/10"
                  }`}
                >
                  {plan.buttonText}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
