"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  Building2,
  Mail,
  Loader2,
  Save,
  Send,
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  sendTestEmailAction,
} from "@/lib/actions/settings";

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
    <label className="flex items-center justify-between gap-6 rounded-2xl border border-slate-200 p-5 cursor-pointer hover:bg-slate-50 transition-all">
      <span className="flex-1">
        <span className="block text-sm font-bold text-slate-900">{label}</span>
        <span className="block text-xs text-slate-500 mt-1 leading-relaxed">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
      />
    </label>
  );
}

export default function NotificationsSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [supportEmail, setSupportEmail] = useState("");
  const [contactEmailFallback, setContactEmailFallback] = useState("");
  const [form, setForm] = useState({
    email_new_leads: true,
    email_support_requests: true,
    email_booking_requests: true,
    email_usage_warnings: true,
    email_payment_updates: true,
  });

  useEffect(() => {
    let mounted = true;
    getNotificationPreferences()
      .then((data) => {
        if (!mounted) return;
        if (data.error) {
          toast.error(data.error);
        } else if (data.preferences) {
          setForm({
            email_new_leads: data.preferences.email_new_leads ?? true,
            email_support_requests: data.preferences.email_support_requests ?? true,
            email_booking_requests: data.preferences.email_booking_requests ?? true,
            email_usage_warnings: data.preferences.email_usage_warnings ?? true,
            email_payment_updates: data.preferences.email_payment_updates ?? true,
          });
          setSupportEmail(data.supportEmail || "");
          setContactEmailFallback(data.contactEmail || "");
        }
      })
      .catch((err) => {
        toast.error("Failed to load notification settings.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await saveNotificationPreferences({
        ...form,
        support_email: supportEmail,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Notification preferences updated successfully.");
      }
    } catch {
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setTesting(true);
    const resolvedRecipient = supportEmail.trim() || contactEmailFallback || "your default email";
    toast.info(`Sending test email to ${resolvedRecipient}...`);
    
    try {
      const result = await sendTestEmailAction();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Test email delivered successfully! Check your inbox.");
      }
    } catch {
      toast.error("Failed to dispatch test email.");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-6 w-6 animate-spin text-indigo-600" />
        Loading notification configurations...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header back navigation */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/settings"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:text-slate-800 transition-all shadow-sm"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Workspace Settings</span>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">Notification Center</h1>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 space-y-8">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
            <Mail className="w-5 h-5 text-indigo-600" />
            Notification Recipient Email
          </h3>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Specify where Agentify alerts should be sent. If left blank, notifications will default to your personal account email (<strong>{contactEmailFallback || "N/A"}</strong>).
          </p>

          <div className="mt-5 space-y-2">
            <label className="text-sm font-bold text-slate-700 ml-1">Custom Support Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-800"
                placeholder="e.g. support@yourbusiness.com"
              />
            </div>
          </div>
        </div>

        {/* Toggles Checklist */}
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4 mb-5">
            <Bell className="w-5 h-5 text-indigo-600" />
            Email Subscription Preferences
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Toggle
              checked={form.email_new_leads}
              onChange={(value) => setForm({ ...form, email_new_leads: value })}
              label="New Lead Alerts"
              description="Receive an email instantly whenever the AI captures customer contact details."
            />
            <Toggle
              checked={form.email_booking_requests}
              onChange={(value) => setForm({ ...form, email_booking_requests: value })}
              label="Booking Requests"
              description="Get notified immediately when a visitor requests an appointment or scheduling slot."
            />
            <Toggle
              checked={form.email_support_requests}
              onChange={(value) => setForm({ ...form, email_support_requests: value })}
              label="Support tickets"
              description="Receive notifications for customer technical issues or complaints."
            />
            <Toggle
              checked={form.email_usage_warnings}
              onChange={(value) => setForm({ ...form, email_usage_warnings: value })}
              label="Usage warnings"
              description="Get warning alerts when your workspace usage hits 80% or exhausts limits."
            />
            <Toggle
              checked={form.email_payment_updates}
              onChange={(value) => setForm({ ...form, email_payment_updates: value })}
              label="Billing updates"
              description="Receive invoices, successful renewal confirmations, and failed card notifications."
            />
          </div>
        </div>

        {/* Action Panel */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between border-t border-slate-100 pt-6">
          <Button
            onClick={handleTestEmail}
            disabled={testing || saving}
            variant="outline"
            className="rounded-2xl border-slate-200 text-slate-700 hover:bg-slate-50 font-bold h-12 px-6 flex items-center gap-2"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <Send className="w-4 h-4" />}
            Send Test Email
          </Button>

          <Button
            onClick={handleSave}
            disabled={saving || testing}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold h-12 px-8 flex items-center gap-2 shadow-md shadow-indigo-100"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
