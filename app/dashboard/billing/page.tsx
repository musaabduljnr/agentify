import { getBillingData, getUsageWarnings } from "@/lib/actions/billing";
import { getPaymentHistory } from "@/lib/actions/payments";
import { UsageWarningBanner } from "@/components/billing/usage-warning-banner";
import { UpgradeButton } from "@/components/billing/upgrade-button";
import { CancelPlanDialog } from "@/components/billing/cancel-plan-dialog";
import { DowngradeDialog } from "@/components/billing/downgrade-dialog";
import { BillingHistoryTable } from "@/components/billing/billing-history-table";
import { PaymentMethodsCard } from "@/components/billing/payment-methods-card";
import { BillingInfoForm } from "@/components/billing/billing-info-form";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  Check,
  Zap,
  Clock,
  Crown,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

function UsageCard({
  label,
  used,
  limit,
  unit = "",
  color = "indigo",
}: {
  label: string;
  used: number;
  limit: number;
  unit?: string;
  color?: "indigo" | "emerald" | "purple" | "blue";
}) {
  const isUnlimited = limit >= 999999999;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));

  const barColor =
    pct >= 100
      ? "bg-red-500"
      : pct >= 80
      ? "bg-amber-500"
      : color === "emerald"
      ? "bg-emerald-500"
      : color === "purple"
      ? "bg-purple-600"
      : "bg-indigo-600";

  return (
    <div className="bg-slate-50/70 rounded-2xl p-4 sm:p-5 border border-slate-100 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-slate-700">{label}</span>
        <span className="text-xs font-extrabold text-slate-900">
          {isUnlimited ? (
            <span className="text-emerald-700 font-bold">Unlimited</span>
          ) : (
            `${used.toLocaleString()} / ${limit.toLocaleString()} ${unit}`.trim()
          )}
        </span>
      </div>

      <div className="h-2 w-full bg-slate-200/70 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-700 ease-out`}
          style={{ width: isUnlimited ? "4%" : `${Math.max(2, pct)}%` }}
        />
      </div>

      <p className="text-[10px] text-slate-400 font-medium">
        {isUnlimited
          ? "Uncapped capacity on your plan."
          : pct >= 100
          ? "Monthly limit reached. Upgrade to expand capacity."
          : `${pct}% used this period.`}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    past_due: "bg-red-50 text-red-700 border-red-200",
    cancelled: "bg-slate-100 text-slate-700 border-slate-200",
    suspended: "bg-red-50 text-red-700 border-red-200",
    expired: "bg-slate-100 text-slate-500 border-slate-200",
  };

  const labels: Record<string, string> = {
    active: "Active",
    pending: "Pending Payment",
    past_due: "Past Due",
    cancelled: "Cancelled",
    suspended: "Suspended",
    expired: "Expired",
  };

  return (
    <span
      className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider border ${
        styles[status] || styles.cancelled
      }`}
    >
      {labels[status] || status}
    </span>
  );
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: any;
}) {
  const resolvedParams = searchParams instanceof Promise ? await searchParams : (searchParams || {});
  const showSuccess = resolvedParams.success === "true";

  const [billingData, warnings, history] = await Promise.all([
    getBillingData(),
    getUsageWarnings(),
    getPaymentHistory(),
  ]);

  if (!billingData) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 mb-2">Billing & Subscription</h1>
          <p className="text-sm text-slate-500">Manage your subscription, quotas, and billing settings.</p>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-16 text-center">
          <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900 mb-2">No Active Subscription Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
            Please complete your account onboarding to initialize your subscription.
          </p>
          <Button asChild className="rounded-2xl px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
            <Link href="/onboarding">Complete Setup</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { business, subscription, currentPlan, billingSettings, usage, plans } = billingData;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const periodStart = formatDate(subscription.current_period_start);
  const periodEnd = formatDate(subscription.current_period_end || subscription.reset_date);
  const scheduledDowngrade = subscription.metadata?.downgrade_to;
  const isPending = subscription.status === "pending";
  const isActive = subscription.status === "active";

  const currencySymbol = billingSettings.currency_symbol || (billingSettings.currency === "USD" ? "$" : "₦");

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-16">
      
      {/* Page Title */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Billing & Plans</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage your subscription, usage quotas, payment methods, and invoices.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-2xl text-xs font-bold border-slate-200 self-start sm:self-auto">
            <Link href="/pricing" target="_blank" className="flex items-center gap-1.5">
              <span>View Public Pricing</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Payment Success Toast Banner */}
      {showSuccess && (
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-3xl flex items-start gap-4 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-emerald-950">Payment Verified & Plan Activated!</h4>
            <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
              Your transaction was verified server-side. Your plan limits and features are active immediately.
            </p>
          </div>
        </div>
      )}

      {/* Pending Payment Notice */}
      {isPending && (
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3.5">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-950">Action Needed: Subscription Pending Payment</h4>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                Your subscription is currently inactive. Please complete your checkout to activate AI features and agent responses.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <UpgradeButton
              planId={subscription.plan === "growth" ? "growth" : "starter"}
              provider="paystack"
              label={`Pay ${subscription.plan === "growth" ? "$10 / ₦16,000" : "$2 / ₦3,200"}`}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold h-11 px-6 shadow-md"
            />
          </div>
        </div>
      )}

      {/* Usage Warnings if approaching limit */}
      <UsageWarningBanner warnings={warnings} />

      {/* SECTION A & B: Current Subscription Overview & Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Cols: Subscription Overview & Usage */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Subscription Card */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-indigo-50/60 to-purple-50/40 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8 relative z-10">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl font-black text-slate-900 tracking-tight capitalize">
                    {currentPlan.name} Plan
                  </span>
                  <StatusBadge status={subscription.status} />
                </div>
                <p className="text-xs text-slate-500">
                  Billing cycle: <strong className="text-slate-700">{periodStart}</strong> to <strong className="text-slate-700">{periodEnd}</strong>
                </p>
              </div>

              <div className="sm:text-right">
                <div className="text-3xl font-black text-slate-900 tracking-tight">
                  {currentPlan.price}
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Billed monthly via Paystack
                </span>
              </div>
            </div>

            {/* Scheduled downgrade warning if active */}
            {scheduledDowngrade && (
              <div className="mb-6 p-4 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-center justify-between gap-4">
                <div className="text-xs text-amber-900">
                  <strong>Scheduled Downgrade:</strong> Your plan will switch to <span className="capitalize font-bold">{scheduledDowngrade}</span> on <strong>{periodEnd}</strong>.
                </div>
              </div>
            )}

            {/* Scheduled cancellation warning if active */}
            {subscription.cancel_at_period_end && !scheduledDowngrade && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-900">
                <strong>Cancellation Notice:</strong> Your subscription will cancel on <strong>{periodEnd}</strong>. You retain full access to your plan until that date.
              </div>
            )}

            {/* Usage Overview Grid */}
            <div className="relative z-10 pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                Usage Against Current Plan Limits
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <UsageCard
                  label="AI Generated Replies"
                  used={usage.messages.used}
                  limit={usage.messages.limit}
                  unit="replies"
                  color="indigo"
                />
                <UsageCard
                  label="Assistants & Widgets"
                  used={usage.widgets.used}
                  limit={usage.widgets.limit}
                  unit="assistants"
                  color="purple"
                />
                <UsageCard
                  label="Knowledge Sources"
                  used={usage.knowledge_sources.used}
                  limit={usage.knowledge_sources.limit}
                  unit="sources"
                  color="blue"
                />
                <UsageCard
                  label="Leads Captured"
                  used={usage.leads.used}
                  limit={usage.leads.limit}
                  unit="leads"
                  color="emerald"
                />
              </div>
            </div>
          </div>

          {/* SECTION C: Manage Subscription Actions */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            <h3 className="text-base font-bold text-slate-900">Subscription Controls</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Downgrade Action (if on Growth) */}
              {subscription.plan === "growth" && isActive && (
                <DowngradeDialog
                  currentPlan={currentPlan.name}
                  targetPlan="starter"
                  targetPrice={billingSettings.currency === "USD" ? "$2/mo" : "₦3,200/mo"}
                  periodEndDate={periodEnd}
                  isScheduled={!!scheduledDowngrade}
                />
              )}

              {/* Cancel / Reactivate Subscription Dialog */}
              {isActive && (
                <CancelPlanDialog
                  cancelAtPeriodEnd={!!subscription.cancel_at_period_end}
                  periodEndDate={periodEnd}
                />
              )}
            </div>
          </div>

          {/* SECTION D: Billing History Table with Receipts */}
          <BillingHistoryTable
            history={history}
            businessName={business?.name}
            contactEmail={business?.contact_email}
            billingAddress={business?.address}
          />

        </div>

        {/* Right Col: Quick Upgrade Card, Payment Methods, Billing Info */}
        <div className="space-y-8">
          
          {/* Quick Upgrade / Plan Action Card */}
          <div className="bg-gradient-to-b from-[#141629] via-[#0f101f] to-[#0a0b14] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden border border-indigo-500/30 shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/30 rounded-full blur-2xl" />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold tracking-wider uppercase mb-4 border border-indigo-500/30">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Plan Management</span>
              </div>

              <h3 className="text-xl font-black mb-2 tracking-tight">
                {subscription.plan === "starter"
                  ? "Upgrade to Growth"
                  : subscription.plan === "growth"
                  ? "Growth Tier Active"
                  : "Custom Enterprise"}
              </h3>

              <p className="text-xs text-slate-300 mb-6 leading-relaxed">
                {subscription.plan === "starter"
                  ? "Scale to 1,500 AI replies/month, 3 assistants, 100 knowledge pages, and remove Agentify branding."
                  : "You're on our high-performance Growth tier with 1,500 monthly AI replies and unlimited lead capture."}
              </p>

              {subscription.plan === "starter" && (
                <div className="space-y-3 mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white">$10</span>
                    <span className="text-xs text-slate-400">/month</span>
                    <span className="text-[11px] font-semibold text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30">
                      ₦16,000/mo
                    </span>
                  </div>

                  <UpgradeButton
                    planId="growth"
                    provider="paystack"
                    label="Upgrade to Growth Plan"
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-12 shadow-lg shadow-indigo-600/30"
                  />
                  <p className="text-[10px] text-slate-400 text-center">
                    Instant upgrade · Verified server-side via Paystack
                  </p>
                </div>
              )}

              {subscription.plan === "growth" && (
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-xs text-slate-300 mb-6">
                  <div className="flex items-center gap-2 font-bold text-emerald-400 mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Highest standard tier active</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Need custom reply volumes or SLA? Inquire about Enterprise.
                  </p>
                </div>
              )}

              <div className="pt-4 border-t border-white/10">
                <Button
                  asChild
                  variant="outline"
                  className="w-full h-10 rounded-2xl border-white/20 text-white hover:bg-white/10 font-bold text-xs"
                >
                  <Link href="mailto:sales@agentify.app?subject=Agentify%20Enterprise%20Inquiry">
                    Contact Enterprise Sales
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* SECTION E: Payment Methods Card */}
          <PaymentMethodsCard lastTransaction={history?.[0]} />

          {/* SECTION F: Billing Information Card */}
          <BillingInfoForm
            business={business}
            metadata={subscription.metadata}
          />

        </div>

      </div>

    </div>
  );
}
