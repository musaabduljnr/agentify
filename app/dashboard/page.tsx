import { StatCard } from "@/components/dashboard/StatCard";

export const dynamic = "force-dynamic";

import { 
  getDashboardStats, 
  getRecentConversations, 
  getSetupChecklist 
} from "@/lib/queries/dashboard";
import { getUsageWarnings, getBillingData } from "@/lib/actions/billing";
import { UsageWarningBanner } from "@/components/billing/usage-warning-banner";
import { CheckCircle2, Circle, MessageSquare, TrendingUp, Users, MessageCircle, Database, CreditCard, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function DashboardOverview() {
  const [statsData, recentConversations, setupChecklist, warnings, billingData] = await Promise.all([
    getDashboardStats(),
    getRecentConversations(),
    getSetupChecklist(),
    getUsageWarnings(),
    getBillingData(),
  ]);

  if (!statsData) return null;

  const stats = [
    {
      title: "Total Conversations",
      value: statsData.totalConversations.toString(),
      icon: <MessageCircle className="w-5 h-5" />,
      trend: "Overall",
      color: "indigo"
    },
    {
      title: "Leads Captured",
      value: statsData.totalLeads.toString(),
      icon: <Users className="w-5 h-5" />,
      trend: `${Math.round((statsData.totalLeads / (statsData.totalConversations || 1)) * 100)}% conversion`,
      color: "emerald"
    },
    {
      title: "Active Requests",
      value: (statsData.bookingCount + statsData.supportCount).toString(),
      icon: <MessageSquare className="w-5 h-5" />,
      trend: `${statsData.bookingCount} bookings, ${statsData.supportCount} tickets`,
      color: "amber"
    },
    {
      title: "Knowledge Sources",
      value: statsData.knowledgeSources.toString(),
      icon: <Database className="w-5 h-5" />,
      trend: "Trained & Ready",
      color: "blue"
    }
  ];

  const popularQuestions = [
    { question: "What are your pricing plans?", count: 12 },
    { question: "How do I install the widget?", count: 8 },
    { question: "Can I speak to a human?", count: 5 },
  ];

  return (
    <>
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Overview 👋</h1>
        <p className="text-slate-500">Here&apos;s what&apos;s happening with your AI assistant today.</p>
      </div>

      {/* Usage Warnings */}
      <UsageWarningBanner warnings={warnings} />

      {/* Subscription Summary Card */}
      {billingData && (
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 rounded-3xl p-6 mb-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -mr-20 -mt-20 blur-2xl"></div>
          <div className="absolute bottom-0 left-1/2 w-32 h-32 bg-white/5 rounded-full -mb-16 blur-2xl"></div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/10">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-lg font-bold">{billingData.currentPlan.name}</span>
                  <span className="px-2 py-0.5 bg-white/15 text-[10px] font-bold rounded-full uppercase tracking-widest backdrop-blur-sm">
                    {billingData.subscription.status}
                  </span>
                </div>
                <p className="text-indigo-200 text-sm">
                  {billingData.usage.messages.used.toLocaleString("en-US")} / {billingData.usage.messages.limit >= 999999999 ? '∞' : billingData.usage.messages.limit.toLocaleString("en-US")} messages used this period
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right mr-4 hidden md:block">
                <div className="text-2xl font-extrabold">{billingData.currentPlan.price}</div>
                <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">per month</p>
              </div>
              <Button asChild className="bg-white text-indigo-700 hover:bg-indigo-50 rounded-2xl px-5 font-bold shadow-lg shadow-indigo-900/20">
                <Link href="/dashboard/billing">
                  <Zap className="w-4 h-4 mr-1.5" /> Manage Plan
                </Link>
              </Button>
            </div>
          </div>

          {/* Mini usage bar */}
          <div className="mt-5 relative z-10">
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-white/60 rounded-full transition-all duration-700"
                style={{
                  width: `${
                    billingData.usage.messages.limit >= 999999999
                      ? 2
                      : Math.max(2, Math.min(100, Math.round((billingData.usage.messages.used / billingData.usage.messages.limit) * 100)))
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {stats.map((stat, index) => (
          <StatCard key={index} {...(stat as any)} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Recent Conversations */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Recent Conversations</h3>
              <Button asChild variant="ghost" className="text-indigo-600 font-bold text-xs uppercase tracking-widest">
                <Link href="/dashboard/conversations">View All</Link>
              </Button>
            </div>
            <div className="overflow-x-auto">
              {recentConversations.length > 0 ? (
                <table className="w-full text-left min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <th className="px-6 py-4">Visitor</th>
                      <th className="px-6 py-4">Last Message</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentConversations.map((convo) => (
                      <tr key={convo.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900 text-sm">{convo.visitor}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-500 line-clamp-1">{convo.lastMessage}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={convo.status === "Lead" ? "px-2 py-1 bg-green-50 text-green-600 text-[10px] font-bold rounded-full" : "px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full"}>
                            {convo.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-xs text-slate-400 font-medium">{convo.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-20 text-center">
                  <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">No conversations yet.</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
              <TrendingUp className="w-8 h-8" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-slate-900 mb-1">Scale your business with more leads</h3>
              <p className="text-sm text-slate-500">Your AI assistant is working 24/7 to capture leads and answer customer questions.</p>
            </div>
            <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl px-6 w-full sm:w-auto shrink-0 justify-center">
              <Link href="/dashboard/leads">View Leads</Link>
            </Button>
          </div>
        </div>

        {/* Sidebar content */}
        <div className="space-y-6">
          {/* Setup Progress */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Setup Progress</h3>
            <div className="space-y-4">
              {setupChecklist.map((item) => (
                <div key={item.id} className="flex items-center gap-4">
                  {item.completed ? (
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                  ) : (
                    <Circle className="w-6 h-6 text-slate-200" />
                  )}
                  <span className={item.completed ? "text-sm font-semibold text-slate-900" : "text-sm font-semibold text-slate-400"}>
                    {item.task}
                  </span>
                </div>
              ))}
            </div>
            {!setupChecklist.every(i => i.completed) && (
              <div className="mt-8 pt-6 border-t border-slate-100">
                <Button asChild className="w-full h-12 rounded-2xl border-2 border-indigo-600 bg-transparent text-indigo-600 hover:bg-indigo-50 font-bold">
                  <Link href="/onboarding">Continue Setup</Link>
                </Button>
              </div>
            )}
          </div>

          {/* Popular Questions */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">Common Topics</h3>
              <MessageSquare className="w-5 h-5 text-slate-400" />
            </div>
            <div className="space-y-4">
              {popularQuestions.map((q, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-colors">
                  <p className="text-sm font-semibold text-slate-700 line-clamp-1 flex-1 pr-4">{q.question}</p>
                  <span className="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-lg shrink-0">{q.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
