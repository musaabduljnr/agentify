"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  Building2,
  Globe,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  Save,
  Shield,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateBusinessSettings } from "@/lib/actions/chat";
import {
  updateNotificationSettings,
  updatePrivacySettings,
  updateProfileSettings,
  updateSecuritySettings,
} from "@/lib/actions/settings";
import { RepairButton } from "@/components/dashboard/repair-button";
import { cn } from "@/lib/utils";

type SettingsTab = "business" | "personal" | "notifications" | "security" | "privacy";

interface SettingsFormProps {
  initialBusiness: any;
  initialProfile: any;
  initialUser: {
    email?: string;
    user_metadata?: Record<string, any>;
  };
  initialWidgetConfig: any;
}

const tabs: { id: SettingsTab; icon: any; label: string }[] = [
  { id: "business", icon: Building2, label: "Business Profile" },
  { id: "personal", icon: User, label: "Personal Info" },
  { id: "notifications", icon: Bell, label: "Notifications" },
  { id: "security", icon: Shield, label: "Security" },
  { id: "privacy", icon: Lock, label: "Privacy" },
];

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <label className="flex items-center justify-between gap-6 rounded-2xl border border-slate-200 p-4 cursor-pointer hover:bg-slate-50">
      <span>
        <span className="block text-sm font-bold text-slate-900">{label}</span>
        <span className="block text-sm text-slate-500">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />
    </label>
  );
}

