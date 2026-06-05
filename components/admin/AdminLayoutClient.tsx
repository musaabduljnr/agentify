"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Building2,
  KeyRound,
  CreditCard,
  Activity,
  MessageSquareCode,
  Contact2,
  Cpu,
  Settings,
  LayoutDashboard,
  LogOut,
  Shield,
  Menu,
  X,
  BarChart3,
  Mail,
  Sparkles,
  SlidersHorizontal,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminSidebarLinkProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  isActive?: boolean;
}

function AdminSidebarLink({ href, label, icon, onClick, isActive }: AdminSidebarLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 group border border-transparent",
        isActive 
          ? "bg-slate-800 border-slate-700 text-white" 
          : "text-slate-400 hover:text-white hover:bg-slate-800/60"
      )}
    >
      <span className={cn("transition-colors shrink-0", isActive ? "text-indigo-400" : "text-slate-500 group-hover:text-indigo-400")}>
        {icon}
      </span>
      {label}
    </Link>
  );
}

export default function AdminLayoutClient({
  profile,
  children,
}: {
  profile: any;
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-900 flex text-slate-100 antialiased font-sans max-w-full overflow-x-hidden">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 1. Sidebar Panel */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 border-r border-slate-800 bg-slate-950 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto lg:h-screen shrink-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div>
          {/* Admin Identity */}
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center border border-indigo-500/30">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white tracking-tight">Agentify</h3>
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                  Admin Console
                </p>
              </div>
            </div>
            <button 
              type="button"
              className="lg:hidden p-2 text-slate-500 hover:text-white rounded-xl"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
 
          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            <AdminSidebarLink href="/admin" label="Overview" icon={<BarChart3 className="w-4 h-4" />} onClick={() => setIsSidebarOpen(false)} isActive={pathname === "/admin"} />
            <AdminSidebarLink href="/admin/demo-generator" label="Demo Generator" icon={<Sparkles className="w-4 h-4" />} onClick={() => setIsSidebarOpen(false)} isActive={pathname.startsWith("/admin/demo-generator") || pathname.startsWith("/admin/demos")} />
            <AdminSidebarLink href="/admin/users" label="Users" icon={<Users className="w-4 h-4" />} onClick={() => setIsSidebarOpen(false)} isActive={pathname === "/admin/users"} />
            <AdminSidebarLink href="/admin/businesses" label="Businesses" icon={<Building2 className="w-4 h-4" />} onClick={() => setIsSidebarOpen(false)} isActive={pathname === "/admin/businesses"} />
            <AdminSidebarLink href="/admin/subscriptions" label="Subscriptions" icon={<KeyRound className="w-4 h-4" />} onClick={() => setIsSidebarOpen(false)} isActive={pathname === "/admin/subscriptions"} />
            <AdminSidebarLink href="/admin/payments" label="Payments" icon={<CreditCard className="w-4 h-4" />} onClick={() => setIsSidebarOpen(false)} isActive={pathname === "/admin/payments"} />
            <AdminSidebarLink href="/admin/usage" label="Usage Logs" icon={<Activity className="w-4 h-4" />} onClick={() => setIsSidebarOpen(false)} isActive={pathname === "/admin/usage"} />
            <AdminSidebarLink href="/admin/conversations" label="Conversations" icon={<MessageSquareCode className="w-4 h-4" />} onClick={() => setIsSidebarOpen(false)} isActive={pathname === "/admin/conversations"} />
            <AdminSidebarLink href="/admin/leads" label="Leads" icon={<Contact2 className="w-4 h-4" />} onClick={() => setIsSidebarOpen(false)} isActive={pathname === "/admin/leads"} />
            <AdminSidebarLink href="/admin/ai-settings" label="AI Engine" icon={<Cpu className="w-4 h-4" />} onClick={() => setIsSidebarOpen(false)} isActive={pathname === "/admin/ai-settings"} />
            <AdminSidebarLink href="/admin/ai-logs" label="AI Logs" icon={<History className="w-4 h-4" />} onClick={() => setIsSidebarOpen(false)} isActive={pathname === "/admin/ai-logs"} />
            <AdminSidebarLink href="/admin/email-logs" label="Email Logs" icon={<Mail className="w-4 h-4" />} onClick={() => setIsSidebarOpen(false)} isActive={pathname === "/admin/email-logs"} />
            <AdminSidebarLink href="/admin/configuration" label="Config Center" icon={<SlidersHorizontal className="w-4 h-4" />} onClick={() => setIsSidebarOpen(false)} isActive={pathname === "/admin/configuration"} />
            <AdminSidebarLink href="/admin/settings" label="Settings" icon={<Settings className="w-4 h-4" />} onClick={() => setIsSidebarOpen(false)} isActive={pathname === "/admin/settings"} />
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          {/* Quick return to Client App */}
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 hover:bg-slate-800 transition-all duration-200"
          >
            <LayoutDashboard className="w-4 h-4 text-indigo-400 shrink-0" />
            Client Workspace
          </Link>

          {/* User Signout Row */}
          <form action="/auth/signout" method="post" className="w-full">
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Sign Out Admin
            </button>
          </form>
        </div>
      </aside>

      {/* 2. Main Page Area */}
      <div className="flex-1 flex flex-col min-w-0 max-w-full">
        {/* Topbar Panel */}
        <header className="h-16 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button 
              type="button"
              className="lg:hidden p-2 text-slate-500 hover:text-white hover:bg-slate-900 rounded-xl"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Live Monitoring
            </span>
          </div>

          {/* Active Admin Details */}
          <div className="flex items-center gap-3 sm:gap-4 pl-2 min-w-0">
            <div className="text-right hidden sm:block min-w-0">
              <p className="text-xs font-extrabold text-white leading-tight truncate max-w-[150px]">
                {profile.full_name || "Platform Admin"}
              </p>
              <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{profile.email}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="Admin" className="w-full h-full object-cover" />
              ) : (
                <Shield className="w-5 h-5 text-indigo-400" />
              )}
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-slate-900 overflow-y-auto max-w-full min-w-0 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
