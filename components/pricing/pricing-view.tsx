"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Sparkles,
  Zap,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  ChevronDown,
  Building2,
  Lock,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface PricingViewProps {
  user: { id: string; email?: string } | null;
  subscription: {
    plan: string;
    status: string;
    current_period_end?: string | null;
  } | null;
}

const COMPARISON_FEATURES = [
  {
    category: "AI & Reply Quotas",
    features: [
      { name: "Monthly AI Replies", starter: "200 replies", growth: "1,500 replies", enterprise: "Custom volume" },
      { name: "Daily Soft Safety Cap", starter: "50 / day", growth: "250 / day", enterprise: "Custom limit" },
      { name: "AI Assistants / Widgets", starter: "1 Assistant", growth: "Up to 3 Assistants", enterprise: "Unlimited" },
      { name: "Knowledge Base Sources", starter: "25 sources", growth: "100 sources", enterprise: "Unlimited" },
      { name: "Lead Capture Capacity", starter: "50 leads / mo", growth: "Unlimited leads", enterprise: "Unlimited" },
    ],
  },
  {
    category: "Branding & Customization",
    features: [
      { name: "Remove Agentify Badge", starter: "—", growth: "✓ Included", enterprise: "✓ Included" },
      { name: "Custom Avatar & Colors", starter: "✓ Included", growth: "✓ Included", enterprise: "✓ Included" },
      { name: "Custom Domain & Hosted Chat", starter: "—", growth: "✓ Included", enterprise: "✓ Full White-label" },
    ],
  },
  {
    category: "Support & Integrations",
    features: [
      { name: "Support Level", starter: "Standard Email", growth: "Priority Support", enterprise: "Dedicated SLA & Slack" },
      { name: "Webhooks & Lead Exports", starter: "✓ Included", growth: "✓ Included", enterprise: "✓ Custom Webhooks" },
      { name: "Security & Role Access", starter: "1 Admin Seat", growth: "3 Team Seats", enterprise: "Custom RBAC" },
    ],
  },
];

const FAQS = [
  {
    question: "Can I upgrade or downgrade my plan at any time?",
    answer:
      "Yes. Upgrades apply immediately with full access to your expanded AI reply limits. If you request a downgrade, your current limits remain active until the end of your prepaid 30-day billing period so you always receive what you paid for.",
  },
  {
    question: "What happens when I reach my monthly AI reply limit?",
    answer:
      "Agentify never surprises you with automated overage charges. When your monthly reply limit is reached, your assistant will pause further AI answers until your billing cycle resets, or you can upgrade instantly from your dashboard.",
  },
  {
    question: "What payment currencies and methods do you support?",
    answer:
      "We accept all major debit and credit cards (Visa, Mastercard, American Express) via our secure payment gateway. All plans are billed in USD ($).",
  },
  {
    question: "How do cancellations work?",
    answer:
      "You can cancel recurring billing at any time with one click in your billing dashboard. When cancelled, your plan remains fully active and accessible until your 30-day period expires.",
  },
  {
    question: "What happens if a renewal payment fails?",
    answer:
      "If a renewal charge cannot be processed, your subscription enters a brief grace period (Past Due) while we retry. You will receive an email notification with a secure link to update your card or retry checkout.",
  },
  {
    question: "Do you offer custom Enterprise solutions?",
    answer:
      "Yes. For high-volume support centers, custom API integrations, dedicated vector databases, or custom enterprise SLAs, our enterprise team can structure a tailored agreement.",
  },
];

