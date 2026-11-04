"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";
import type { DashboardNotification } from "@/lib/queries/notifications";
import { Button } from "@/components/ui/button";

const severityStyles: Record<DashboardNotification["severity"], string> = {
  critical: "bg-red-50 text-red-600 border-red-100",
  warning: "bg-amber-50 text-amber-600 border-amber-100",
  success: "bg-emerald-50 text-emerald-600 border-emerald-100",
  info: "bg-indigo-50 text-indigo-600 border-indigo-100",
};

function SeverityIcon({ severity }: { severity: DashboardNotification["severity"] }) {
  if (severity === "success") return <CheckCircle2 className="h-5 w-5" />;
  if (severity === "info") return <Info className="h-5 w-5" />;
  return <AlertTriangle className="h-5 w-5" />;
}

export function NotificationFeed({
  initialNotifications,
  initialUnreadCount,
}: {
  initialNotifications: DashboardNotification[];
  initialUnreadCount: number;
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  const markRead = async (id: string) => {
    const wasUnread = notifications.some((notification) => notification.id === id && !notification.read_at);
    const result = await markNotificationRead(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? { ...notification, read_at: notification.read_at || new Date().toISOString() }
          : notification
      )
    );
    if (wasUnread) setUnreadCount((current) => Math.max(0, current - 1));
  };

  const markAllRead = async () => {
    const result = await markAllNotificationsRead();
    if (result.error) {
      toast.error(result.error);
      return;
    }

    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at || readAt })));
    setUnreadCount(0);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Workspace</p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900">Notifications</h1>
          <p className="mt-2 text-sm text-slate-500">{unreadCount} unread notification{unreadCount === 1 ? "" : "s"}</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={markAllRead} className="rounded-xl">
            Mark all as read
          </Button>
        )}
      </header>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {notifications.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-9 w-9 text-emerald-500" />
            <h2 className="font-bold text-slate-900">You’re all caught up</h2>
            <p className="mt-1 text-sm text-slate-500">New business updates will appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <div className={`flex items-start gap-4 p-5 ${notification.read_at ? "" : "bg-indigo-50/30"}`}>
                  <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${severityStyles[notification.severity]}`}>
                    <SeverityIcon severity={notification.severity} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={notification.href}
                      onClick={() => void markRead(notification.id)}
                      className="font-bold text-slate-900 hover:text-indigo-700"
                    >
                      {notification.title}
                    </Link>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{notification.message}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {new Date(notification.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!notification.read_at && (
                    <button
                      onClick={() => void markRead(notification.id)}
                      className="shrink-0 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
