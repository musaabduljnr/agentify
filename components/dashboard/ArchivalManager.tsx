"use client";

import { useState, useTransition } from "react";
import { unarchiveConversation, archiveOldConversations, type ArchivedConversation } from "@/lib/actions/archival";
import { Archive, RotateCcw, Trash2, AlertTriangle, CheckCircle2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ArchivalManagerProps {
  initialData: ArchivedConversation[];
  total: number;
}

const RETENTION_OPTIONS = [
  { label: "30 days", value: 30 },
  { label: "60 days", value: 60 },
  { label: "90 days", value: 90 },
  { label: "180 days", value: 180 },
];

const SOURCE_LABELS: Record<string, string> = {
  widget: "Chat Widget",
  hosted_chat: "Hosted Chat",
  dashboard_test: "Test",
  playground: "Playground",
};

export function ArchivalManager({ initialData, total }: ArchivalManagerProps) {
  const [conversations, setConversations] = useState<ArchivedConversation[]>(initialData);
  const [totalCount, setTotalCount] = useState(total);
  const [retentionDays, setRetentionDays] = useState(90);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  function showMsg(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }

  function handleRestore(id: string) {
    setRestoringId(id);
    startTransition(async () => {
      const result = await unarchiveConversation(id);
      setRestoringId(null);
      if (result.error) {
        showMsg("error", result.error);
      } else {
        setConversations(prev => prev.filter(c => c.id !== id));
        setTotalCount(prev => Math.max(0, prev - 1));
        showMsg("success", "Conversation restored.");
      }
    });
  }

  function handleBulkArchive() {
    setShowBulkConfirm(false);
    startTransition(async () => {
      const result = await archiveOldConversations(retentionDays);
      if (result.error) {
        showMsg("error", result.error);
      } else {
        showMsg("success", `${result.count} conversation(s) archived successfully.`);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Feedback */}
      {message && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-medium border ${
          message.type === "success"
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-red-50 text-red-700 border-red-200"
        }`}>
          {message.type === "success"
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {message.text}
        </div>
      )}

      {/* Retention Policy Action */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-7">
        <h3 className="text-base font-bold text-slate-900 mb-1">Retention Policy</h3>
        <p className="text-xs text-slate-500 mb-5">
          Archive all conversations older than a specified number of days. This keeps your active list clean.
        </p>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Archive conversations older than</span>
            <div className="relative">
              <select
                value={retentionDays}
                onChange={e => setRetentionDays(Number(e.target.value))}
                className="appearance-none pl-3 pr-7 py-1.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 bg-white focus:outline-none focus:border-indigo-400 cursor-pointer"
              >
                {RETENTION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {!showBulkConfirm ? (
            <Button
              onClick={() => setShowBulkConfirm(true)}
              disabled={isPending}
              variant="outline"
              className="h-11 rounded-2xl border-2 border-amber-200 text-amber-700 hover:bg-amber-50 font-bold text-sm"
            >
              <Archive className="w-4 h-4 mr-2" />
              Archive Old Conversations
            </Button>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-2xl border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-xs text-amber-800 font-semibold">Confirm archiving conversations older than {retentionDays} days?</span>
              <Button size="sm" onClick={handleBulkArchive} disabled={isPending} className="h-8 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs">
                {isPending ? "Archiving..." : "Yes, Archive"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowBulkConfirm(false)} className="h-8 rounded-xl text-xs">Cancel</Button>
            </div>
          )}
        </div>
      </div>

      {/* Archive List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Archive className="w-4 h-4 text-slate-500" />
            Archived
            <span className="ml-1 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full">
              {totalCount}
            </span>
          </h3>
        </div>

        {conversations.length === 0 ? (
          <div className="p-16 text-center">
            <Archive className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-500 font-medium">No archived conversations yet.</p>
            <p className="text-xs text-slate-400 mt-1">Use the retention policy above to archive old conversations.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[650px]">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Visitor</th>
                  <th className="px-6 py-4">Source</th>
                  <th className="px-6 py-4">Messages</th>
                  <th className="px-6 py-4">Archived</th>
                  <th className="px-6 py-4">Reason</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {conversations.map(convo => (
                  <tr key={convo.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-sm text-slate-900">
                        {convo.visitor_name || "Anonymous"}
                      </div>
                      {convo.visitor_email && (
                        <div className="text-xs text-slate-400">{convo.visitor_email}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-slate-600">
                        {SOURCE_LABELS[convo.source] || convo.source}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {convo.message_count}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400 font-medium whitespace-nowrap">
                      {convo.archived_at
                        ? new Date(convo.archived_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        convo.archive_reason === "manual"
                          ? "bg-slate-50 text-slate-500 border-slate-200"
                          : "bg-blue-50 text-blue-500 border-blue-200"
                      }`}>
                        {convo.archive_reason === "manual" ? "Manual" : "Auto"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRestore(convo.id)}
                        disabled={restoringId === convo.id || isPending}
                        className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-xl text-xs font-bold h-8"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        {restoringId === convo.id ? "Restoring..." : "Restore"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
