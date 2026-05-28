"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  Bot, 
  LayoutDashboard, 
  BrainCircuit, 
  MessageSquare, 
  Users, 
  Paintbrush, 
  Code2, 
  CreditCard, 
  Settings,
  X,
  LogOut,
  Sparkles,
  BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";

const menuItems = [
  { icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
  { icon: BrainCircuit, label: "AI Assistant", href: "/dashboard/assistant" },
  { icon: Sparkles, label: "AI Playground", href: "/dashboard/playground" },
  { icon: MessageSquare, label: "Knowledge Base", href: "/dashboard/knowledge" },
  { icon: Users, label: "Conversations", href: "/dashboard/conversations" },
  { icon: Users, label: "Leads", href: "/dashboard/leads" },
  { icon: BarChart3, label: "Analytics", href: "/dashboard/analytics" },
  { icon: Paintbrush, label: "Widget", href: "/dashboard/widget" },
  { icon: Code2, label: "Embed Code", href: "/dashboard/embed" },
  { icon: CreditCard, label: "Billing", href: "/dashboard/billing" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

type SidebarProps = {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  subscription?: {
    plan: string;
    status: string;
    messagesUsed: number;
    messagesLimit: number;
  } | null;
};

export function Sidebar({ isOpen, setIsOpen, subscription }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  // Calculate usage percentage
  const usagePct = subscription 
    ? subscription.messagesLimit >= 999999999 
      ? 2 
      : Math.min(100, Math.round((subscription.messagesUsed / subscription.messagesLimit) * 100))
    : 0;
  
  const planLabel = subscription?.plan?.replace("_", " ") || "Free Trial";
  const planUpperLabel = planLabel.charAt(0).toUpperCase() + planLabel.slice(1);

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-[min(18rem,calc(100vw-2rem))] bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:w-72 lg:translate-x-0 lg:static lg:inset-auto",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full overflow-y-auto flex flex-col p-4 sm:p-6">
          <div className="flex items-center justify-between mb-10">
            <Link href="/" className="flex items-center gap-2">
              <Bot className="w-8 h-8 text-indigo-600" />
              <span className="text-xl font-extrabold text-slate-900">Agentify</span>
            </Link>
            <button className="lg:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-xl" onClick={() => setIsOpen(false)}>
              <X className="w-6 h-6" />
            </button>
          </div>

          <nav className="flex-1 space-y-1">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all",
                    isActive 
                      ? "bg-indigo-50 text-indigo-600" 
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <item.icon className={cn("w-5 h-5", isActive ? "text-indigo-600" : "text-slate-400")} />
                  {item.label}
                </Link>
              );
            })}
            
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all mt-4"
            >
              <LogOut className="w-5 h-5 text-slate-400 group-hover:text-red-600" />
              Logout
            </button>
          </nav>

          <div className="mt-auto pt-6">
            <div className="bg-slate-50 rounded-3xl p-4 sm:p-6 border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current Plan</span>
                <span className={cn(
                  "px-2 py-0.5 text-[10px] font-bold rounded-full",
                  subscription?.status === "active" ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500"
                )}>
                  {planUpperLabel}
                </span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-700">Message Usage</span>
                <span className="text-xs text-slate-500 font-medium">{usagePct}%</span>
              </div>
              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden mb-4">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    usagePct >= 100 ? "bg-red-500" : usagePct >= 80 ? "bg-amber-500" : "bg-indigo-600"
                  )}
                  style={{ width: `${Math.max(2, usagePct)}%` }}
                />
              </div>
              <Link
                href="/dashboard/billing"
                className="block w-full py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors text-center"
              >
                {usagePct >= 80 ? "Upgrade Plan" : "Manage Plan"}
              </Link>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
