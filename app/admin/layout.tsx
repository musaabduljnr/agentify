import { requireAdmin } from "@/lib/admin/require-admin";
import Link from "next/link";
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
  BarChart3,
  LogOut,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminSidebarLinkProps {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function AdminSidebarLink({ href, label, icon }: AdminSidebarLinkProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all duration-200 group"
    >
      <span className="text-slate-500 group-hover:text-indigo-400 transition-colors shrink-0">
        {icon}
      </span>
      {label}
    </Link>
  );
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Enforce secure server-side admin check
  const profile = await requireAdmin();

  return (
    <div className="min-h-screen bg-slate-900 flex text-slate-100 antialiased font-sans">
      {/* 1. Sidebar Panel */}
      <aside className="w-64 border-r border-slate-800 bg-slate-950 flex flex-col justify-between shrink-0 sticky top-0 h-screen">
        <div>
          {/* Admin Identity */}
          <div className="p-6 border-b border-slate-800 flex items-center gap-3">
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

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            <AdminSidebarLink href="/admin" label="Overview" icon={<BarChart3 className="w-4 h-4" />} />
            <AdminSidebarLink href="/admin/users" label="Users" icon={<Users className="w-4 h-4" />} />
            <AdminSidebarLink href="/admin/businesses" label="Businesses" icon={<Building2 className="w-4 h-4" />} />
            <AdminSidebarLink href="/admin/subscriptions" label="Subscriptions" icon={<KeyRound className="w-4 h-4" />} />
            <AdminSidebarLink href="/admin/payments" label="Payments" icon={<CreditCard className="w-4 h-4" />} />
            <AdminSidebarLink href="/admin/usage" label="Usage Logs" icon={<Activity className="w-4 h-4" />} />
            <AdminSidebarLink href="/admin/conversations" label="Conversations" icon={<MessageSquareCode className="w-4 h-4" />} />
            <AdminSidebarLink href="/admin/leads" label="Leads" icon={<Contact2 className="w-4 h-4" />} />
            <AdminSidebarLink href="/admin/ai-settings" label="AI Engine" icon={<Cpu className="w-4 h-4" />} />
            <AdminSidebarLink href="/admin/settings" label="Settings" icon={<Settings className="w-4 h-4" />} />
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
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar Panel */}
        <header className="h-16 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-8 sticky top-0 z-30">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Live Monitoring
            </span>
          </div>

          {/* Active Admin Details */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs font-extrabold text-white leading-tight">
                {profile.full_name || "Platform Admin"}
              </p>
              <p className="text-[10px] text-slate-500">{profile.email}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="Admin" className="w-full h-full object-cover" />
              ) : (
                <Shield className="w-5 h-5 text-indigo-400" />
              )}
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-8 bg-slate-900 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
