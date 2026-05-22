import { getAdminOverviewStats } from "@/lib/actions/admin";
import {
  Users,
  Building2,
  KeyRound,
  CreditCard,
  MessageSquare,
  Sparkles,
  TrendingUp,
  AlertOctagon,
  Calendar,
  ChevronRight,
  TrendingDown,
  Activity,
} from "lucide-react";
import Link from "next/link";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  color?: "indigo" | "emerald" | "amber" | "rose" | "blue";
}

function StatCard({ title, value, icon, description, color = "indigo" }: StatCardProps) {
  const glowStyles = {
    indigo: "border-indigo-500/20 bg-indigo-500/5 text-indigo-400",
    emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400",
    amber: "border-amber-500/20 bg-amber-500/5 text-amber-400",
    rose: "border-rose-500/20 bg-rose-500/5 text-rose-400",
    blue: "border-blue-500/20 bg-blue-500/5 text-blue-400",
  };

  const textColors = {
    indigo: "text-indigo-400",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
    rose: "text-rose-400",
    blue: "text-blue-400",
  };

  return (
    <div className={`bg-slate-950 border ${glowStyles[color]} rounded-3xl p-6 relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-slate-950/50`}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          {title}
        </span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border border-slate-800 bg-slate-900 ${textColors[color]}`}>
          {icon}
        </div>
      </div>
      <div className="text-3xl font-black text-white tracking-tight">
        {value}
      </div>
      <p className="text-[10px] text-slate-500 font-medium mt-1">
        {description}
      </p>
    </div>
  );
}

export default async function AdminOverviewPage() {
  const stats = await getAdminOverviewStats();

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
          Overview Control Panel
        </h1>
        <p className="text-slate-400 text-sm">
          Platform-wide health metrics, payment streams, and usage auditing.
        </p>
      </div>

      {/* Grid of 8 Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Users"
          value={stats.totalUsers.toLocaleString()}
          icon={<Users className="w-4 h-4" />}
          description="Total profile accounts registered"
          color="indigo"
        />
        <StatCard
          title="Businesses"
          value={stats.totalBusinesses.toLocaleString()}
          icon={<Building2 className="w-4 h-4" />}
          description="Onboarded business identities"
          color="blue"
        />
        <StatCard
          title="Active Paid Tiers"
          value={stats.activeSubscriptions.toLocaleString()}
          icon={<KeyRound className="w-4 h-4" />}
          description="Subscribers on paid packages"
          color="emerald"
        />
        <StatCard
          title="Trial Subscriptions"
          value={stats.trialUsers.toLocaleString()}
          icon={<Sparkles className="w-4 h-4" />}
          description="Users exploring on free trials"
          color="amber"
        />
        <StatCard
          title="Total Conversations"
          value={stats.totalConversations.toLocaleString()}
          icon={<MessageSquare className="w-4 h-4" />}
          description="RAG bot discussions tracked"
          color="blue"
        />
        <StatCard
          title="Monthly Revenue"
          value={`₦${stats.monthlyRevenue.toLocaleString()}`}
          icon={<TrendingUp className="w-4 h-4" />}
          description="Total processed paid streams"
          color="emerald"
        />
        <StatCard
          title="AI Messages Sent"
          value={stats.aiMessagesUsed.toLocaleString()}
          icon={<Activity className="w-4 h-4" />}
          description="Sum total message completions"
          color="indigo"
        />
        <StatCard
          title="Failed Knowledge"
          value={stats.failedKnowledgeSources.toLocaleString()}
          icon={<AlertOctagon className="w-4 h-4" />}
          description="Sources that failed training steps"
          color="rose"
        />
      </div>

      {/* Grid of Recent Platform Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* Table 1: Recent Businesses */}
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              Recent Businesses
            </h3>
            <Link href="/admin/businesses" className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              Manage <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {stats.recentBusinesses && stats.recentBusinesses.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-3">Name</th>
                    <th className="py-3">Owner Email</th>
                    <th className="py-3 text-right">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  {stats.recentBusinesses.map((b: any) => {
                    const regDate = new Date(b.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    });
                    return (
                      <tr key={b.id} className="text-slate-300 hover:bg-slate-900/40">
                        <td className="py-3 font-semibold text-white">{b.name}</td>
                        <td className="py-3 text-slate-400">{b.owner?.email || "—"}</td>
                        <td className="py-3 text-right font-medium">{regDate}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-4 text-center">No businesses onboarded yet.</p>
          )}
        </div>

        {/* Table 2: Recent Payments */}
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              Recent Payments
            </h3>
            <Link href="/admin/payments" className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              Audit <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {stats.recentPayments && stats.recentPayments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-3">Reference</th>
                    <th className="py-3">Amount</th>
                    <th className="py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  {stats.recentPayments.map((p: any) => (
                    <tr key={p.id} className="text-slate-300 hover:bg-slate-900/40">
                      <td className="py-3 font-mono text-slate-400 select-all">{p.reference.substring(0, 15)}...</td>
                      <td className="py-3 font-bold text-white">₦{p.amount.toLocaleString()}</td>
                      <td className="py-3 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-emerald-950 border border-emerald-900 text-emerald-400">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-4 text-center">No successful payments logged yet.</p>
          )}
        </div>

        {/* Table 3: Recent Leads */}
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              Recent Leads
            </h3>
            <Link href="/admin/leads" className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              Verify <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {stats.recentLeads && stats.recentLeads.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-3">Lead</th>
                    <th className="py-3">Business</th>
                    <th className="py-3 text-right">Intent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  {stats.recentLeads.map((l: any) => (
                    <tr key={l.id} className="text-slate-300 hover:bg-slate-900/40">
                      <td className="py-3">
                        <p className="font-semibold text-white">{l.name || "Anonymous"}</p>
                        <p className="text-[10px] text-slate-500">{l.email}</p>
                      </td>
                      <td className="py-3 text-slate-400">{l.businesses?.name}</td>
                      <td className="py-3 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border ${
                          l.buying_intent === "high"
                            ? "bg-rose-950 border-rose-900 text-rose-400"
                            : l.buying_intent === "medium"
                            ? "bg-amber-950 border-amber-900 text-amber-400"
                            : "bg-slate-900 border-slate-800 text-slate-400"
                        }`}>
                          {l.buying_intent} Intent
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-4 text-center">No leads captured yet.</p>
          )}
        </div>

        {/* Table 4: High Usage Subscriptions */}
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              High Usage Businesses
            </h3>
            <Link href="/admin/subscriptions" className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              Reset <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {stats.highUsageBusinesses && stats.highUsageBusinesses.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-3">Business</th>
                    <th className="py-3">Active Plan</th>
                    <th className="py-3 text-right">Usage Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  {stats.highUsageBusinesses.map((s: any) => (
                    <tr key={s.id} className="text-slate-300 hover:bg-slate-900/40">
                      <td className="py-3 font-semibold text-white">{s.businesses?.name}</td>
                      <td className="py-3 capitalize text-slate-400">{s.plan.replace("_", " ")}</td>
                      <td className="py-3 text-right font-bold text-indigo-400">{s.current_usage.toLocaleString()} / {s.message_limit.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-4 text-center">No active usage recorded.</p>
          )}
        </div>

      </div>
    </div>
  );
}