export function SettingsForm({
  initialBusiness,
  initialProfile,
  initialUser,
  initialWidgetConfig,
}: SettingsFormProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("business");
  const [loading, setLoading] = useState(false);
  const notificationDefaults = initialUser.user_metadata?.notification_settings || {};

  const [businessForm, setBusinessForm] = useState({
    name: initialBusiness?.name || "",
    website_url: initialBusiness?.website_url || "",
    contact_email: initialBusiness?.contact_email || "",
    phone: initialBusiness?.phone || "",
    address: initialBusiness?.address || "",
    industry: initialBusiness?.industry || "",
    description: initialBusiness?.description || "",
  });
  const [profileForm, setProfileForm] = useState({
    full_name: initialProfile?.full_name || initialUser.user_metadata?.full_name || "",
    email: initialProfile?.email || initialUser.email || "",
  });
  const [notificationForm, setNotificationForm] = useState({
    lead_email_alerts: notificationDefaults.lead_email_alerts ?? true,
    conversation_email_alerts: notificationDefaults.conversation_email_alerts ?? true,
    billing_email_alerts: notificationDefaults.billing_email_alerts ?? true,
    weekly_summary: notificationDefaults.weekly_summary ?? false,
  });
  const [securityForm, setSecurityForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [privacyForm, setPrivacyForm] = useState({
    collect_leads: initialWidgetConfig?.collect_leads ?? true,
    show_branding: initialWidgetConfig?.show_branding ?? true,
    is_enabled: initialWidgetConfig?.is_enabled ?? true,
    allowed_domains: (initialWidgetConfig?.allowed_domains || []).join("\n"),
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      const result =
        activeTab === "business"
          ? await updateBusinessSettings(businessForm)
          : activeTab === "personal"
            ? await updateProfileSettings(profileForm)
            : activeTab === "notifications"
              ? await updateNotificationSettings(notificationForm)
              : activeTab === "security"
                ? await updateSecuritySettings(securityForm)
                : await updatePrivacySettings({
                    ...privacyForm,
                    allowed_domains: privacyForm.allowed_domains.split(/\r?\n|,/),
                  });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Settings saved successfully.");
        if (activeTab === "security") {
          setSecurityForm({ current_password: "", new_password: "", confirm_password: "" });
        }
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-10">
      {/* Horizontal scrollable tabs on mobile, vertical sidebar on lg+ */}
      <div className="lg:hidden -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto">
        <div className="flex gap-2 pb-2 min-w-max">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all",
                activeTab === item.id
                  ? "bg-white border border-slate-200 text-indigo-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/70"
              )}
            >
              <item.icon className={cn("w-4 h-4", activeTab === item.id ? "text-indigo-600" : "text-slate-400")} />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="hidden lg:block lg:col-span-1 space-y-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-6 py-4 rounded-2xl text-sm font-bold transition-all",
              activeTab === item.id
                ? "bg-white border border-slate-200 text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/70"
            )}
          >
            <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-indigo-600" : "text-slate-400")} />
            {item.label}
          </button>
        ))}

        <div className="mt-10 p-6 bg-indigo-600 rounded-[2rem] text-white shadow-xl shadow-indigo-200">
          <h4 className="font-black mb-2">Need a Repair?</h4>
          <p className="text-xs text-indigo-100 mb-4 font-medium leading-relaxed">
            If your assistant or settings are not loading correctly, try repairing your setup.
          </p>
          <RepairButton className="w-full rounded-xl h-10 text-xs font-bold text-indigo-600" />
        </div>
      </div>

      <div className="lg:col-span-3 space-y-8">
        <div className="mb-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Settings</h1>
            <p className="text-slate-500">Manage your account, business, assistant notifications, and widget privacy.</p>
          </div>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl h-12 px-8 flex items-center gap-2 font-bold shadow-lg shadow-indigo-100 min-w-[160px]"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Settings
          </Button>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 sm:p-8 md:p-10">
          {activeTab === "business" && (
            <div className="space-y-8">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-6 h-6 text-indigo-600" />
                Business Profile
              </h3>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Business ID</label>
                <code className="block bg-slate-50 text-slate-600 px-4 py-3 rounded-2xl border border-slate-200 font-mono text-sm overflow-x-auto">
                  {initialBusiness?.id || "N/A"}
                </code>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Field icon={Building2} label="Business Name" value={businessForm.name} onChange={(value) => setBusinessForm({ ...businessForm, name: value })} />
                <Field icon={Globe} label="Website URL" type="url" value={businessForm.website_url} onChange={(value) => setBusinessForm({ ...businessForm, website_url: value })} />
                <Field icon={Mail} label="Contact Email" type="email" value={businessForm.contact_email} onChange={(value) => setBusinessForm({ ...businessForm, contact_email: value })} />
                <Field icon={Phone} label="Phone Number" type="tel" value={businessForm.phone} onChange={(value) => setBusinessForm({ ...businessForm, phone: value })} />
              </div>
              <Field label="Industry" value={businessForm.industry} onChange={(value) => setBusinessForm({ ...businessForm, industry: value })} />
              <TextareaField icon={MapPin} label="Business Address" rows={3} value={businessForm.address} onChange={(value) => setBusinessForm({ ...businessForm, address: value })} />
              <TextareaField label="Full Description" rows={5} value={businessForm.description} onChange={(value) => setBusinessForm({ ...businessForm, description: value })} />
            </div>
          )}

          {activeTab === "personal" && (
            <div className="space-y-8">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <User className="w-6 h-6 text-indigo-600" />
                Personal Info
              </h3>
              <Field icon={User} label="Full Name" value={profileForm.full_name} onChange={(value) => setProfileForm({ ...profileForm, full_name: value })} />
              <Field icon={Mail} label="Login Email" type="email" value={profileForm.email} onChange={(value) => setProfileForm({ ...profileForm, email: value })} />
              <p className="text-sm text-slate-500">
                Changing your login email may require email confirmation before it becomes active.
              </p>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-5">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Bell className="w-6 h-6 text-indigo-600" />
                Notifications
              </h3>
              <Toggle checked={notificationForm.lead_email_alerts} onChange={(value) => setNotificationForm({ ...notificationForm, lead_email_alerts: value })} label="Lead alerts" description="Email me when the assistant captures a new lead." />
              <Toggle checked={notificationForm.conversation_email_alerts} onChange={(value) => setNotificationForm({ ...notificationForm, conversation_email_alerts: value })} label="Conversation alerts" description="Email me when a visitor starts a new conversation." />
              <Toggle checked={notificationForm.billing_email_alerts} onChange={(value) => setNotificationForm({ ...notificationForm, billing_email_alerts: value })} label="Billing alerts" description="Send payment, subscription, and usage limit notifications." />
              <Toggle checked={notificationForm.weekly_summary} onChange={(value) => setNotificationForm({ ...notificationForm, weekly_summary: value })} label="Weekly summary" description="Receive a weekly digest of conversations, leads, and usage." />
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-8">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-6 h-6 text-indigo-600" />
                Security
              </h3>
              <Field icon={Lock} label="Current Password" type="password" value={securityForm.current_password} onChange={(value) => setSecurityForm({ ...securityForm, current_password: value })} />
              <Field icon={Lock} label="New Password" type="password" value={securityForm.new_password} onChange={(value) => setSecurityForm({ ...securityForm, new_password: value })} />
              <Field icon={Lock} label="Confirm New Password" type="password" value={securityForm.confirm_password} onChange={(value) => setSecurityForm({ ...securityForm, confirm_password: value })} />
            </div>
          )}

          {activeTab === "privacy" && (
            <div className="space-y-5">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-6 h-6 text-indigo-600" />
                Privacy
              </h3>
              <Toggle checked={privacyForm.is_enabled} onChange={(value) => setPrivacyForm({ ...privacyForm, is_enabled: value })} label="Enable public widget" description="Allow the embedded chat widget to load on approved websites." />
              <Toggle checked={privacyForm.collect_leads} onChange={(value) => setPrivacyForm({ ...privacyForm, collect_leads: value })} label="Collect lead details" description="Allow the assistant to request and store visitor contact details." />
              <Toggle checked={privacyForm.show_branding} onChange={(value) => setPrivacyForm({ ...privacyForm, show_branding: value })} label="Show Agentify branding" description="Display Agentify branding inside the customer chat widget." />
              <TextareaField label="Allowed Domains" rows={5} value={privacyForm.allowed_domains} onChange={(value) => setPrivacyForm({ ...privacyForm, allowed_domains: value })} placeholder={"example.com\nwww.example.com"} />
              <p className="text-sm text-slate-500">
                Leave allowed domains empty only if you intentionally want the widget available anywhere.
              </p>
            </div>
          )}
        </div>

        <div className="bg-red-50 rounded-3xl border border-red-100 p-5 sm:p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
          <div>
            <h4 className="text-red-900 font-extrabold text-lg mb-1">Danger Zone</h4>
            <p className="text-red-700 text-sm font-medium">Permanently delete your business account and all associated data.</p>
          </div>
          <Button variant="outline" className="bg-white text-red-600 border border-red-200 hover:bg-red-600 hover:text-white rounded-2xl h-12 px-8 font-bold transition-all shrink-0">
            Delete Account
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  type = "text",
  value,
  onChange,
}: {
  icon?: any;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold text-slate-700 ml-1">{label}</label>
      <div className="relative">
        {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />}
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "w-full pr-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium",
            Icon ? "pl-12" : "pl-4"
          )}
        />
      </div>
    </div>
  );
}

function TextareaField({
  icon: Icon,
  label,
  rows,
  value,
  onChange,
  placeholder,
}: {
  icon?: any;
  label: string;
  rows: number;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold text-slate-700 ml-1">{label}</label>
      <div className="relative">
        {Icon && <Icon className="absolute left-4 top-4 w-4 h-4 text-slate-400" />}
        <textarea
          rows={rows}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full pr-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium resize-none",
            Icon ? "pl-12" : "pl-4"
          )}
        />
      </div>
    </div>
  );
}