export function PricingView({
  user,
  subscription,
}: PricingViewProps) {
  const router = useRouter();
  // USD-only billing — no currency toggle
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const isStarterCurrent = user && subscription?.plan === "starter" && subscription?.status === "active";
  const isGrowthCurrent = user && subscription?.plan === "growth" && subscription?.status === "active";
  const isPending = user && subscription?.status === "pending";

  const handleSelectPlan = async (plan: "starter" | "growth") => {
    setCheckoutError(null);

    // If user is not authenticated, redirect to signup preserving plan
    if (!user) {
      router.push(`/signup?plan=${plan}`);
      return;
    }

    // If authenticated:
    if (plan === "starter" && isStarterCurrent) return;
    if (plan === "growth" && isGrowthCurrent) return;

    // Trigger server-side Bachs checkout session
    setLoadingPlan(plan);
    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to initialize payment session.");
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error("No checkout URL was returned.");
      }
    } catch (err: any) {
      console.error("Checkout initialization failed:", err);
      setCheckoutError(err.message || "Failed to launch payment checkout.");
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#07080c] text-white selection:bg-indigo-600 selection:text-white pt-24 pb-28 relative overflow-hidden">
      
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-indigo-600/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute top-1/3 left-10 w-96 h-96 bg-purple-600/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-indigo-600/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="container mx-auto px-4 sm:px-6 relative z-10 max-w-6xl">
        
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold tracking-wider uppercase shadow-inner">
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            <span>Transparent, Honest Pricing</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight">
            Predictable plans for growing businesses
          </h1>

          <p className="text-slate-400 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            No surprise overage fees, no complex usage tiers. Select the plan that fits your customer engagement scale.
          </p>

          {/* USD-only billing badge */}
          <div className="pt-6 flex items-center justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#12131d] border border-white/10 shadow-lg text-xs font-semibold text-slate-300">
              <span className="text-base leading-none">💳</span>
              <span>Billed in <strong className="text-white">USD</strong> · Secured by Bachs</span>
            </div>
          </div>
        </div>

        {/* Global Checkout Error Banner */}
        {checkoutError && (
          <div className="max-w-2xl mx-auto mb-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{checkoutError}</span>
          </div>
        )}

        {/* Pricing Cards Grid (3 Columns) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch mb-24">
          
          {/* 1. Starter Plan */}
          <div className={`relative rounded-3xl p-8 sm:p-9 flex flex-col justify-between transition-all duration-300 bg-[#0b0c14]/90 border ${
            isStarterCurrent
              ? "border-emerald-500 shadow-xl shadow-emerald-500/10"
              : "border-white/[0.08] hover:border-white/[0.16] hover:bg-[#0e0f18]"
          }`}>
            {isStarterCurrent && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider shadow-lg">
                <Check className="w-3.5 h-3.5" />
                Your Current Plan
              </div>
            )}

            <div>
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold text-white tracking-tight">Starter</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-white/[0.06] px-2.5 py-0.5 rounded-full">
                    Individual
                  </span>
                </div>

                <div className="mt-4 mb-3 flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                    $2
                  </span>
                  <span className="text-sm font-medium text-slate-400">/month</span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed min-h-[40px]">
                  Perfect for individuals, freelancers, and small businesses launching AI customer engagement.
                </p>
              </div>

              <div className="h-px bg-white/[0.07] mb-6" />

              {/* Highlights Summary */}
              <div className="grid grid-cols-2 gap-2 mb-6 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.04] text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">AI Replies</span>
                  <span className="text-slate-200 font-semibold">200 / month</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Assistants</span>
                  <span className="text-slate-200 font-semibold">1 Assistant</span>
                </div>
              </div>

              {/* Feature Checklist */}
              <ul className="space-y-3 mb-8 text-xs text-slate-300 font-medium">
                <li className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>200 AI-generated replies per month</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>1 AI Assistant & Embeddable Widget</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>25 Knowledge Base sources</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>50 Leads captured per month</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Standard Email Support</span>
                </li>
              </ul>
            </div>

            {/* CTA Button */}
            <div>
              {isStarterCurrent ? (
                <Button
                  disabled
                  className="w-full h-12 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-xs cursor-default"
                >
                  Active Subscription
                </Button>
              ) : isGrowthCurrent ? (
                <Button asChild variant="outline" className="w-full h-12 rounded-2xl border-white/20 text-white font-bold text-xs hover:bg-white/10">
                  <Link href="/dashboard/billing">Manage Downgrade</Link>
                </Button>
              ) : (
                <Button
                  onClick={() => handleSelectPlan("starter")}
                  disabled={loadingPlan === "starter"}
                  className="w-full h-12 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] text-white font-bold text-xs border border-white/10 transition-all flex items-center justify-center gap-2"
                >
                  {loadingPlan === "starter" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <span>{user ? (isPending ? "Activate Starter" : "Choose Starter") : "Get Started"}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* 2. Growth Plan (RECOMMENDED) */}
          <div className={`relative rounded-3xl p-8 sm:p-9 flex flex-col justify-between transition-all duration-300 bg-gradient-to-b from-[#141629] via-[#0f101f] to-[#0a0b14] border-2 border-indigo-500 shadow-2xl shadow-indigo-600/25 ring-1 ring-indigo-400/30 lg:-translate-y-2`}>
            
            {/* Recommended Badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white px-4 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider shadow-lg shadow-indigo-500/40">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Recommended · Most Popular</span>
            </div>

            <div>
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold text-white tracking-tight">Growth</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 bg-indigo-500/20 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                    Scaling Fast
                  </span>
                </div>

                <div className="mt-4 mb-3 flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                    $10
                  </span>
                  <span className="text-sm font-medium text-slate-400">/month</span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed min-h-[40px]">
                  Ideal for growing businesses that require multi-assistant capacity and brand control.
                </p>
              </div>

              <div className="h-px bg-white/[0.1] mb-6" />

              {/* Highlights Summary */}
              <div className="grid grid-cols-2 gap-2 mb-6 p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-[11px]">
                <div>
                  <span className="text-indigo-300/80 block text-[10px] uppercase font-bold tracking-wider">AI Replies</span>
                  <span className="text-white font-bold">1,500 / month</span>
                </div>
                <div>
                  <span className="text-indigo-300/80 block text-[10px] uppercase font-bold tracking-wider">Assistants</span>
                  <span className="text-white font-bold">Up to 3 Assistants</span>
                </div>
              </div>

              {/* Feature Checklist */}
              <ul className="space-y-3 mb-8 text-xs text-slate-200 font-medium">
                <li className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>1,500 AI-generated replies</strong> per month</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Up to 3 AI assistants</strong> & custom widgets</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>100 Knowledge Base sources</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Unlimited leads captured</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Remove Agentify branding</strong> (White-label)</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Priority Technical Support</span>
                </li>
              </ul>
            </div>

            {/* CTA Button */}
            <div>
              {isGrowthCurrent ? (
                <Button
                  disabled
                  className="w-full h-12 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold text-xs cursor-default"
                >
                  Active Subscription
                </Button>
              ) : (
                <Button
                  onClick={() => handleSelectPlan("growth")}
                  disabled={loadingPlan === "growth"}
                  className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/40 transition-all flex items-center justify-center gap-2"
                >
                  {loadingPlan === "growth" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <span>{user ? "Upgrade to Growth" : "Choose Growth"}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* 3. Enterprise Plan */}
          <div className="relative rounded-3xl p-8 sm:p-9 flex flex-col justify-between transition-all duration-300 bg-[#0b0c14]/90 border border-white/[0.08] hover:border-white/[0.16] hover:bg-[#0e0f18]">
            <div>
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold text-white tracking-tight">Enterprise</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-white/[0.06] px-2.5 py-0.5 rounded-full">
                    Custom Scale
                  </span>
                </div>

                <div className="mt-4 mb-3 flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                    Custom
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed min-h-[40px]">
                  Tailored reply volume, dedicated infrastructure, and customized enterprise onboarding.
                </p>
              </div>

              <div className="h-px bg-white/[0.07] mb-6" />

              {/* Highlights Summary */}
              <div className="grid grid-cols-2 gap-2 mb-6 p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.04] text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">AI Replies</span>
                  <span className="text-slate-200 font-semibold">Custom Volume</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Assistants</span>
                  <span className="text-slate-200 font-semibold">Unlimited</span>
                </div>
              </div>

              {/* Feature Checklist */}
              <ul className="space-y-3 mb-8 text-xs text-slate-300 font-medium">
                <li className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Custom AI reply limits tailored to your scale</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Unlimited AI assistants & widget instances</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Custom knowledge ingestion capacity</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Dedicated Account Manager & 99.9% SLA</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Custom API & internal system integrations</span>
                </li>
              </ul>
            </div>

            {/* CTA Button */}
            <div>
              <Button
                asChild
                variant="outline"
                className="w-full h-12 rounded-2xl border-white/20 text-white hover:bg-white/10 font-bold text-xs"
              >
                <Link href="mailto:sales@agentify.app?subject=Agentify%20Enterprise%20Inquiry">
                  Contact Enterprise Sales
                </Link>
              </Button>
            </div>
          </div>

        </div>

        {/* Feature Comparison Matrix */}
        <div className="mb-24">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Compare features across plans
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              Deep dive into quotas, integrations, and capabilities included with each tier.
            </p>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-white/10 bg-[#0b0c14]/80 shadow-2xl">
            <table className="w-full text-left text-xs min-w-[640px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="py-4 px-6 text-slate-400 font-bold uppercase tracking-wider text-[11px] w-1/3">
                    Features & Limits
                  </th>
                  <th className="py-4 px-6 text-white font-extrabold text-center w-1/5">
                    Starter
                    <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
                      $2/mo
                    </span>
                  </th>
                  <th className="py-4 px-6 text-indigo-400 font-extrabold text-center w-1/5 bg-indigo-500/[0.04]">
                    Growth
                    <span className="block text-[10px] font-normal text-indigo-300/80 mt-0.5">
                      $10/mo
                    </span>
                  </th>
                  <th className="py-4 px-6 text-white font-extrabold text-center w-1/5">
                    Enterprise
                    <span className="block text-[10px] font-normal text-slate-400 mt-0.5">Custom</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {COMPARISON_FEATURES.map((section, sIndex) => (
                  <>
                    <tr key={`sec-${sIndex}`} className="bg-white/[0.02]">
                      <td
                        colSpan={4}
                        className="py-3 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest"
                      >
                        {section.category}
                      </td>
                    </tr>
                    {section.features.map((row, rIndex) => (
                      <tr key={`row-${rIndex}`} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-6 font-semibold text-slate-200">
                          {row.name}
                        </td>
                        <td className="py-3.5 px-6 text-center text-slate-400">
                          {row.starter}
                        </td>
                        <td className="py-3.5 px-6 text-center text-indigo-200 font-semibold bg-indigo-500/[0.04]">
                          {row.growth}
                        </td>
                        <td className="py-3.5 px-6 text-center text-slate-300">
                          {row.enterprise}
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ Accordion Section */}
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              Everything you need to know about billing, limits, and subscriptions.
            </p>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className="rounded-2xl border border-white/10 bg-[#0b0c14]/70 overflow-hidden transition-all duration-200"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full py-4 px-6 text-left flex items-center justify-between gap-4 font-bold text-sm text-white hover:text-indigo-300 transition-colors"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
                        isOpen ? "rotate-180 text-indigo-400" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 text-xs text-slate-300 leading-relaxed border-t border-white/[0.06] pt-3">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Security & Guarantee Trust Bar */}
        <div className="mt-20 pt-10 border-t border-white/10 flex flex-wrap items-center justify-center gap-8 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Bank-Grade Encryption</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-indigo-400" />
            <span>PCI-DSS Compliant via Paystack</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-indigo-400" />
            <span>Cancel Anytime in 1 Click</span>
          </div>
        </div>

      </div>

    </div>
  );
}
