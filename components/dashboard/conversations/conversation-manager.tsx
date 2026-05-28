"use client";

import { useState, useEffect } from "react";
import { Search, Filter, User as UserIcon, Bot, MessageSquare, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getDashboardConversation } from "@/lib/actions/chat";
import { formatDistanceToNow } from "date-fns";

interface Conversation {
  id: string;
  visitor_name: string;
  visitor_email?: string;
  source: string;
  status: string;
  lead_captured: boolean;
  updated_at: string;
  last_message?: {
    content: string;
    created_at: string;
  };
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export function ConversationManager({ initialConversations }: { initialConversations: Conversation[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(initialConversations[0]?.id || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewingDetail, setViewingDetail] = useState(false);

  const filteredConversations = initialConversations.filter(c => 
    c.visitor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.visitor_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedConversation = initialConversations.find(c => c.id === selectedId);

  useEffect(() => {
    if (selectedId) {
      loadMessages(selectedId);
    }
  }, [selectedId]);

  const loadMessages = async (id: string) => {
    setIsLoading(true);
    try {
      const data = await getDashboardConversation(id);
      setMessages(data as any);
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 border border-slate-200 rounded-3xl bg-white shadow-sm overflow-hidden h-[calc(100vh-280px)] min-h-[600px]">
      {/* Left: Chat List */}
      <div className="lg:col-span-4 border-r border-slate-100 flex flex-col h-full bg-slate-50/10">
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search chats..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="divide-y divide-slate-50">
            {filteredConversations.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-sm italic">
                No conversations found.
              </div>
            ) : (
              filteredConversations.map((convo) => {
                const isActive = convo.id === selectedId;
                return (
                  <div 
                    key={convo.id} 
                    onClick={() => {
                      setSelectedId(convo.id);
                      setViewingDetail(true);
                    }}
                    className={cn(
                      "p-5 hover:bg-slate-50 transition-all cursor-pointer group relative",
                      isActive ? "bg-indigo-50/50" : ""
                    )}
                  >
                    {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600" />}
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        {convo.visitor_name || "Anonymous"}
                        {convo.lead_captured && <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />}
                      </div>
                      <span className="text-[10px] font-medium text-slate-400">
                        {formatDistanceToNow(new Date(convo.updated_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1 group-hover:text-slate-700">
                      {convo.last_message?.content || "No messages yet"}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold rounded uppercase tracking-wider">
                        {convo.source.replace("_", " ")}
                      </span>
                      {(convo as any).metadata?.intent_type && (
                        <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-bold rounded uppercase tracking-wider">
                          {(convo as any).metadata.intent_type.replace("_", " ")}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right: Chat Detail */}
      <div className="lg:col-span-8 flex flex-col h-full bg-slate-50/30">
        {!selectedConversation ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-10 text-center">
            <MessageSquare size={48} className="mb-4 opacity-10" />
            <p className="text-sm">Select a conversation to view details</p>
          </div>
        ) : (
          <>
            <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <button 
                  type="button"
                  onClick={() => setViewingDetail(false)}
                  className="lg:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-xl mr-1 shrink-0"
                  aria-label="Back to list"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm truncate">{selectedConversation.visitor_name || "Anonymous Visitor"}</h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[120px]">{selectedConversation.visitor_email || "No email"}</span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full shrink-0"></span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">{selectedConversation.status}</span>
                  </div>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 p-6">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className={cn("flex gap-3", i % 2 === 0 ? "flex-row-reverse" : "")}>
                      <div className="w-8 h-8 rounded-lg bg-slate-200 animate-pulse" />
                      <div className="h-12 w-48 rounded-2xl bg-slate-100 animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  {messages.map((msg) => {
                    const isAssistant = msg.role === "assistant";
                    return (
                      <div key={msg.id} className={cn("flex items-start gap-3", isAssistant ? "" : "flex-row-reverse")}>
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
                          isAssistant ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"
                        )}>
                          {isAssistant ? <Bot className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                        </div>
                        <div className={cn("space-y-1 max-w-[80%]", isAssistant ? "" : "text-right")}>
                          <div className={cn(
                            "p-3 rounded-2xl text-sm leading-relaxed text-left",
                            isAssistant ? "bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm" : "bg-indigo-600 text-white rounded-tr-none"
                          )}>
                            {msg.content}
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">
                            {isAssistant ? "AI Assistant" : "Visitor"} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </div>
    </div>
  );
}
