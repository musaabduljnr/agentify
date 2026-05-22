import { getAllConversations } from "@/lib/actions/admin";
import { ConversationsTable } from "@/components/admin/conversations-table";
import { MessageSquareCode } from "lucide-react";

export default async function AdminConversationsPage() {
  const conversations = await getAllConversations();

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20 text-indigo-400">
          <MessageSquareCode className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">
            Conversations Auditing
          </h1>
          <p className="text-slate-400 text-sm">
            Read AI chat transcripts across the entire platform, inspect source originators, and review automated lead collections.
          </p>
        </div>
      </div>

      {/* Interactive Client-Side Conversations Table */}
      <ConversationsTable initialConversations={conversations} />
    </div>
  );
}
