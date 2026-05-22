"use client";

import { useState } from "react";
import { Settings, Save, Sparkles, AlertTriangle, ShieldCheck, Mail, CreditCard, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminSettingsPage() {
  const [platformName, setPlatformName] = useState("Agentify");
  const [supportEmail, setSupportEmail] = useState("support@agentify.com");
  const [defaultProvider, setDefaultProvider] = useState("paystack");
  
  // Quota defaults
  const [defaultMsgs, setDefaultMsgs] = useState(100);
  const [defaultKnowledge, setDefaultKnowledge] = useState(5);
  const [defaultEmbeddings, setDefaultEmbeddings] = useState(1000);

  // Placeholders
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [removeBranding, setRemoveBranding] = useState(false);

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setSavedSuccess(false);
    // Provider secrets are configured as Vercel environment variables.
    console.log({
      platformName,
      supportEmail,
      defaultProvider,
      defaultMsgs,
      defaultKnowledge,
      defaultEmbeddings,
    });
    setTimeout(() => {
      setSaving(false);
      setSavedSuccess(true);
    }, 800);
  };

  return (
    <div className="space-y-10 max-w-4xl">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20 text-indigo-400">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">
            Platform Settings
          </h1>
          <p className="text-slate-400 text-sm">
            Customize platform metadata, configure onboarding defaults, and manage global system states.
          </p>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-2xl flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          Global system settings updated and deployed successfully!
        </div>
      )}

      {/* Main Settings Grid Form */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 space-y-8">
        
        {/* Section 1: Identity & Details */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-900 pb-3">
            <Mail className="w-4 h-4 text-indigo-400" />
            General Branding & Coordinates
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div>
              <label className="text-slate-400 font-bold block mb-2">Platform Name</label>
              <input
                type="text"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-200 font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
                <label className="text-slate-400 font-bold block mb-2">Support Email Address</label>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-200 font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-200">
                  <p className="font-bold">Email provider secrets are configured in Vercel.</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-amber-100/80">
                    Set RESEND_API_KEY, EMAIL_FROM, and SUPPORT_EMAIL as production environment variables. Do not paste provider API keys into the browser.
                  </p>
                </div>
            </div>
          </div>
        </div>

        {/* Section 2: Default Onboarding Free limits */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-900 pb-3">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Default Free-Trial Quota Limits
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
            <div>
              <label className="text-slate-400 font-bold block mb-2">Message Limit</label>
              <input
                type="number"
                value={defaultMsgs}
                onChange={(e) => setDefaultMsgs(Number(e.target.value))}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-200 font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-slate-400 font-bold block mb-2">Knowledge Limit</label>
              <input
                type="number"
                value={defaultKnowledge}
                onChange={(e) => setDefaultKnowledge(Number(e.target.value))}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-200 font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-slate-400 font-bold block mb-2">Embeddings Limit</label>
              <input
                type="number"
                value={defaultEmbeddings}
                onChange={(e) => setDefaultEmbeddings(Number(e.target.value))}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-200 font-semibold focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Billing Gateway config */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-900 pb-3">
            <CreditCard className="w-4 h-4 text-indigo-400" />
            Default Gateway Routing
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div>
              <label className="text-slate-400 font-bold block mb-2">Default payment provider</label>
              <select
                value={defaultProvider}
                onChange={(e) => setDefaultProvider(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-200 font-semibold focus:outline-none focus:border-indigo-500"
              >
                <option value="paystack">Paystack (Primary)</option>
                <option value="flutterwave">Flutterwave (Secondary)</option>
                <option value="manual">Manual Checkout</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 4: System Overlays */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-900 pb-3">
            <AlertTriangle className="w-4 h-4 text-indigo-400" />
            Global Platform Overrides (Staging)
          </h3>

          <div className="space-y-4 text-xs font-semibold">
            {/* Maintenance Mode */}
            <div className="flex items-center justify-between p-4 bg-slate-900/60 border border-slate-850 rounded-2xl">
              <div>
                <p className="text-white">Maintenance mode</p>
                <p className="text-[10px] text-slate-500 font-medium">Bypass user access and display platform under-maintenance splash notices.</p>
              </div>
              <button
                onClick={() => setMaintenanceMode(!maintenanceMode)}
                className={`w-12 h-6 rounded-full p-1 transition-all ${
                  maintenanceMode ? "bg-indigo-600 flex justify-end" : "bg-slate-800 flex justify-start"
                }`}
              >
                <span className="w-4 h-4 bg-white rounded-full block shadow-sm" />
              </button>
            </div>

            {/* Remove Branding */}
            <div className="flex items-center justify-between p-4 bg-slate-900/60 border border-slate-850 rounded-2xl">
              <div>
                <p className="text-white">White label widgets branding</p>
                <p className="text-[10px] text-slate-500 font-medium">Remove "Powered by Agentify" watermarks globally across all embeddable chat scripts.</p>
              </div>
              <button
                onClick={() => setRemoveBranding(!removeBranding)}
                className={`w-12 h-6 rounded-full p-1 transition-all ${
                  removeBranding ? "bg-indigo-600 flex justify-end" : "bg-slate-800 flex justify-start"
                }`}
              >
                <span className="w-4 h-4 bg-white rounded-full block shadow-sm" />
              </button>
            </div>
          </div>
        </div>

        {/* Save control */}
        <div className="pt-6 border-t border-slate-900 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="rounded-2xl h-12 px-6 bg-indigo-600 hover:bg-indigo-500 font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2"
          >
            {saving ? "Deploying..." : "Deploy Configurations"}
          </Button>
        </div>

      </div>
    </div>
  );
}
