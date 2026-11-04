"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BellRing, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAdminAnnouncement, retryAdminAnnouncement } from "@/lib/actions/admin-notifications";

type Announcement = {
  id: string;
  title: string;
  message: string;
  href: string;
  business_id: string | null;
  audience_all_businesses: boolean;
  status: string;
  recipient_count: number;
  error_details: unknown;
  created_at: string;
};

export function AdminNotifications({ announcements }: { announcements: Announcement[] }) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", message: "", href: "/dashboard", businessId: "" });

  const submit = async () => {
    setSending(true);
    try {
      const result = await createAdminAnnouncement(form);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const recipientCount = "recipientCount" in result ? result.recipientCount : 0;
      toast.success(`Announcement delivered to ${recipientCount} recipients.`);
      setForm({ title: "", message: "", href: "/dashboard", businessId: "" });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send announcement.");
    } finally {
      setSending(false);
    }
  };

  const retry = async (id: string) => {
    setRetryingId(id);
    try {
      const result = await retryAdminAnnouncement(id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const recipientCount = "recipientCount" in result ? result.recipientCount : 0;
      toast.success(`Announcement delivered to ${recipientCount} recipients.`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to retry announcement.");
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-extrabold text-white">Notifications</h1>
        <p className="mt-2 text-sm text-slate-400">Create platform announcements for all workspaces or a single business.</p>
      </header>

      <section className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
        <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-white">
          <BellRing className="h-5 w-5 text-indigo-400" />
          New announcement
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold text-slate-300">
            Title
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              maxLength={120}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-indigo-500"
              placeholder="Scheduled maintenance"
            />
          </label>
          <label className="space-y-2 text-sm font-semibold text-slate-300">
            Dashboard link
            <input
              value={form.href}
              onChange={(event) => setForm({ ...form, href: event.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-indigo-500"
              placeholder="/dashboard"
            />
          </label>
          <label className="space-y-2 text-sm font-semibold text-slate-300 md:col-span-2">
            Message
            <textarea
              value={form.message}
              onChange={(event) => setForm({ ...form, message: event.target.value })}
              maxLength={1000}
              rows={4}
              className="w-full resize-y rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-indigo-500"
              placeholder="Share an important update with your customers."
            />
          </label>
          <label className="space-y-2 text-sm font-semibold text-slate-300 md:col-span-2">
            Business ID <span className="font-normal text-slate-500">(leave blank to notify all workspaces)</span>
            <input
              value={form.businessId}
              onChange={(event) => setForm({ ...form, businessId: event.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none focus:border-indigo-500"
              placeholder="Optional business UUID"
            />
          </label>
        </div>
        <Button onClick={submit} disabled={sending} className="mt-5 bg-indigo-600 text-white hover:bg-indigo-500">
          {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Send announcement
        </Button>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950">
        <div className="border-b border-slate-800 p-6">
          <h2 className="text-lg font-bold text-white">Announcement history</h2>
        </div>
        {announcements.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">No announcements yet.</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {announcements.map((announcement) => (
              <article key={announcement.id} className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="font-bold text-white">{announcement.title}</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-400">{announcement.message}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {announcement.audience_all_businesses
                      ? "All workspaces"
                      : announcement.business_id
                        ? `Business ${announcement.business_id}`
                        : "Target business removed"} · {announcement.recipient_count} recipients · {new Date(announcement.created_at).toLocaleString()}
                  </p>
                  {announcement.status !== "sent" && (
                    <p className="mt-2 text-xs font-semibold capitalize text-amber-400">
                      Status: {announcement.status}
                    </p>
                  )}
                </div>
                {["partial", "failed"].includes(announcement.status) && (
                  <Button
                    variant="outline"
                    disabled={retryingId === announcement.id}
                    onClick={() => void retry(announcement.id)}
                    className="shrink-0 border-slate-700 text-slate-200"
                  >
                    {retryingId === announcement.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Retry
                  </Button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
