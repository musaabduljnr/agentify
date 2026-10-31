import { getBillingData, getUsageWarnings } from "@/lib/actions/billing";
import { getPaymentHistory } from "@/lib/actions/payments";
import { UsageWarningBanner } from "@/components/billing/usage-warning-banner";
import { UpgradeButton } from "@/components/billing/upgrade-button";
import { CancelPlanDialog } from "@/components/billing/cancel-plan-dialog";
import { DowngradeDialog } from "@/components/billing/downgrade-dialog";
import { BillingHistoryTable } from "@/components/billing/billing-history-table";
import { PaymentMethodsCard } from "@/components/billing/payment-methods-card";
import { BillingInfoForm } from "@/components/billing/billing-info-form";
import { ManageBillingButton } from "@/components/billing/manage-billing-button";
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
  AlertCircle,
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
        {isUnlimited ? (
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
            Unlimited
          </span>
        ) : (
          <span className="text-xs font-bold font-mono text-slate-500">
            {used.toLocaleString()} / {limit.toLocaleString()} {unit}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="w-full h-2 rounded-full bg-slate-200/70 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${isUnlimited ? 5 : pct}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
          <span>{isUnlimited ? "No quota caps" : `${pct}% consumed`}</span>
          {!isUnlimited && <span>{Math.max(0, limit - used).toLocaleString()} remaining</span>}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; class: string; icon: any }> = {
    active: {
      label: "Active",
      class: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: CheckCircle2,
    },
    pending: {
      label: "Pending Payment",
      class: "bg-amber-50 text-amber-700 border-amber-200",
      icon: Clock,
    },
    past_due: {
      label: "Past Due",
      class: "bg-red-50 text-red-700 border-red-200",
      icon: AlertTriangle,
    },
    canceled: {
      label: "Cancelled",
      class: "bg-slate-100 text-slate-600 border-slate-200",
      icon: AlertCircle,
    },
    cancelled: {
      label: "Cancelled",
      class: "bg-slate-100 text-slate-600 border-slate-200",
      icon: AlertCircle,
    },
    unpaid: {
      label: "Unpaid",
      class: "bg-red-50 text-red-700 border-red-200",
      icon: AlertCircle,
    },
    trialing: {
      label: "Active",
      class: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: CheckCircle2,
    },
  };

  const current = config[status.toLowerCase()] || {
    label: status.toUpperCase(),
    class: "bg-slate-100 text-slate-700 border-slate-200",
    icon: Clock,
  };

  const Icon = current.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${current.class}`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{current.label}</span>
    </span>
  );
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const showSuccess = resolvedParams.status === "success";

  const [billingData, warnings, history] = await Promise.all([
    getBillingData(),
    getUsageWarnings(),
    getPaymentHistory(),
  ]);

  if (!billingData) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h2 className="text-xl font-bold text-slate-900">Billing Unavailable</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Unable to load your business billing record. Please make sure you have created your business workspace first.
          </p>
          <Button asChild className="rounded-2xl">
            <Link href="/dashboard">Return to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { subscription, currentPlan, billingSettings, usage, plans, business } = billingData;

  const isActive = subscription.status === "active";
  const isPending = subscription.status === "pending";
  const isPastDue = subscription.status === "past_due";
  const hasBachsCustomer = Boolean(subscription.bachs_customer_id);

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "End of billing cycle";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const periodStart = formatDate(subscription.current_period_start);
  const periodEnd = formatDate(subscription.current_period_end || subscription.reset_date);
  const scheduledDowngrade = subscription.metadata?.scheduled_downgrade;

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 font-sans">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
              Billing & Subscription (USD)
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Account Billing
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your subscription, usage quotas, payment methods, and invoices powered by Bachs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {hasBachsCustomer && (
            <ManageBillingButton />
          )}
          <Button asChild variant="outline" className="rounded-2xl text-xs font-bold border-slate-200">
            <Link href="/pricing" target="_blank" className="flex items-center gap-1.5">
              <span>View Pricing</span>
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

      {/* Failed Payment Warning Banner */}
      {isPastDue && (
        <div className="p-6 bg-red-50 border border-red-200 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3.5">
            <AlertCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-red-950">Payment Failed: Renewal Past Due</h4>
              <p className="text-xs text-red-800 mt-0.5 leading-relaxed">
                We were unable to charge your card for the latest billing period. Please update your payment method to avoid service interruption.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <ManageBillingButton
              variant="default"
              className="bg-red-600 hover:bg-red-700 text-white font-bold h-11 px-6 shadow-md"
              label="Update Payment Method"
            />
          </div>
        </div>
      )}

      {/* Pending Payment Notice */}
      {isPending && !isPastDue && (
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3.5">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-950">Action Needed: Subscription Pending Payment</h4>
              <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                Your subscription is currently pending payment. Complete checkout via Bachs to activate your AI replies and quotas.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <UpgradeButton
              planId={subscription.plan === "growth" ? "growth" : "starter"}
              label={`Pay ${subscription.plan === "growth" ? "$10.00" : "$2.00"} USD`}
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
                  <span className="text-sm font-normal text-slate-500 ml-1">/mo</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Billed monthly in USD via Bachs
                </span>
              </div>
            </div>

            {/* Scheduled downgrade warning if active */}
            {scheduledDowngrade && (
              <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-amber-950">
                    Scheduled Downgrade to {String(scheduledDowngrade.target_plan).toUpperCase()}
                  </p>
                  <p className="text-amber-800 mt-0.5">
                    Your plan will automatically switch to {scheduledDowngrade.target_plan} on {formatDate(scheduledDowngrade.effective_at)}.
                  </p>
                </div>
                <DowngradeDialog
                  currentPlan={currentPlan.name}
                  targetPlan="starter"
                  targetPrice="$2.00/mo"
                  periodEndDate={periodEnd}
                  isScheduled={true}
                />
              </div>
            )}

            {/* Scheduled cancellation notice */}
            {subscription.cancel_at_period_end && (
              <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-950">Subscription Set to Cancel</p>
                  <p className="text-red-800 mt-0.5">
                    Your subscription will not renew. You maintain full access to your plan features until {periodEnd}.
                  </p>
                </div>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Subscription Controls</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update your tier, schedule downgrades, or access the Bachs customer portal.
                </p>
              </div>

              {hasBachsCustomer && (
                <ManageBillingButton />
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Downgrade Action (if on Growth) */}
              {subscription.plan === "growth" && isActive && (
                <DowngradeDialog
                  currentPlan={currentPlan.name}
                  targetPlan="starter"
                  targetPrice="$2.00/mo"
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
                    <span className="text-3xl font-black text-white">$10.00</span>
                    <span className="text-xs text-slate-400">/month</span>
                  </div>

                  <ul className="space-y-2 text-xs text-slate-300 py-2 border-y border-white/10">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>1,500 AI replies per billing cycle</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>Up to 3 AI assistants / widgets</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>100 knowledge sources</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>Remove Agentify branding</span>
                    </li>
                  </ul>
                </div>
              )}

              {subscription.plan === "starter" && (
                <UpgradeButton
                  planId="growth"
                  label="Upgrade to Growth ($10/mo)"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-12 shadow-lg shadow-indigo-600/30"
                />
              )}

              {subscription.plan === "growth" && (
                <Button asChild variant="outline" className="w-full rounded-2xl border-white/20 text-white hover:bg-white/10 font-bold h-12">
                  <Link href="/pricing#enterprise">Contact Enterprise Sales</Link>
                </Button>
              )}
            </div>
          </div>

          {/* SECTION E: Payment Methods Card */}
          <PaymentMethodsCard
            lastTransaction={history[0]}
            hasActiveCustomer={hasBachsCustomer}
          />

          {/* SECTION F: Billing Profile Information */}
          <BillingInfoForm
            initialData={{
              name: business?.name,
              contact_email: business?.contact_email,
              phone: business?.phone,
              address: business?.address,
              country: business?.country,
            }}
          />

        </div>

      </div>

    </div>
  );
}
