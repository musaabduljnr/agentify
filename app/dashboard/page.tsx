import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { stats, recentConversations, popularQuestions, setupChecklist } from "@/lib/mock-data";
import { CheckCircle2, Circle, MessageSquare, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardOverview() {
  return (
    <>
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Overview 👋</h1>
        <p className="text-slate-500">Here&apos;s what&apos;s happening with your AI assistant today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Recent Conversations */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Recent Conversations</h3>
              <Button variant="ghost" className="text-indigo-600 font-bold text-xs uppercase tracking-widest">View All</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
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
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
              <TrendingUp className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-900 mb-1">Scale your business with more leads</h3>
              <p className="text-sm text-slate-500">Your AI assistant captured 42 leads this week. That&apos;s 15% more than last week!</p>
            </div>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl px-6">View Analytics</Button>
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
            <div className="mt-8 pt-6 border-t border-slate-100">
              <Button className="w-full h-12 rounded-2xl border-2 border-indigo-600 bg-transparent text-indigo-600 hover:bg-indigo-50 font-bold">
                Continue Setup
              </Button>
            </div>
          </div>

          {/* Popular Questions */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">Popular Questions</h3>
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
