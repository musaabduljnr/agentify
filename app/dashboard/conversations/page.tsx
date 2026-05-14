import { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import { ConversationManager } from "@/components/dashboard/conversations/conversation-manager";
import { getBusinessConversations } from "@/lib/actions/chat";

export const metadata: Metadata = {
  title: "Conversations | Agentify",
  description: "Monitor and participate in real-time chats with your visitors.",
};

export default async function ConversationsPage() {
  const conversations = await getBusinessConversations();

  return (
    <>
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Conversations</h1>
          <p className="text-slate-500">Monitor and participate in real-time chats with your visitors.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="rounded-2xl h-12 px-6 flex items-center gap-2 font-bold border-2 border-slate-200">
            <Filter className="w-4 h-4" />
            Filters
          </Button>
          <Button className="bg-slate-900 text-white rounded-2xl h-12 px-6 flex items-center gap-2 font-bold">
            Export CSV
          </Button>
        </div>
      </div>

      <ConversationManager initialConversations={conversations} />
    </>
  );
}
