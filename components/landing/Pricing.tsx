import { Check, Sparkles, HelpCircle, ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { 
  getEffectivePlanConfigs, 
  getBillingPlatformSettings, 
} from "@/lib/billing/platform";
import type { PlanId } from "@/lib/billing/plans";

const planMeta: Record<"starter" | "growth" | "enterprise", {
  badge?: string;
  tagline: string;
  usdPrice: string;
  ngnPrice: string;
  period: string;
  buttonText: string;
  href: string;
  highlighted: boolean;
  replies: string;
  agents: string;
  knowledge: string;
  leads: string;
  branding: string;
}> = {
  starter: {
    tagline: "Perfect for individuals, creators, and small stores launching AI customer engagement.",
    usdPrice: "$2",
    ngnPrice: "₦3,200",
    period: "/month",
    buttonText: "Get Started with Starter",
    href: "/signup?plan=starter",
    highlighted: false,
    replies: "200 AI replies / mo",
    agents: "1 AI Assistant",
    knowledge: "25 knowledge pages",
    leads: "50 leads captured",
    branding: "Agentify badge included",
  },
  growth: {
    badge: "Most Popular",
    tagline: "Ideal for growing businesses that require multi-agent capacity and brand control.",
    usdPrice: "$10",
    ngnPrice: "₦16,000",
    period: "/month",
    buttonText: "Scale with Growth",
    href: "/signup?plan=growth",
    highlighted: true,
    replies: "1,500 AI replies / mo",
    agents: "Up to 3 AI Assistants",
    knowledge: "100 knowledge pages",
    leads: "Unlimited leads",
    branding: "Remove Agentify branding",
  },
  enterprise: {
    badge: "Custom Scale",
    tagline: "Tailored volume, dedicated architecture, custom SLA, and hands-on onboarding.",
    usdPrice: "Custom",
    ngnPrice: "Tailored",
    period: "",
    buttonText: "Contact Enterprise Sales",
    href: "mailto:sales@agentify.app?subject=Agentify%20Enterprise%20Plan%20Inquiry",
    highlighted: false,
    replies: "Custom AI volume",
    agents: "Unlimited AI Assistants",
    knowledge: "Unlimited knowledge pages",
    leads: "Unlimited leads",
    branding: "Full white-label & custom domain",
  },
};

const faqs = [
  {
    question: "Can I upgrade or downgrade my plan at any time?",
    answer: "Yes. You can upgrade immediately from your dashboard. Downgrades take effect at the end of your current billing cycle so you always receive the full value you paid for.",
  },
  {
    question: "What happens when I reach my monthly AI reply limit?",
    answer: "To protect you from unexpected bills, we never charge surprise overage fees. Once your limit is reached, your assistant will pause until the monthly cycle resets, or you can upgrade instantly.",
  },
  {
    question: "How does the anonymous demo preview work?",
    answer: "Visitors can test our live generated assistant with up to 9 AI responses before creating an account. Once you sign up, you can claim your assistant and activate a Starter or Growth subscription.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major debit cards, credit cards, bank transfers, and USSD via our secure payment gateway (Paystack), supporting both NGN and USD transactions.",
  },
];

export async function Pricing() {
  const configs = await getEffectivePlanConfigs();
  const settings = await getBillingPlatformSettings();

  const planKeys: ("starter" | "growth" | "enterprise")[] = ["starter", "growth", "enterprise"];

  return (
    <section id="pricing" className="py-28 bg-[#07080c] relative overflow-hidden border-t border-white/[0.06]">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[850px] h-[400px] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-purple-600/5 rounded-full blur-[130px] pointer-events-none" />

      <div className="container mx-auto px-4 sm:px-6 relative z-10 max-w-6xl">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-20 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold tracking-wider uppercase shadow-inner">
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            <span>Simple, Transparent Pricing</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Plans built for real businesses
          </h2>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
            No bloated tiers, no hidden fees, and zero overage shocks. Choose the plan that fits your growth.
          </p>
        </div>
        
        {/* Pricing Cards Grid (3 Columns) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch mb-24">
          {planKeys.map((planKey) => {
            const meta = planMeta[planKey];
            const config = configs[planKey as PlanId];
            const isHighlighted = meta.highlighted;

            return (
              <div 
                key={planKey} 
                className={`relative rounded-3xl p-8 sm:p-9 flex flex-col justify-between transition-all duration-300 ${
                  isHighlighted 
                    ? "bg-gradient-to-b from-[#141629] via-[#0f101f] to-[#0a0b14] border-2 border-indigo-500 shadow-2xl shadow-indigo-600/20 ring-1 ring-indigo-400/30 lg:-translate-y-2" 
                    : "bg-[#0b0c14]/90 border border-white/[0.08] hover:border-white/[0.16] hover:bg-[#0e0f18]"
                }`}
              >
                {/* Highlight Badge */}
                {meta.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white px-4 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider shadow-lg shadow-indigo-500/40">
                    <Sparkles className="w-3.5 h-3.5" />
                    {meta.badge}
                  </div>
                )}

                <div>
                  {/* Title & Tagline */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xl font-bold text-white tracking-tight">{config?.name || meta.replies}</h3>
                      {planKey === "starter" && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-white/[0.06] px-2.5 py-0.5 rounded-full">
                          Starter Pack
                        </span>
                      )}
                    </div>
                    
                    {/* Price Block */}
                    <div className="mt-4 mb-3 flex items-baseline gap-2">
                      <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                        {meta.usdPrice}
                      </span>
                      {meta.period && (
                        <span className="text-sm font-medium text-slate-400">
                          {meta.period}
                        </span>
                      )}
                      {meta.ngnPrice && (
                        <span className="text-xs font-semibold text-indigo-300/80 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                          {meta.ngnPrice}/mo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed min-h-[44px]">
                      {meta.tagline}
                    </p>
                  </div>
                  
                  <div className="h-px bg-white/[0.07] mb-6" />

                  {/* Highlights Summary */}
                  <div className="grid grid-cols-2 gap-2 mb-6 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">AI Replies</span>
                      <span className="text-slate-200 font-semibold">{meta.replies}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Assistants</span>
                      <span className="text-slate-200 font-semibold">{meta.agents}</span>
                    </div>
                  </div>

                  {/* Feature Checklist */}
                  <ul className="space-y-3 mb-8">
                    {(config?.features || []).map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-start gap-3 text-xs text-slate-300 font-medium leading-relaxed">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                {/* CTA Button */}
                <div className="pt-4 border-t border-white/[0.05]">
                  <Link href={meta.href} className="w-full block">
                    <Button
                      className={`w-full rounded-2xl h-12 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                        isHighlighted 
                          ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/35 hover:scale-[1.02] active:scale-[0.98]" 
                          : "bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/10 hover:border-white/20 active:scale-[0.98]"
                      }`}
                    >
                      <span>{meta.buttonText}</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                  <p className="text-center text-[10px] text-slate-500 mt-2.5">
                    {planKey === "enterprise" ? "Tailored SLA & agreements" : "Instant activation • Cancel anytime"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature Comparison Table */}
        <div className="mb-24 rounded-3xl bg-[#0b0c14] border border-white/[0.08] overflow-hidden p-6 sm:p-10">
          <div className="mb-8 text-center sm:text-left">
            <h3 className="text-xl font-bold text-white mb-2">Compare Plan Capabilities</h3>
            <p className="text-xs text-slate-400">Detailed breakdown of quotas, features, and technical specifications.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-4 px-4 font-bold">Feature</th>
                  <th className="py-4 px-4 font-bold">Starter ($2/mo)</th>
                  <th className="py-4 px-4 font-bold text-indigo-400">Growth ($10/mo)</th>
                  <th className="py-4 px-4 font-bold">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-slate-300">
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-white">AI Replies / Month</td>
                  <td className="py-3.5 px-4">200</td>
                  <td className="py-3.5 px-4 font-bold text-indigo-300">1,500</td>
                  <td className="py-3.5 px-4">Custom volume</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-white">Active AI Assistants</td>
                  <td className="py-3.5 px-4">1</td>
                  <td className="py-3.5 px-4 font-bold text-indigo-300">Up to 3</td>
                  <td className="py-3.5 px-4">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-white">Knowledge Sources (URLs / Docs)</td>
                  <td className="py-3.5 px-4">25 pages</td>
                  <td className="py-3.5 px-4 font-bold text-indigo-300">100 pages</td>
                  <td className="py-3.5 px-4">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-white">Lead Capture Limit</td>
                  <td className="py-3.5 px-4">50 leads</td>
                  <td className="py-3.5 px-4 font-bold text-indigo-300">Unlimited</td>
                  <td className="py-3.5 px-4">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-white">Branding Removal</td>
                  <td className="py-3.5 px-4 text-slate-500">—</td>
                  <td className="py-3.5 px-4 text-emerald-400 font-bold">Included</td>
                  <td className="py-3.5 px-4 text-emerald-400 font-bold">White-label</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-white">Custom Domain & Webhooks</td>
                  <td className="py-3.5 px-4 text-slate-500">—</td>
                  <td className="py-3.5 px-4 text-emerald-400 font-bold">Included</td>
                  <td className="py-3.5 px-4 text-emerald-400 font-bold">Included</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-semibold text-white">Support SLA</td>
                  <td className="py-3.5 px-4">Standard Email</td>
                  <td className="py-3.5 px-4 font-bold text-indigo-300">Priority Email</td>
                  <td className="py-3.5 px-4">Dedicated Manager + SLA</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Pricing FAQs */}
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12 space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs text-indigo-400 font-semibold uppercase tracking-wider">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Questions & Answers</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white">Frequently Asked Questions</h3>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div 
                key={idx} 
                className="rounded-2xl p-6 bg-[#0b0c14] border border-white/[0.07] space-y-2"
              >
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                  {faq.question}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed pl-6">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
