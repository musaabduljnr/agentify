import { Check } from "lucide-react";
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
    description: "Perfect for exploring the platform",
    buttonText: "Start Trial",
    href: "/signup",
    popular: false,
  },
  starter: {
    description: "Great for small businesses",
    buttonText: "Get Started",
    href: "/signup",
    popular: true,
  },
  growth: {
    description: "For growing companies",
    buttonText: "Choose Growth",
    href: "/signup",
    popular: false,
  },
  enterprise: {
    description: "For agencies and enterprises",
    buttonText: "Contact Us",
    href: "mailto:support@agentify.app",
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
    <section id="pricing" className="py-24 bg-slate-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-slate-900 mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Choose the plan that best fits your business needs. No hidden fees.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {plans.map((plan, index) => (
            <div 
              key={index} 
              className={`relative bg-white rounded-3xl p-8 border ${
                plan.popular ? 'border-indigo-600 ring-4 ring-indigo-50' : 'border-slate-200'
              } flex flex-col`}
            >
              {plan.popular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-650 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow">
                  Most Popular
                </div>
              )}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-3xl font-black text-slate-900">{plan.price}</span>
                  {plan.priceVal !== null && plan.priceVal !== 0 ? <span className="text-xs font-bold text-slate-500">/mo</span> : null}
                </div>
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">{plan.description}</p>
              </div>
              
              <ul className="space-y-4 mb-8 flex-1">
                {plan.features.map((feature, fIndex) => (
                  <li key={fIndex} className="flex items-start gap-2.5 text-xs text-slate-600 font-semibold leading-relaxed">
                    <Check className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Link href={plan.href}>
                <Button
                  variant={plan.popular ? "default" : "outline"}
                  className={`w-full rounded-2xl h-11 font-bold ${plan.popular ? 'bg-indigo-650 hover:bg-indigo-600 text-white shadow shadow-indigo-200 border-none' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
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
