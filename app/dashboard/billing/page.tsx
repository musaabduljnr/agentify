import { getBillingData, getUsageWarnings } from "@/lib/actions/billing";

export const dynamic = "force-dynamic";

import { getPaymentHistory } from "@/lib/actions/payments";
import { UsageWarningBanner } from "@/components/billing/usage-warning-banner";
import { UpgradeButton } from "@/components/billing/upgrade-button";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  Check,
  Zap,
  Clock,
  Shield,
  Crown,
  Info,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

function UsageBar({
  label,
  used,
  limit,
  color = "indigo",
}: {
  label: string;
  used: number;
  limit: number;
  color?: string;
}) {
  const isUnlimited = limit >= 999999999;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const barColor =
    pct >= 100
      ? "bg-red-500"
      : pct >= 80
      ? "bg-amber-500"
      : color === "indigo"
      ? "bg-indigo-600"
      : color === "emerald"
      ? "bg-emerald-500"
      : color === "blue"
      ? "bg-blue-500"
      : "bg-indigo-600";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-slate-700">{label}</span>
        <span className="text-xs text-slate-500 font-medium">
          {isUnlimited
            ? `${used.toLocaleString("en-US")} / ∞`
            : `${used.toLocaleString("en-US")} / ${limit.toLocaleString("en-US")}`}
        </span>
      </div>
      <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-700 ease-out`}
          style={{ width: isUnlimited ? "2%" : `${Math.max(2, pct)}%` }}
        />
      </div>
      <p className="text-[10px] text-slate-400 mt-1.5 font-medium">
        {isUnlimited
          ? "Unlimited usage on your plan."
          : pct >= 100
          ? "You have reached the limit for your current plan."
          : `${pct}% of your monthly limit used.`}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-600 border-emerald-200",
    trialing: "bg-blue-50 text-blue-600 border-blue-200",
    cancelled: "bg-red-50 text-red-600 border-red-200",
    suspended: "bg-red-50 text-red-600 border-red-200",
    past_due: "bg-amber-50 text-amber-600 border-amber-200",
    inactive: "bg-slate-100 text-slate-500 border-slate-200",
  };

  return (
    <span
      className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-widest border ${
        styles[status] || styles.inactive
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function ProviderBadge({ provider }: { provider: string }) {
  const labels: Record<string, string> = {
    manual: "Manual",
    paystack: "Paystack",
    flutterwave: "Flutterwave",
  };

  return (
    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full uppercase tracking-widest border border-slate-200">
      {labels[provider] || provider}
    </span>
  );
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: any;
}) {
  // Await searchParams in a safe way supporting Next.js 13, 14, and 15
  const resolvedParams = searchParams instanceof Promise ? await searchParams : (searchParams || {});
  const showSuccess = resolvedParams.success === "true";

  const [billingData, warnings, history] = await Promise.all([
    getBillingData(),
    getUsageWarnings(),
    getPaymentHistory(),
  ]);

  if (!billingData) {
    return (
      <>
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">
            Billing & Plans
          </h1>
          <p className="text-slate-500">
            Set up your subscription to get started.
          </p>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-16 text-center">
          <CreditCard className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">
            No subscription found. Complete onboarding to begin.
          </p>
          <Button asChild className="mt-6 rounded-2xl px-6">
            <Link href="/onboarding">Start Onboarding</Link>
          </Button>
        </div>
      </>
    );
  }

  const { subscription, currentPlan, usage, plans } = billingData;

  const resetDate = subscription.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString("en-US", {
        timeZone: "UTC",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  return (
    <>
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">
          Billing & Plans
        </h1>
        <p className="text-slate-500">
          Manage your subscription, usage, and billing settings.
        </p>
      </div>

      {/* Success Notification */}
      {showSuccess && (
        <div className="mb-8 p-5 bg-emerald-50 border border-emerald-200 rounded-3xl flex items-start gap-4 shadow-sm animate-pulse">
          <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-emerald-950">Plan Upgraded Successfully!</h4>
            <p className="text-xs text-emerald-700 mt-1">
              Your payment has been fully verified and processed. Your limits have been updated and are now ready to use.
            </p>
          </div>
        </div>
      )}

      {/* Usage Warnings */}
      <UsageWarningBanner warnings={warnings} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-10">
        {/* Current Plan & Usage */}
        <div className="lg:col-span-2 space-y-8">
          {/* Current Plan Card */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-full -mr-20 -mt-20 blur-3xl"></div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 relative z-10">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-bold text-slate-900">
                    {currentPlan.name} Plan
                  </h3>
                  <StatusBadge status={subscription.status} />
                  <ProviderBadge provider={subscription.payment_provider} />
                </div>
                <p className="text-slate-500 text-sm">
                  Usage resets on{" "}
                  <span className="font-bold text-slate-700">{resetDate}</span>.
                </p>
                {subscription.cancel_at_period_end && (
                  <p className="text-amber-600 text-sm font-semibold mt-1">
                    ⚠ Your plan will be cancelled at the end of the current period.
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="text-3xl font-extrabold text-slate-900">
                  {currentPlan.price}
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  per month
                </p>
              </div>
            </div>

            {/* Usage Bars */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              <div className="space-y-6">
                <UsageBar
                  label="AI Messages"
                  used={usage.messages.used}
                  limit={usage.messages.limit}
                  color="indigo"
                />
                <UsageBar
                  label="Knowledge Sources"
                  used={usage.knowledge_sources.used}
                  limit={usage.knowledge_sources.limit}
                  color="blue"
                />
              </div>
              <div className="space-y-6">
                <UsageBar
                  label="Leads Captured"
                  used={usage.leads.used}
                  limit={usage.leads.limit}
                  color="emerald"
                />
                <UsageBar
                  label="Embeddings"
                  used={usage.embeddings.used}
                  limit={usage.embeddings.limit}
                  color="blue"
                />
              </div>
            </div>
          </div>

          {/* Secure Payment Infrastructure Header */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100">
                <Shield className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Secure Payments</h4>
                <p className="text-xs text-slate-500">Transactions are secured and processed using industry-standard gateways.</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100">
              <Info className="w-5 h-5 text-indigo-500 shrink-0" />
              <p className="text-xs text-slate-600 leading-relaxed">
                We accept local card, bank transfer, USSD, and mobile money options. Payments are handled securely via 
                <strong> Paystack</strong> (our primary provider) and <strong>Flutterwave</strong> (secondary option). Your 
                card information is never saved on our servers.
              </p>
            </div>
          </div>
        </div>

        {/* Upgrade Sidebar */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600 rounded-full -mr-16 -mt-16 blur-3xl opacity-50"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-600 rounded-full -ml-12 -mb-12 blur-3xl opacity-30"></div>
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm border border-white/10">
                <Zap className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Flexible Subscription</h3>
              <p className="text-slate-400 text-xs mb-8">
                Instantly unlock more chat messages, knowledge resources, multiple web widgets, and faster embeddings limit.
              </p>

              <ul className="space-y-4 mb-10">
                {[
                  "Higher message quotas/month",
                  "Support for more knowledge inputs",
                  "Higher lead cap limits",
                  "Multiple embeddable widgets",
                  "Priority technical support",
                ].map((feature, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-3 text-xs font-medium text-slate-300"
                  >
                    <Check className="w-4 h-4 text-indigo-400" />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Standard Quick Upgrade Actions */}
              {subscription.plan === "free_trial" && (
                <div className="space-y-3">
                  <UpgradeButton
                    planId="starter"
                    provider="paystack"
                    label="Upgrade to Starter"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 shadow-lg shadow-indigo-900/30"
                  />
                  <p className="text-[10px] text-slate-500 text-center">
                    Billed locally via Paystack secure checkout
                  </p>
                </div>
              )}
              {subscription.plan === "starter" && (
                <div className="space-y-3">
                  <UpgradeButton
                    planId="growth"
                    provider="paystack"
                    label="Upgrade to Growth"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 shadow-lg shadow-indigo-900/30"
                  />
                </div>
              )}
              {subscription.plan !== "free_trial" && subscription.plan !== "starter" && (
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-center text-xs text-slate-300">
                  ⚡ You are currently subscribed to a paid premium tier!
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
            <h4 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              Need Help?
            </h4>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Have questions regarding plan pricing, local tax invoices, or looking for an customized enterprise agreement?
            </p>
            <Button
              variant="outline"
              className="w-full rounded-2xl h-12 border-2 border-slate-100 font-bold hover:bg-slate-50 transition-all text-xs"
            >
              Contact Support
            </Button>
          </div>
        </div>
      </div>

      {/* Plan Comparative Matrix */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-8">
          <Crown className="w-6 h-6 text-indigo-600" />
          <h2 className="text-2xl font-extrabold text-slate-900">
            Compare Plans
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white rounded-3xl border-2 p-7 transition-all flex flex-col justify-between hover:shadow-lg ${
                plan.isCurrent
                  ? "border-indigo-500 shadow-md shadow-indigo-100"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              {plan.isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-full uppercase tracking-widest">
                    Current Plan
                  </span>
                </div>
              )}

              <div>
                <div className="mb-6 pt-2">
                  <h3 className="text-lg font-bold text-slate-900 mb-1">
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-900">
                      {plan.price}
                    </span>
                    {plan.price_ngn !== null && plan.price_ngn > 0 && (
                      <span className="text-sm text-slate-400 font-medium">
                        /mo
                      </span>
                    )}
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 text-xs text-slate-600 leading-normal"
                    >
                      <Check
                        className={`w-4 h-4 shrink-0 mt-0.5 ${
                          plan.isCurrent ? "text-indigo-600" : "text-slate-400"
                        }`}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                {plan.id === "enterprise" ? (
                  <Button
                    asChild
                    variant="outline"
                    className="w-full rounded-2xl h-11 border-2 border-slate-200 text-slate-700 font-bold hover:bg-slate-50"
                  >
                    <Link href="mailto:sales@agentify.com">
                      Contact Sales
                    </Link>
                  </Button>
                ) : plan.isCurrent ? (
                  <Button
                    variant="outline"
                    className="w-full rounded-2xl h-11 border-2 border-indigo-200 text-indigo-600 font-bold cursor-default hover:bg-white"
                    disabled
                  >
                    Current Plan
                  </Button>
                ) : plan.isUpgrade ? (
                  <div className="space-y-2">
                    <UpgradeButton
                      planId={plan.id as "starter" | "growth"}
                      provider="paystack"
                      label="Pay with Paystack"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                    />
                    <UpgradeButton
                      planId={plan.id as "starter" | "growth"}
                      provider="flutterwave"
                      label="Pay with Flutterwave"
                      variant="outline"
                      className="border-2 border-slate-200 text-slate-700 hover:bg-slate-50"
                    />
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full rounded-2xl h-11 border-2 border-slate-200 text-slate-400 font-bold cursor-default"
                    disabled
                  >
                    Downgrade
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment History List Section */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 mb-10">
        <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-600" />
          Payment History
        </h3>

        {history && history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-widest">
                  <th className="py-4 px-4">Date</th>
                  <th className="py-4 px-4">Provider</th>
                  <th className="py-4 px-4">Plan</th>
                  <th className="py-4 px-4">Amount</th>
                  <th className="py-4 px-4">Reference</th>
                  <th className="py-4 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {history.map((tx: any) => {
                  const txDate = new Date(tx.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  });
                  return (
                    <tr key={tx.id} className="text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4 font-medium text-slate-800">{txDate}</td>
                      <td className="py-4 px-4 capitalize">{tx.provider}</td>
                      <td className="py-4 px-4 capitalize font-semibold text-slate-700">{tx.plan}</td>
                      <td className="py-4 px-4 font-bold text-slate-900">
                        {tx.currency === "NGN" ? `₦${tx.amount.toLocaleString()}` : `${tx.currency} ${tx.amount}`}
                      </td>
                      <td className="py-4 px-4">
                        <code className="text-xs text-slate-400 font-mono select-all bg-slate-50 px-2 py-1 rounded border border-slate-100">
                          {tx.reference}
                        </code>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex px-2.5 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider border ${
                            tx.status === "success"
                              ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                              : tx.status === "pending"
                              ? "bg-amber-50 text-amber-600 border-amber-100"
                              : "bg-red-50 text-red-600 border-red-100"
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <Layers className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500 font-medium">No transactions recorded yet.</p>
            <p className="text-[10px] text-slate-400 mt-1">Upgrade your subscription plan to see invoicing records.</p>
          </div>
        )}
      </div>
    </>
  );
}
