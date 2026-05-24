"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Users,
  MessageCircle,
  TrendingUp,
  HelpCircle,
  Inbox,
  Calendar,
  Layers,
  ArrowRight,
  TrendingDown,
  Activity,
  CheckCircle2
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AnalyticsData } from "@/lib/actions/analytics";

interface AnalyticsViewProps {
  data: AnalyticsData;
  selectedDays: number;
}

const COLORS = ["#4f46e5", "#8b5cf6", "#10b981", "#f59e0b", "#3b82f6", "#ec4899"];

export function AnalyticsView({ data, selectedDays }: AnalyticsViewProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleDaysChange = (days: number) => {
    router.push(`/dashboard/analytics?days=${days}`);
  };

  const {
    stats,
    dailyTrend,
    sources,
    intentBreakdown,
    usageByType,
    mostAskedQuestions,
    recentUnanswered
  } = data;

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Date Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white border border-slate-200 rounded-3xl shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-500" />
            Time Range
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Analyzing statistics from the past <span className="font-bold text-indigo-600">{selectedDays} days</span>.
          </p>
        </div>
        <div className="flex gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 shrink-0">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              onClick={() => handleDaysChange(days)}
              className={cn(
                "px-4 py-2 text-xs font-bold rounded-xl transition-all",
                selectedDays === days
                  ? "bg-white text-indigo-600 shadow-sm border border-slate-150"
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              {days === 7 ? "7 Days" : days === 30 ? "30 Days" : "90 Days"}
            </button>
          ))}
        </div>
      </div>

      {/* Core Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Conversations */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform duration-500"></div>
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Conversations</span>
              <span className="text-2xl font-extrabold text-slate-950 mt-0.5 block">{stats.totalConversations.toLocaleString("en-US")}</span>
            </div>
          </div>
          <div className="text-xs text-slate-500 relative z-10 flex items-center gap-1.5 mt-2">
            <span className="font-semibold text-indigo-600">{stats.widgetConversations}</span> Widget
            <span className="font-semibold text-emerald-600">{stats.hostedChatConversations}</span> Hosted
            <span className="font-semibold text-slate-600">{stats.playgroundConversations}</span> Test
          </div>
        </div>

        {/* Total Messages */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-violet-50/50 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform duration-500"></div>
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center border border-violet-100">
              <MessageCircle className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">AI Messages</span>
              <span className="text-2xl font-extrabold text-slate-950 mt-0.5 block">{stats.totalMessages.toLocaleString("en-US")}</span>
            </div>
          </div>
          <div className="text-xs text-slate-500 relative z-10 mt-2">
            Average of <span className="font-bold text-slate-700">
              {stats.totalConversations > 0 ? Math.round(stats.totalMessages / stats.totalConversations) : 0}
            </span> messages per chat session.
          </div>
        </div>

        {/* Total Leads Captured */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/50 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform duration-500"></div>
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center border border-emerald-100">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Leads Captured</span>
              <span className="text-2xl font-extrabold text-slate-950 mt-0.5 block">{stats.totalLeads.toLocaleString("en-US")}</span>
            </div>
          </div>
          <div className="text-xs text-slate-500 relative z-10 mt-2 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span className="font-bold text-emerald-600">{stats.hostedChatLeads}</span> from hosted chat links.
          </div>
        </div>

        {/* Lead Conversion Rate */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50/50 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform duration-500"></div>
          <div className="flex items-center gap-4 mb-4 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center border border-amber-100">
              <Activity className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Lead Conversion</span>
              <span className="text-2xl font-extrabold text-slate-950 mt-0.5 block">{stats.conversionRate}%</span>
            </div>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-3 relative z-10">
            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, stats.conversionRate)}%` }} />
          </div>
        </div>
      </div>

      {/* Main Charts & Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Daily Trend Chart (Spans 2 columns) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Daily Conversation & Lead Trends
            </h3>
            <p className="text-xs text-slate-500">
              Visualizes daily volume of client conversations and contact leads created.
            </p>
          </div>
          <div className="h-[300px] w-full">
            {stats.totalConversations === 0 && stats.totalLeads === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <Layers className="w-8 h-8 text-slate-350 mb-2" />
                <p className="text-xs text-slate-500 font-medium">No trending data to plot.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorConv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                    labelStyle={{ fontWeight: 'bold', fontSize: '11px', color: '#1e293b' }}
                    itemStyle={{ fontSize: '11px', padding: '2px 0' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Area type="monotone" name="Conversations" dataKey="conversations" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorConv)" />
                  <Area type="monotone" name="Leads" dataKey="leads" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorLeads)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Sources Breakdown */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col">
          <div className="mb-6">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              Source Distribution
            </h3>
            <p className="text-xs text-slate-500">
              Breakdown of chat sessions by widget, hosted link, and dashboard test.
            </p>
          </div>
          <div className="h-[200px] w-full flex-1 relative flex items-center justify-center">
            {stats.totalConversations === 0 ? (
              <div className="flex flex-col items-center justify-center text-center">
                <Layers className="w-8 h-8 text-slate-350 mb-2" />
                <p className="text-xs text-slate-500 font-medium">No sources recorded.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sources}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {sources.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}
                    itemStyle={{ fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex flex-col gap-2 mt-4">
            {sources.map((source, index) => {
              const pct = stats.totalConversations > 0 ? Math.round((source.value / stats.totalConversations) * 100) : 0;
              return (
                <div key={source.name} className="flex items-center justify-between text-xs border-t border-slate-50 pt-2 first:border-0 first:pt-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-slate-600 font-medium">{source.name}</span>
                  </div>
                  <span className="font-bold text-slate-900">{source.value} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Resource Usage Breakdown */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600" />
              Platform Resource Usage
            </h3>
            <p className="text-xs text-slate-500">
              Aggregated amount of operations consumed across system resources.
            </p>
          </div>
          <div className="h-[250px] w-full">
            {usageByType.every(u => u.value === 0) ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <Layers className="w-8 h-8 text-slate-350 mb-2" />
                <p className="text-xs text-slate-500 font-medium">No logs recorded.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usageByType} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}
                    itemStyle={{ fontSize: '11px' }}
                  />
                  <Bar dataKey="value" name="Usage Count" fill="#4f46e5" radius={[8, 8, 0, 0]}>
                    {usageByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Lead Buying Intent Breakdown */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Lead Interest Breakdown
            </h3>
            <p className="text-xs text-slate-500">
              Distribution of intent topics detected dynamically during lead captures.
            </p>
          </div>
          <div className="h-[250px] w-full">
            {intentBreakdown.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <Layers className="w-8 h-8 text-slate-350 mb-2" />
                <p className="text-xs text-slate-500 font-medium">No leads captured with intent details.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={intentBreakdown}
                  layout="vertical"
                  margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} width={120} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}
                    itemStyle={{ fontSize: '11px' }}
                  />
                  <Bar dataKey="value" name="Leads Count" fill="#10b981" radius={[0, 8, 8, 0]} barSize={16}>
                    {intentBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Most Asked Questions */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col">
          <div className="mb-6">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-indigo-600" />
              Most Common Visitor Inquiries
            </h3>
            <p className="text-xs text-slate-500">
              Top questions typed by site visitors during AI assistant chats.
            </p>
          </div>

          <div className="flex-1 space-y-4">
            {mostAskedQuestions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <HelpCircle className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs text-slate-500 font-medium">No popular inquiries collected yet.</p>
                <p className="text-[10px] text-slate-400 max-w-[200px] mt-0.5">As visitors ask questions on your site, they will group here.</p>
              </div>
            ) : (
              mostAskedQuestions.map((item, idx) => {
                const maxCount = mostAskedQuestions[0]?.count || 1;
                const pct = Math.max(5, Math.round((item.count / maxCount) * 100));
                return (
                  <div key={idx} className="space-y-1.5 border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 line-clamp-1">"{item.question}"</span>
                      <span className="font-extrabold text-indigo-600 shrink-0 ml-4 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                        {item.count} times
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Unanswered Questions */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col">
          <div className="mb-6">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Inbox className="w-5 h-5 text-indigo-600" />
              Unanswered Visitor Inquiries
            </h3>
            <p className="text-xs text-slate-500">
              Recent conversations where the last message was left by the user without an assistant reply.
            </p>
          </div>

          <div className="flex-1 space-y-4">
            {recentUnanswered.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                <p className="text-xs text-slate-500 font-medium">All caught up! Zero unanswered questions.</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Your AI assistant is fully answering inquiries.</p>
              </div>
            ) : (
              recentUnanswered.map((item) => {
                const elapsedStr = new Date(item.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                });
                return (
                  <div key={item.conversationId} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-2 hover:border-indigo-100 transition-colors">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className="text-xs font-bold text-slate-800">{item.visitorName}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">{item.visitorEmail}</span>
                      </div>
                      <span className="text-[10px] font-medium text-slate-400 shrink-0">{elapsedStr}</span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium bg-white border border-slate-100 p-2.5 rounded-xl italic">
                      "{item.question}"
                    </p>
                    <div className="flex justify-end mt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push("/dashboard/conversations")}
                        className="rounded-xl h-8 border-slate-200 text-[10px] font-bold gap-1 bg-white hover:bg-slate-50 shrink-0"
                      >
                        Open Chat
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
