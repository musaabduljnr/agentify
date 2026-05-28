"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, Menu, User, Bot, Building2, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { DashboardNotification } from "@/lib/queries/notifications";

interface TopbarProps {
  onMenuClick: () => void;
  user: any;
  profile: any;
  business: any;
  assistant: any;
  notifications?: DashboardNotification[];
}

const levelStyles: Record<DashboardNotification["level"], string> = {
  critical: "bg-red-50 text-red-600 border-red-100",
  warning: "bg-amber-50 text-amber-600 border-amber-100",
  success: "bg-emerald-50 text-emerald-600 border-emerald-100",
  info: "bg-indigo-50 text-indigo-600 border-indigo-100",
};

function NotificationIcon({ level }: { level: DashboardNotification["level"] }) {
  if (level === "success") return <CheckCircle2 className="h-4 w-4" />;
  if (level === "info") return <Info className="h-4 w-4" />;
  return <AlertTriangle className="h-4 w-4" />;
}

export function Topbar({ onMenuClick, user, profile, business, assistant, notifications = [] }: TopbarProps) {
  const displayName = profile?.full_name || user?.email || "User";
  const [open, setOpen] = useState(false);
  const criticalCount = notifications.filter((item) => item.level === "critical").length;

  return (
    <header className="min-h-20 bg-white border-b border-slate-200 flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-10">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <button 
          className="lg:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-xl"
          onClick={onMenuClick}
        >
          <Menu className="w-6 h-6" />
        </button>
        
        <div className="hidden md:flex min-w-0 items-center gap-4 xl:gap-6">
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]">
              {business?.name || "No Business"}
            </span>
          </div>
          
          <div className="flex items-center gap-3 px-4 py-2 bg-indigo-50/50 rounded-2xl border border-indigo-100/50">
            <Bot className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-bold text-indigo-700 truncate max-w-[150px]">
              {assistant?.name || "No Assistant"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <div className="relative">
          <button
            onClick={() => setOpen((value) => !value)}
            className="relative p-2.5 text-slate-500 hover:bg-slate-50 rounded-2xl transition-colors"
            aria-label="Open notifications"
          >
            <Bell className="w-5 h-5" />
            {notifications.length > 0 && (
              <span
                className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white px-1 text-[10px] font-extrabold text-white ${
                  criticalCount > 0 ? "bg-red-500" : "bg-indigo-600"
                }`}
              >
                {notifications.length}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-12 z-50 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
              <div className="border-b border-slate-100 p-4">
                <p className="text-sm font-extrabold text-slate-900">Notifications</p>
                <p className="text-xs text-slate-500">Important business and account updates.</p>
              </div>

              <div className="max-h-[360px] overflow-y-auto p-2">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center">
                    <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                    <p className="text-sm font-bold text-slate-900">All clear</p>
                    <p className="mt-1 text-xs text-slate-500">No important updates right now.</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <Link
                      key={notification.id}
                      href={notification.href}
                      onClick={() => setOpen(false)}
                      className="flex gap-3 rounded-2xl p-3 transition-colors hover:bg-slate-50"
                    >
                      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${levelStyles[notification.level]}`}>
                        <NotificationIcon level={notification.level} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-slate-900 break-words">{notification.title}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 break-words">{notification.message}</span>
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="hidden h-10 w-[1px] bg-slate-200 mx-2 sm:block"></div>
        
        <div className="flex items-center gap-3 pl-2">
          <div className="hidden max-w-[180px] text-right sm:block">
            <p className="truncate text-sm font-bold text-slate-900">{displayName}</p>
            <p className="truncate text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {user?.email}
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600">
            <User className="w-6 h-6" />
          </div>
        </div>
      </div>
    </header>
  );
}
