"use client";

import { useState } from "react";
import {
  updatePlatformConfig,
  updateSecretConfig,
  deletePlatformConfig,
  testResendConfig,
  testSmtpConfig,
  testPaystackConfig,
  testFlutterwaveConfig,
} from "@/lib/actions/admin-config";
import {
  SlidersHorizontal,
  Mail,
  CreditCard,
  Cpu,
  ToggleLeft,
  ShieldAlert,
  Send,
  Trash2,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Info,
  Server,
  Network,
  Settings,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ConfigItem {
  category: string;
  key: string;
  value: string | null;
  preview: string;
  hasValue: boolean;
}

interface ConfigurationCenterProps {
  initialConfigs: ConfigItem[];
}

export function ConfigurationCenter({ initialConfigs }: ConfigurationCenterProps) {
  const [configs, setConfigs] = useState<ConfigItem[]>(initialConfigs);
  const [activeTab, setActiveTab] = useState("platform");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);

  // Helper to get configuration item
  const getConf = (category: string, key: string): ConfigItem => {
    return (
      configs.find((c) => c.category === category && c.key === key) || {
        category,
        key,
        value: "",
        preview: "Not configured",
        hasValue: false,
      }
    );
  };

  // State to track editing of secrets (e.g., {'resend:api_key': true})
  const [editingSecret, setEditingSecret] = useState<Record<string, boolean>>({});
  // State to track temporary input values for edits
  const [tempValues, setTempValues] = useState<Record<string, string>>({});
  // State for email test addresses
  const [testEmailAddress, setTestEmailAddress] = useState("");

  const isEditing = (category: string, key: string) => {
    const config = getConf(category, key);
    return !config.hasValue || editingSecret[`${category}:${key}`];
  };

  const handleInputChange = (category: string, key: string, val: string) => {
    setTempValues((prev) => ({ ...prev, [`${category}:${key}`]: val }));
  };

  const startEdit = (category: string, key: string) => {
    setEditingSecret((prev) => ({ ...prev, [`${category}:${key}`]: true }));
    setTempValues((prev) => ({ ...prev, [`${category}:${key}`]: "" }));
  };

  const cancelEdit = (category: string, key: string) => {
    setEditingSecret((prev) => ({ ...prev, [`${category}:${key}`]: false }));
  };

  // Saves a configuration
  const handleSave = async (category: string, key: string, isSecret: boolean = false) => {
    const fieldId = `${category}:${key}`;
    const value = tempValues[fieldId] ?? "";

    if (isSecret && !value) {
      toast.error("Secret value cannot be empty.");
      return;
    }

    setSavingKey(fieldId);
    try {
      let res;
      if (isSecret) {
        res = await updateSecretConfig(category, key, value);
      } else {
        res = await updatePlatformConfig(category, key, value);
      }

      if (res.success) {
        toast.success(`Configuration '${key}' updated successfully.`);
        // Refresh local state by simulating the update
        setConfigs((prev) =>
          prev.map((c) => {
            if (c.category === category && c.key === key) {
              return {
                ...c,
                hasValue: true,
                value: isSecret ? null : value,
                preview: isSecret ? `${value.substring(0, 8)}••••••${value.slice(-4)}` : value,
              };
            }
            return c;
          })
        );
        cancelEdit(category, key);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save configuration.");
    } finally {
      setSavingKey(null);
    }
  };

  // Removes a configuration
  const handleRemove = async (category: string, key: string) => {
    if (!confirm(`Are you sure you want to remove configuration '${key}'?`)) {
      return;
    }

    const fieldId = `${category}:${key}`;
    setSavingKey(fieldId);
    try {
      const res = await deletePlatformConfig(category, key);
      if (res.success) {
        toast.success(`Configuration '${key}' deleted.`);
        setConfigs((prev) =>
          prev.map((c) => {
            if (c.category === category && c.key === key) {
              return {
                ...c,
                hasValue: false,
                value: null,
                preview: "Not configured",
              };
            }
            return c;
          })
        );
        cancelEdit(category, key);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete configuration.");
    } finally {
      setSavingKey(null);
    }
  };

  // Toggle boolean config instantly
  const handleToggle = async (category: string, key: string) => {
    const config = getConf(category, key);
    const currentValue = config.value === "true";
    const newValue = (!currentValue).toString();
    const fieldId = `${category}:${key}`;

    setSavingKey(fieldId);
    try {
      const res = await updatePlatformConfig(category, key, newValue);
      if (res.success) {
        toast.success(`Feature '${key}' ${newValue === "true" ? "enabled" : "disabled"}.`);
        setConfigs((prev) =>
          prev.map((c) => {
            if (c.category === category && c.key === key) {
              return {
                ...c,
                hasValue: true,
                value: newValue,
                preview: newValue,
              };
            }
            return c;
          })
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle configuration.");
    } finally {
      setSavingKey(null);
    }
  };

  // Run provider connectivity tests
  const runTest = async (category: string) => {
    setTestingKey(category);
    toast.info(`Running connectivity test for ${category.toUpperCase()}...`);
    try {
      let res;
      if (category === "resend") {
        if (!testEmailAddress) {
          toast.error("Please enter a test email address in the Email settings sidebar.");
          setTestingKey(null);
          return;
        }
        res = await testResendConfig(testEmailAddress);
      } else if (category === "smtp") {
        if (!testEmailAddress) {
          toast.error("Please enter a test email address in the Email settings sidebar.");
          setTestingKey(null);
          return;
        }
        res = await testSmtpConfig(testEmailAddress);
      } else if (category === "paystack") {
        res = await testPaystackConfig();
      } else if (category === "flutterwave") {
        res = await testFlutterwaveConfig();
      }

      if (res?.success) {
        toast.success(`Connectivity test passed for ${category.toUpperCase()}!`);
      }
    } catch (err: any) {
      toast.error(err.message || `Test failed for ${category}. Check credentials.`);
    } finally {
      setTestingKey(null);
    }
  };

  const tabs = [
    { id: "platform", name: "Platform", icon: <SlidersHorizontal className="w-4 h-4" /> },
    { id: "email", name: "Email", icon: <Mail className="w-4 h-4" /> },
    { id: "smtp", name: "SMTP Settings", icon: <Server className="w-4 h-4" /> },
    { id: "resend", name: "Resend Mails", icon: <Send className="w-4 h-4" /> },
    { id: "paystack", name: "Paystack", icon: <CreditCard className="w-4 h-4" /> },
    { id: "flutterwave", name: "Flutterwave", icon: <Network className="w-4 h-4" /> },
    { id: "ai", name: "AI Providers", icon: <Cpu className="w-4 h-4" /> },
    { id: "feature_flags", name: "Feature Flags", icon: <ToggleLeft className="w-4 h-4" /> },
    { id: "security", name: "Security Center", icon: <ShieldAlert className="w-4 h-4" /> },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* 1. Sidebar Tab Navigation */}
      <div className="lg:col-span-1 space-y-3">
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-4 flex flex-col gap-1">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2">
            Categories
          </p>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all duration-200 border ${
                activeTab === tab.id
                  ? "bg-indigo-600/10 border-indigo-500/20 text-indigo-400"
                  : "bg-transparent border-transparent text-slate-400 hover:text-white hover:bg-slate-900/60"
              }`}
            >
              {tab.icon}
              {tab.name}
            </button>
          ))}
        </div>

        {/* Dynamic Context Sidebar Box (Test Email Dispatch Panel) */}
        {(activeTab === "resend" || activeTab === "smtp" || activeTab === "email") && (
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-4">
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-indigo-400" />
              Email Testing Utility
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Provide a valid recipient address to test your SMTP or Resend configs on-the-fly.
            </p>
            <div className="space-y-2">
              <input
                type="email"
                placeholder="test@example.com"
                value={testEmailAddress}
                onChange={(e) => setTestEmailAddress(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. Main Content Form Pane */}
      <div className="lg:col-span-3 bg-slate-950 border border-slate-800 rounded-3xl p-8 min-h-[500px] flex flex-col justify-between">
        <div className="space-y-6">
          {/* Active Tab Header */}
          <div className="border-b border-slate-900 pb-4">
            <h2 className="text-xl font-bold text-white capitalize tracking-tight flex items-center gap-2">
              {tabs.find((t) => t.id === activeTab)?.icon}
              {activeTab.replace("_", " ")} Configurations
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Manage all {activeTab.replace("_", " ")} variables, settings, keys, and credentials securely.
            </p>
          </div>

          {/* ==================== TAB: PLATFORM ==================== */}
          {activeTab === "platform" && (
            <div className="space-y-6">
              {renderPlainInput(
                "platform",
                "app_url",
                "App URL",
                "The canonical URL where Agentify is deployed (e.g. https://agentify.co).",
                "https://agentify.co"
              )}
              {renderPlainInput(
                "platform",
                "support_email",
                "Support Email",
                "Contact email returned to users for custom platform queries.",
                "support@yourdomain.com"
              )}
              {renderSelect(
                "platform",
                "default_payment_provider",
                "Default Payment Provider",
                "Standard provider selected for subscriptions.",
                ["paystack", "flutterwave", "manual"]
              )}
              {renderSelect(
                "platform",
                "default_ai_provider",
                "Default AI Provider",
                "Default provider for primary LLM operations.",
                ["gemini", "openrouter", "vertex", "groq"]
              )}
            </div>
          )}

          {/* ==================== TAB: EMAIL ==================== */}
          {activeTab === "email" && (
            <div className="space-y-6">
              {renderSelect(
                "email",
                "default_provider",
                "Default Email Provider",
                "Configure how emails are dispatched globally.",
                ["resend", "smtp", "brevo_future"]
              )}
              {renderPlainInput(
                "email",
                "from_email",
                "Sender Email (From)",
                "Sender address for transactional notifications (e.g. hello@yourdomain.com).",
                "hello@yourdomain.com"
              )}
              {renderPlainInput(
                "email",
                "from_name",
                "Sender Name",
                "Display name associated with the sender address.",
                "Agentify Support"
              )}
              {renderPlainInput(
                "email",
                "reply_to_email",
                "Reply-To Email Address",
                "Destination address for user replies.",
                "support@yourdomain.com"
              )}
            </div>
          )}

          {/* ==================== TAB: SMTP ==================== */}
          {activeTab === "smtp" && (
            <div className="space-y-6">
              {renderPlainInput("smtp", "host", "SMTP Host", "SMTP server address.", "smtp.gmail.com")}
              {renderPlainInput("smtp", "port", "SMTP Port", "Server port (usually 465 or 587).", "465")}
              {renderPlainInput("smtp", "username", "SMTP Username", "Authorizing account username.", "user@example.com")}
              {renderSecretInput("smtp", "password", "SMTP Password", "Authentication credential password.")}
              {renderBooleanToggle(
                "smtp",
                "secure",
                "SMTP Secure Connection",
                "Enable SSL/TLS encryption protocol wrapper."
              )}

              <div className="pt-4 border-t border-slate-900 flex justify-end">
                <Button
                  onClick={() => runTest("smtp")}
                  disabled={testingKey !== null}
                  variant="outline"
                  className="rounded-xl h-10 border-slate-800 hover:bg-slate-900 text-xs font-bold text-slate-300 flex items-center gap-2"
                >
                  {testingKey === "smtp" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                  Dispatch Test SMTP Email
                </Button>
              </div>
            </div>
          )}

          {/* ==================== TAB: RESEND ==================== */}
          {activeTab === "resend" && (
            <div className="space-y-6">
              {renderSecretInput("resend", "api_key", "Resend API Key", "API key from your Resend developer settings.")}
              {renderPlainInput(
                "email",
                "from_email",
                "From Email (Verified Domain)",
                "Must be a verified sender domain in Resend.",
                "hello@yourdomain.com"
              )}
              {renderPlainInput("email", "from_name", "From Name", "Sender name display.")}
              {renderPlainInput("email", "reply_to_email", "Reply-To Email", "Optional reply-to override.")}

              <div className="pt-4 border-t border-slate-900 flex justify-end">
                <Button
                  onClick={() => runTest("resend")}
                  disabled={testingKey !== null}
                  variant="outline"
                  className="rounded-xl h-10 border-slate-800 hover:bg-slate-900 text-xs font-bold text-slate-300 flex items-center gap-2"
                >
                  {testingKey === "resend" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                  Dispatch Test Resend Email
                </Button>
              </div>
            </div>
          )}

          {/* ==================== TAB: PAYSTACK ==================== */}
          {activeTab === "paystack" && (
            <div className="space-y-6">
              {renderSecretInput("paystack", "secret_key", "Paystack Secret Key", "Sensitive transaction verification API key.")}
              {renderPlainInput("paystack", "public_key", "Paystack Public Key", "API key safe to expose to browser.")}
              {renderSecretInput("paystack", "webhook_secret", "Paystack Webhook Secret", "Used to verify authentic Paystack event signature hooks.")}
              {renderPlainInput("paystack", "starter_plan_code", "Starter Plan Code", "Subscription plan code.")}
              {renderPlainInput("paystack", "growth_plan_code", "Growth Plan Code", "Subscription plan code.")}
              {renderBooleanToggle(
                "paystack",
                "test_mode",
                "Paystack Test Mode",
                "Toggles payment processing flow environment to staging/sandboxed transactions."
              )}

              <div className="pt-4 border-t border-slate-900 flex justify-end">
                <Button
                  onClick={() => runTest("paystack")}
                  disabled={testingKey !== null}
                  variant="outline"
                  className="rounded-xl h-10 border-slate-800 hover:bg-slate-900 text-xs font-bold text-slate-300 flex items-center gap-2"
                >
                  {testingKey === "paystack" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                  Verify Paystack Connection
                </Button>
              </div>
            </div>
          )}

          {/* ==================== TAB: FLUTTERWAVE ==================== */}
          {activeTab === "flutterwave" && (
            <div className="space-y-6">
              {renderSecretInput("flutterwave", "secret_key", "Flutterwave Secret Key", "Sensitive API transaction processing credential.")}
              {renderPlainInput("flutterwave", "public_key", "Flutterwave Public Key", "API key safe for frontend rendering.")}
              {renderSecretInput("flutterwave", "webhook_secret", "Flutterwave Webhook Secret", "Webhook validation signature hook.")}
              {renderPlainInput("flutterwave", "starter_plan_id", "Starter Plan ID", "Starter plan reference code.")}
              {renderPlainInput("flutterwave", "growth_plan_id", "Growth Plan ID", "Growth plan reference code.")}
              {renderBooleanToggle(
                "flutterwave",
                "test_mode",
                "Flutterwave Test Mode",
                "Toggles Flutterwave transactions to sandboxed environment."
              )}

              <div className="pt-4 border-t border-slate-900 flex justify-end">
                <Button
                  onClick={() => runTest("flutterwave")}
                  disabled={testingKey !== null}
                  variant="outline"
                  className="rounded-xl h-10 border-slate-800 hover:bg-slate-900 text-xs font-bold text-slate-300 flex items-center gap-2"
                >
                  {testingKey === "flutterwave" ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                  Verify Flutterwave Connection
                </Button>
              </div>
            </div>
          )}

          {/* ==================== TAB: AI PROVIDERS ==================== */}
          {activeTab === "ai" && (
            <div className="space-y-6">
              {renderSecretInput("ai", "gemini_api_key", "Gemini API Key", "API key for Google Gemini model access.")}
              {renderSecretInput("ai", "openrouter_api_key", "OpenRouter API Key", "Fallback keys for OpenRouter integrations.")}
              {renderSecretInput("ai", "groq_api_key", "Groq API Key", "Keys for Groq real-time inference.")}

              <div className="bg-indigo-600/5 border border-indigo-500/10 rounded-2xl p-5 mt-8 space-y-4">
                <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-2">
                  <Cpu className="w-4 h-4 shrink-0" />
                  Active Model Routing
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Default and fallback models, active engine types, and vector embedding options are configured dynamically inside the AI Engine workspace page.
                </p>
                <div className="flex">
                  <a
                    href="/admin/ai-settings"
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors border-b border-indigo-400/20 hover:border-indigo-300/30 pb-0.5"
                  >
                    Open AI Engine Settings Dashboard
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB: FEATURE FLAGS ==================== */}
          {activeTab === "feature_flags" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Toggling these flags instantly alters system functionality globally for all users without code changes.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderBooleanCard("feature_flags", "enable_emails", "Enable Emails", "Toggles system transactional email notifications.")}
                {renderBooleanCard("feature_flags", "enable_payments", "Enable Payments", "Toggles checkout session initiations and plans upgrades.")}
                {renderBooleanCard("feature_flags", "enable_widget", "Enable Embeddable Widget", "Toggles live widget scripts initialization.")}
                {renderBooleanCard("feature_flags", "enable_hosted_chat", "Enable Hosted Chat Pages", "Toggles landing/hosted chat slugs accessibility.")}
                {renderBooleanCard("feature_flags", "enable_demo_generator", "Enable Demo Generator", "Toggles sandbox generator features.")}
                {renderBooleanCard("feature_flags", "enable_admin_demo_crm", "Enable Admin CRM Demos", "Toggles admin overview demo pipelines access.")}
                {renderBooleanCard("feature_flags", "enable_analytics", "Enable Analytics Tracking", "Toggles dashboard and tracking log calculations.")}
                {renderBooleanCard("feature_flags", "enable_maintenance_mode", "Enable Maintenance Mode", "Puts Agentify in maintenance. Blocks client workspace routes.")}
              </div>
            </div>
          )}

          {/* ==================== TAB: SECURITY ==================== */}
          {activeTab === "security" && (
            <div className="space-y-6 text-xs leading-relaxed text-slate-300">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-indigo-400" />
                  Security Protocol & Architecture
                </h4>
                <p>
                  Agentify uses a <strong>Master Encryption Key</strong> (`CONFIG_ENCRYPTION_KEY`) set in your server hosting variables to encrypt credentials before committing records to Supabase storage.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
                  <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-2">
                    <p className="text-[10px] text-slate-500 uppercase">Encryption Algorithm</p>
                    <p className="text-white">AES-256-GCM (Galois/Counter Mode)</p>
                  </div>
                  <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-2">
                    <p className="text-[10px] text-slate-500 uppercase">Key Storage Rules</p>
                    <p className="text-red-400">Never saved in the DB or sent to client components.</p>
                  </div>
                </div>
              </div>

              <div className="bg-amber-600/5 border border-amber-500/10 rounded-2xl p-5 space-y-3">
                <h4 className="font-bold text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Critical Guidelines
                </h4>
                <ul className="list-disc pl-5 space-y-2 text-slate-400">
                  <li>Decrypted secrets are processed server-side in Server Actions or API routes only.</li>
                  <li>Browser network payloads, logs, public props, and JS bundles never contain raw secrets.</li>
                  <li>Rotating encryption keys requires re-encrypting existing secrets. Rotate keys in safe windows.</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render Helpers for Form Fields
  function renderPlainInput(
    category: string,
    key: string,
    label: string,
    desc: string,
    placeholder = ""
  ) {
    const config = getConf(category, key);
    const fieldId = `${category}:${key}`;
    const value = tempValues[fieldId] ?? config.value ?? "";

    return (
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <label className="text-slate-300 font-bold block">{label}</label>
          <span className="text-[9px] text-slate-500 font-mono">{key}</span>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) => handleInputChange(category, key, e.target.value)}
            className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-slate-200 focus:outline-none focus:border-indigo-500"
          />
          <Button
            onClick={() => handleSave(category, key, false)}
            disabled={savingKey === fieldId || value === (config.value ?? "")}
            className="rounded-2xl h-10 px-4 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white flex items-center gap-2"
          >
            {savingKey === fieldId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
          </Button>
        </div>
        <p className="text-[10px] text-slate-500">{desc}</p>
      </div>
    );
  }

  function renderSelect(
    category: string,
    key: string,
    label: string,
    desc: string,
    options: string[]
  ) {
    const config = getConf(category, key);
    const fieldId = `${category}:${key}`;
    const value = tempValues[fieldId] ?? config.value ?? options[0];

    return (
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <label className="text-slate-300 font-bold block">{label}</label>
          <span className="text-[9px] text-slate-500 font-mono">{key}</span>
        </div>
        <div className="flex gap-3">
          <select
            value={value}
            onChange={(e) => handleInputChange(category, key, e.target.value)}
            className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <Button
            onClick={() => handleSave(category, key, false)}
            disabled={savingKey === fieldId || value === (config.value ?? options[0])}
            className="rounded-2xl h-10 px-4 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white flex items-center gap-2"
          >
            {savingKey === fieldId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
          </Button>
        </div>
        <p className="text-[10px] text-slate-500">{desc}</p>
      </div>
    );
  }

  function renderBooleanToggle(category: string, key: string, label: string, desc: string) {
    const config = getConf(category, key);
    const fieldId = `${category}:${key}`;
    const isActive = config.value === "true";

    return (
      <div className="flex items-center justify-between p-4 bg-slate-900/60 border border-slate-850 rounded-2xl text-xs">
        <div className="space-y-1 pr-4">
          <label className="text-slate-300 font-bold block">{label}</label>
          <p className="text-[10px] text-slate-500">{desc}</p>
        </div>
        <button
          onClick={() => handleToggle(category, key)}
          disabled={savingKey === fieldId}
          className={`w-12 h-6 flex items-center rounded-full p-1 transition-all duration-300 ${
            isActive ? "bg-indigo-600 justify-end" : "bg-slate-800 justify-start"
          }`}
        >
          {savingKey === fieldId ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <span className="w-4 h-4 bg-white rounded-full shadow-md" />
          )}
        </button>
      </div>
    );
  }

  function renderBooleanCard(category: string, key: string, label: string, desc: string) {
    const config = getConf(category, key);
    const fieldId = `${category}:${key}`;
    const isActive = config.value === "true";

    return (
      <div className="p-4 bg-slate-900 border border-slate-850 rounded-2xl flex flex-col justify-between h-32 text-xs">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-bold text-white">{label}</span>
            <span className={`w-2 h-2 rounded-full ${isActive ? "bg-emerald-500" : "bg-red-500"}`} />
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-2">{desc}</p>
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-slate-850/30">
          <span className="text-[9px] text-slate-500 font-mono">{key}</span>
          <button
            onClick={() => handleToggle(category, key)}
            disabled={savingKey === fieldId}
            className={`px-3 py-1 rounded-lg font-bold text-[10px] transition-all uppercase tracking-wider ${
              isActive
                ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
            }`}
          >
            {savingKey === fieldId ? "Updating..." : isActive ? "Enabled" : "Disabled"}
          </button>
        </div>
      </div>
    );
  }

  function renderSecretInput(category: string, key: string, label: string, desc: string) {
    const config = getConf(category, key);
    const fieldId = `${category}:${key}`;
    const editing = isEditing(category, key);
    const value = tempValues[fieldId] ?? "";

    return (
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-slate-300 font-bold block">{label}</label>
            {config.hasValue ? (
              <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" />
                Configured
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[9px] font-bold bg-slate-800 text-slate-400 rounded-full border border-slate-700 flex items-center gap-1">
                <KeyRound className="w-2.5 h-2.5" />
                Not Configured
              </span>
            )}
          </div>
          <span className="text-[9px] text-slate-500 font-mono">{key}</span>
        </div>

        {editing ? (
          <div className="flex gap-3">
            <input
              type="password"
              placeholder="Enter new secret value"
              value={value}
              onChange={(e) => handleInputChange(category, key, e.target.value)}
              className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-850 rounded-2xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => handleSave(category, key, true)}
                disabled={savingKey === fieldId || !value}
                className="rounded-2xl h-10 px-4 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white flex items-center gap-2"
              >
                {savingKey === fieldId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
              </Button>
              {config.hasValue && (
                <Button
                  onClick={() => cancelEdit(category, key)}
                  disabled={savingKey === fieldId}
                  variant="outline"
                  className="rounded-2xl h-10 px-4 border-slate-800 hover:bg-slate-900 text-xs font-bold text-slate-400"
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between p-4 bg-slate-900/60 border border-slate-850 rounded-2xl">
            <div className="font-mono text-xs text-slate-400 select-none">
              {config.preview}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => startEdit(category, key)}
                className="rounded-xl h-9 px-3 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-white"
              >
                Replace
              </Button>
              <Button
                onClick={() => handleRemove(category, key)}
                disabled={savingKey === fieldId}
                variant="outline"
                className="rounded-xl h-9 px-3 border-slate-800 hover:bg-red-500/10 hover:text-red-400 text-[10px] font-bold text-slate-500 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </Button>
            </div>
          </div>
        )}
        <p className="text-[10px] text-slate-500">{desc}</p>
      </div>
    );
  }
}
