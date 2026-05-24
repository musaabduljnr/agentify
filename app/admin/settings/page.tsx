"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CreditCard, Loader2, Save, Settings, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getAdminBillingSettings,
  updateAdminBillingSettings,
} from "@/lib/actions/admin";
import type { BillingPlatformSettings, EditablePlanConfig } from "@/lib/billing/platform";

type LimitKey = "price_ngn" | "messages" | "knowledge_sources" | "leads" | "widgets" | "embeddings";

const LIMIT_FIELDS: { key: LimitKey; label: string; allowUnlimited?: boolean }[] = [
  { key: "price_ngn", label: "Price" },
  { key: "messages", label: "Messages", allowUnlimited: true },
  { key: "knowledge_sources", label: "Knowledge", allowUnlimited: true },
  { key: "leads", label: "Leads", allowUnlimited: true },
  { key: "widgets", label: "Widgets", allowUnlimited: true },
  { key: "embeddings", label: "Embeddings", allowUnlimited: true },
];

function parseNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<BillingPlatformSettings>({
    currency: "NGN",
    currency_symbol: "₦",
    default_payment_provider: "paystack",
  });
  const [plans, setPlans] = useState<EditablePlanConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    getAdminBillingSettings()
      .then((data) => {
        if (!mounted) return;
        setSettings(data.settings);
        setPlans(data.plans);
      })
      .catch((error) => {
        setFeedback({ type: "error", text: error.message || "Failed to load billing settings." });
      })
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, []);

  const updatePlan = (planId: string, patch: Partial<EditablePlanConfig>) => {
    setPlans((prev) => prev.map((plan) => (plan.id === planId ? { ...plan, ...patch } : plan)));
  };

  const updatePlanLimit = (planId: string, key: LimitKey, value: string) => {
    updatePlan(planId, { [key]: parseNumber(value) } as Partial<EditablePlanConfig>);
  };

  const updateFeature = (planId: string, index: number, value: string) => {
    setPlans((prev) =>
      prev.map((plan) => {
        if (plan.id !== planId) return plan;
        const features = [...plan.features];
        features[index] = value;
        return { ...plan, features };
      })
    );
  };

  const addFeature = (planId: string) => {
    setPlans((prev) =>
      prev.map((plan) => (plan.id === planId ? { ...plan, features: [...plan.features, ""] } : plan))
    );
  };

  const removeFeature = (planId: string, index: number) => {
    setPlans((prev) =>
      prev.map((plan) => {
        if (plan.id !== planId) return plan;
        return { ...plan, features: plan.features.filter((_, i) => i !== index) };
      })
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);

    const result = await updateAdminBillingSettings({ settings, plans });
    if (result.error) {
      setFeedback({ type: "error", text: result.error });
    } else {
      setFeedback({ type: "success", text: "Billing plans and platform currency updated." });
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading platform settings...
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-400">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h1 className="mb-1 text-3xl font-extrabold tracking-tight text-white">Platform Settings</h1>
          <p className="text-sm text-slate-400">
            Manage platform currency, payment routing, and every public subscription plan.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-2xl border p-4 text-xs font-semibold ${
            feedback.type === "success"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/20 bg-red-500/10 text-red-400"
          }`}
        >
          {feedback.type === "success" ? <ShieldCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {feedback.text}
        </div>
      )}

      <div className="rounded-3xl border border-slate-800 bg-slate-950 p-8">
        <h3 className="mb-5 flex items-center gap-2 border-b border-slate-900 pb-3 text-sm font-bold uppercase tracking-wider text-white">
          <CreditCard className="h-4 w-4 text-indigo-400" />
          Currency & Checkout
        </h3>
        <div className="grid grid-cols-1 gap-5 text-xs md:grid-cols-3">
          <label className="space-y-2">
            <span className="block font-bold text-slate-400">Currency Code</span>
            <input
              value={settings.currency}
              onChange={(e) => setSettings({ ...settings, currency: e.target.value.toUpperCase() })}
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 font-semibold text-slate-200 outline-none focus:border-indigo-500"
              placeholder="NGN"
              maxLength={3}
            />
          </label>
          <label className="space-y-2">
            <span className="block font-bold text-slate-400">Currency Symbol</span>
            <input
              value={settings.currency_symbol}
              onChange={(e) => setSettings({ ...settings, currency_symbol: e.target.value })}
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 font-semibold text-slate-200 outline-none focus:border-indigo-500"
              placeholder="₦"
            />
          </label>
          <label className="space-y-2">
            <span className="block font-bold text-slate-400">Default Provider</span>
            <select
              value={settings.default_payment_provider}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  default_payment_provider: e.target.value as BillingPlatformSettings["default_payment_provider"],
                })
              }
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 font-semibold text-slate-200 outline-none focus:border-indigo-500"
            >
              <option value="paystack">Paystack</option>
              <option value="flutterwave">Flutterwave</option>
              <option value="manual">Manual</option>
            </select>
          </label>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-white">
            <Sparkles className="h-5 w-5 text-indigo-400" />
            Editable Plans
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Leave a limit empty for unlimited. Leave paid plan codes empty to use one-time checkout.
          </p>
        </div>

        {plans.map((plan) => (
          <div key={plan.id} className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{plan.id}</p>
                <input
                  value={plan.name}
                  onChange={(e) => updatePlan(plan.id, { name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-lg font-extrabold text-white outline-none focus:border-indigo-500 md:w-80"
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <input
                  type="checkbox"
                  checked={Boolean(plan.contact_sales)}
                  onChange={(e) => updatePlan(plan.id, { contact_sales: e.target.checked })}
                />
                Contact sales plan
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 text-xs md:grid-cols-3 lg:grid-cols-6">
              {LIMIT_FIELDS.map((field) => (
                <label key={field.key} className="space-y-2">
                  <span className="block font-bold text-slate-400">{field.label}</span>
                  <input
                    type="number"
                    min={0}
                    value={plan[field.key] ?? ""}
                    onChange={(e) => updatePlanLimit(plan.id, field.key, e.target.value)}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 font-semibold text-slate-200 outline-none focus:border-indigo-500"
                    placeholder={field.allowUnlimited ? "Unlimited" : "Custom"}
                  />
                </label>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
              <label className="space-y-2">
                <span className="block font-bold text-slate-400">Paystack Plan Code</span>
                <input
                  value={plan.paystack_plan_code || ""}
                  onChange={(e) => updatePlan(plan.id, { paystack_plan_code: e.target.value })}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 font-semibold text-slate-200 outline-none focus:border-indigo-500"
                  placeholder="PLN_xxx or blank"
                />
              </label>
              <label className="space-y-2">
                <span className="block font-bold text-slate-400">Flutterwave Plan ID</span>
                <input
                  value={plan.flutterwave_plan_id || ""}
                  onChange={(e) => updatePlan(plan.id, { flutterwave_plan_id: e.target.value })}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 font-semibold text-slate-200 outline-none focus:border-indigo-500"
                  placeholder="Optional"
                />
              </label>
            </div>

            <div className="mt-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Features</p>
              {plan.features.map((feature, index) => (
                <div key={`${plan.id}-${index}`} className="flex gap-2">
                  <input
                    value={feature}
                    onChange={(e) => updateFeature(plan.id, index, e.target.value)}
                    className="flex-1 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-semibold text-slate-200 outline-none focus:border-indigo-500"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => removeFeature(plan.id, index)}
                    className="rounded-2xl border border-red-500/20 text-xs font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                onClick={() => addFeature(plan.id)}
                className="rounded-2xl border border-indigo-500/20 text-xs font-bold text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300"
              >
                Add Feature
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-4 flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="h-12 rounded-2xl bg-indigo-600 px-6 text-xs font-bold uppercase tracking-wider text-white hover:bg-indigo-500"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Billing Settings
        </Button>
      </div>
    </div>
  );
}
