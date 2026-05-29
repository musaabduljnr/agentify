"use client";

import { useState } from "react";
import {
  Search,
  MessageSquare,
  Eye,
  Calendar,
  X,
  User,
  Bot,
  Globe,
  Contact2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConversationsTableProps {
  initialConversations: any[];
}

export function ConversationsTable({ initialConversations }: ConversationsTableProps) {
  const [conversations] = useState(initialConversations);
  const [searchTerm, setSearchTerm] = useState("");
  const [leadFilter, setLeadFilter] = useState("all");
  const [selectedChat, setSelectedChat] = useState<any | null>(null);

  // Search & Filter Logic
  const filtered = conversations.filter((chat) => {
    const matchesSearch =
      (chat.businesses?.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (chat.visitor_id || "").toLowerCase().includes(searchTerm.toLowerCase());

    const isLead = chat.metadata?.lead_captured === true || chat.lead_captured === true;
    const matchesLead =
      leadFilter === "all" ||
      (leadFilter === "yes" && isLead) ||
      (leadFilter === "no" && !isLead);

    return matchesSearch && matchesLead;
  });

  return (
    <div className="space-y-6">
      {/* Search & Filter Top Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-950 p-6 rounded-3xl border border-slate-800">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search business or visitor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex gap-2 shrink-0">
          {["all", "yes", "no"].map((option) => (
            <button
              key={option}
              onClick={() => setLeadFilter(option)}
              className={`px-4 py-2 rounded-xl text-xs font-bold capitalize border transition-all ${
                leadFilter === option
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-sm"
                  : "bg-slate-900 border-slate-850 text-slate-400 hover:text-white"
              }`}
            >
              {option === "all"
                ? "All chats"
                : option === "yes"
                ? "Leads Captured"
                : "No Lead"}
            </button>
          ))}
        </div>
      </div>

      {/* Conversations Grid List */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden">
        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-850 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-4 px-6 whitespace-nowrap">Business Location</th>
                  <th className="py-4 px-6 whitespace-nowrap">Source Origin</th>
                  <th className="py-4 px-6 whitespace-nowrap">Visitor Identifier</th>
                  <th className="py-4 px-6 whitespace-nowrap">Lead Collected</th>
                  <th className="py-4 px-6 whitespace-nowrap">Activity Date</th>
                  <th className="py-4 px-6 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {filtered.map((chat) => {
                  const chatDate = new Date(chat.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const isLead = chat.metadata?.lead_captured === true || chat.lead_captured === true;

                  return (
                    <tr key={chat.id} className="text-slate-350 hover:bg-slate-900/30 transition-colors">
                      <td className="py-4 px-6 font-extrabold text-white text-sm whitespace-nowrap">
                        {chat.businesses?.name || "Deleted Business"}
                      </td>
                      <td className="py-4 px-6 font-medium capitalize text-slate-400 whitespace-nowrap">
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                          <Globe className="w-3.5 h-3.5 text-slate-500" />
                          {(chat.source || "widget").replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-mono text-slate-400 select-all whitespace-nowrap">
                        {chat.visitor_id || "Anonymous User"}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider whitespace-nowrap ${
                            isLead
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : "bg-slate-900 border-slate-800 text-slate-500"
                          }`}
                        >
                          {isLead ? "Captured" : "No Lead"}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-400 whitespace-nowrap">
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {chatDate}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <Button
                          onClick={() => setSelectedChat(chat)}
                          variant="ghost"
                          className="rounded-xl h-9 text-[10px] font-bold uppercase tracking-wider border border-slate-850 hover:bg-slate-900 hover:text-white"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16 text-slate-500">
            <p className="text-sm">No chat conversations found matching query.</p>
          </div>
        )}
      </div>

      {/* Chronological Chat Transcript Drawer Overlay */}
      {selectedChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/60 backdrop-blur-sm">
          <div className="w-full max-w-lg h-full bg-slate-950 border-l border-slate-800 p-8 overflow-y-auto flex flex-col justify-between relative shadow-2xl">
            <div className="flex-1 flex flex-col min-h-0">
              {/* Drawer Top */}
              <div className="flex justify-between items-start mb-6 border-b border-slate-900 pb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20 text-indigo-400">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                      Chat Conversation Transcript
                    </h2>
                    <p className="text-[10px] font-semibold text-slate-500">
                      ID: {selectedChat.id.substring(0, 15)}...
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedChat(null)}
                  className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Chat Transcript Area */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {selectedChat.messages && selectedChat.messages.length > 0 ? (
                  selectedChat.messages
                    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .map((msg: any) => {
                      const isUser = msg.role === "user";
                      return (
                        <div key={msg.id} className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border text-[10px] font-bold ${
                            isUser 
                              ? "bg-slate-900 border-slate-800 text-indigo-400" 
                              : "bg-indigo-600 border-indigo-500 text-white"
                          }`}>
                            {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                          </div>
                          <div className={`max-w-[75%] p-3.5 rounded-2xl border text-xs leading-relaxed ${
                            isUser 
                              ? "bg-slate-900/60 border-slate-850 text-slate-200 rounded-tr-none" 
                              : "bg-indigo-500/5 border-indigo-500/10 text-slate-100 rounded-tl-none"
                          }`}>
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            <span className="text-[8px] text-slate-500 block mt-1 text-right">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <p className="text-xs text-slate-500 py-12 text-center">No messages exchanged in this session.</p>
                )}
              </div>
            </div>

            {/* Bottom Drawer Footer */}
            <div className="pt-6 border-t border-slate-900 mt-6 shrink-0">
              <Button
                onClick={() => setSelectedChat(null)}
                className="w-full bg-slate-900 border border-slate-850 text-slate-300 hover:text-white rounded-2xl h-12 font-bold"
              >
                Close Transcript
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
