"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Send, User, Settings, X, Sparkles } from "lucide-react";
import { formatMarkdownToReact } from "@/lib/markdown";

type Message = {
  id: string;
  role: "assistant" | "user";
  content: string;
  metadata?: Record<string, any>;
};

type HostedChatClientProps = {
  businessId: string;
  businessName: string;
  assistantName: string;
  welcomeText: string;
  title: string;
  description: string;
  primaryColor: string;
  suggestedQuestions: string[];
};

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function HostedChatClient({
  businessId,
  businessName,
  assistantName,
  welcomeText,
  title,
  description,
  primaryColor,
  suggestedQuestions,
}: HostedChatClientProps) {
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "assistant", content: welcomeText },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const visitorIdRef = useRef("");
  const conversationIdRef = useRef<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const storageKey = useMemo(() => `agentify_hosted_chat_${businessId}`, [businessId]);

  useEffect(() => {
    const storedVisitorId = localStorage.getItem(`${storageKey}_visitor`) || createId("visitor");
    const storedConversationId = localStorage.getItem(`${storageKey}_conversation`);
    localStorage.setItem(`${storageKey}_visitor`, storedVisitorId);
    visitorIdRef.current = storedVisitorId;
    conversationIdRef.current = storedConversationId;
    setConversationId(storedConversationId);
  }, [storageKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  // Poll message history every 4 seconds to fetch manual takeover responses in real time
  useEffect(() => {
    if (!conversationId) return;

    const fetchHistory = async () => {
      if (isSending) return;

      try {
        const res = await fetch(`/api/widget/chat/history?conversationId=${conversationId}&_=${Date.now()}`);
        const data = await res.json();
        if (data.messages && Array.isArray(data.messages)) {
          const formatted = data.messages.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            metadata: m.metadata,
          }));

          setMessages((current) => {
            const currentHistory = current.slice(1);
            
            // Check if lengths differ
            if (currentHistory.length !== formatted.length) {
              return [
                current[0], // welcome message
                ...formatted,
              ];
            }
            
            // Check if last message content changed (e.g. status updates)
            if (currentHistory.length > 0 && formatted.length > 0) {
              const lastCurrent = currentHistory[currentHistory.length - 1];
              const lastFormatted = formatted[formatted.length - 1];
              if (lastCurrent.content !== lastFormatted.content) {
                return [
                  current[0],
                  ...formatted,
                ];
              }
            }
            return current;
          });
        }
      } catch (err) {
        console.error("Error polling chat history:", err);
      }
    };

    fetchHistory();
    const interval = setInterval(fetchHistory, 4000);
    return () => clearInterval(interval);
  }, [conversationId, isSending]);

  async function sendMessage(rawMessage: string) {
    const message = rawMessage.trim();
    if (!message || isSending) return;

    setError("");
    setInput("");
    setIsSending(true);
    setMessages((current) => [
      ...current,
      { id: createId("user"), role: "user", content: message },
    ]);

    try {
      const res = await fetch("/api/widget/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          conversationId: conversationIdRef.current,
          visitorId: visitorIdRef.current,
          message,
          pageUrl: window.location.href,
          referrer: document.referrer || null,
          source: "hosted_chat",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "The assistant could not reply right now.");
      }

      if (data.conversationId) {
        conversationIdRef.current = data.conversationId;
        localStorage.setItem(`${storageKey}_conversation`, data.conversationId);
        setConversationId(data.conversationId);
      }

      if (data.reply !== null) {
        setMessages((current) => [
          ...current,
          { id: createId("assistant"), role: "assistant", content: data.reply },
        ]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(input);
  }

  return (
    <main className="h-screen w-screen overflow-hidden flex items-center justify-center bg-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/80 p-0 sm:p-6 lg:p-8">
      {/* Centered device layout */}
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-slate-50 text-slate-900 sm:max-w-md sm:h-[88vh] sm:rounded-3xl sm:border sm:border-slate-800/40 sm:shadow-2xl sm:backdrop-blur-md">
        
        {/* Chat Header */}
        <div
          className="flex items-center justify-between px-5 py-4 text-white shadow-sm z-10 shrink-0"
          style={{ backgroundColor: primaryColor }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white shadow-inner">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-extrabold text-sm tracking-tight">{assistantName}</h2>
              <p className="truncate text-xs font-semibold opacity-85">Replies from {businessName}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1 shrink-0">
            <span className="mr-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Online
            </span>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-xl hover:bg-white/10 active:bg-white/20 transition-all text-white focus:outline-none"
              aria-label="Toggle assistant details"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Message List */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-slate-50/50 p-4 sm:p-5">
          {messages.map((message) => {
            const isUser = message.role === "user";
            const isManualMsg = message.metadata?.is_manual || false;
            return (
              <div key={message.id} className={`flex items-start gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
                {!isUser && (
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm border ${
                    isManualMsg ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-white text-slate-500 border-slate-100"
                  }`}>
                    {isManualMsg ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                )}
                <div
                  className={`max-w-[78%] min-w-0 rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                    isUser
                      ? "rounded-tr-sm text-white"
                      : isManualMsg
                        ? "rounded-tl-sm border border-amber-200 bg-amber-50/30 text-slate-800"
                        : "rounded-tl-sm border border-slate-200/60 bg-white text-slate-800"
                  }`}
                  style={isUser ? { backgroundColor: primaryColor } : undefined}
                >
                  <div className="break-words">{formatMarkdownToReact(message.content)}</div>
                  {isManualMsg && (
                    <div className="mt-1 text-[9px] font-bold text-amber-700 tracking-wide uppercase select-none">
                      Support Agent
                    </div>
                  )}
                </div>
                {isUser && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-600 border border-slate-300/40">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })}
          {messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.metadata?.is_manual && !isSending && (
            <div className="flex justify-start pl-[42px] shrink-0">
              <button
                type="button"
                onClick={() => sendMessage("Continue")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-indigo-650 hover:text-indigo-800 text-xs font-bold shadow-sm transition active:scale-[0.98]"
              >
                <Sparkles className="h-3.5 w-3.5 animate-pulse text-indigo-500" />
                Continue response
              </button>
            </div>
          )}
          {isSending && (
            <div className="flex items-center gap-2.5 text-xs font-bold text-slate-400">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm border border-slate-100 animate-pulse">
                <Bot className="h-4 w-4" />
              </div>
              <span>{assistantName} is typing...</span>
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="border-t border-slate-200/80 bg-white p-4 shrink-0">
          {error && <p className="mb-2 text-xs font-semibold text-red-600">{error}</p>}
          <div className="flex min-w-0 items-end gap-2.5">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage(input);
                }
              }}
              rows={1}
              placeholder="Type your message..."
              className="max-h-24 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-medium outline-none transition focus:border-slate-300 focus:bg-white"
            />
            <button
              type="submit"
              disabled={!input.trim() || isSending}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white transition disabled:cursor-not-allowed disabled:opacity-40 shadow-sm active:scale-95"
              style={{ backgroundColor: primaryColor }}
              aria-label="Send message"
            >
              <Send className="h-4.5 w-4.5" />
            </button>
          </div>
          <div className="text-center mt-2.5 text-[9px] font-extrabold uppercase tracking-widest text-slate-350">
            Powered by <a href="https://agentify.ai" target="_blank" rel="noopener noreferrer" className="hover:text-slate-500 underline">Agentify</a>
          </div>
        </form>

        {/* Sliding Settings Drawer (Progressive Disclosure) */}
        <div
          className={`absolute inset-0 bg-slate-950/40 backdrop-blur-sm z-20 transition-opacity duration-300 ${
            showSettings ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          onClick={() => setShowSettings(false)}
        >
          <div
            className={`absolute right-0 top-0 bottom-0 w-[80%] max-w-sm bg-white shadow-2xl flex flex-col justify-between transition-transform duration-300 ease-out border-l border-slate-100 ${
              showSettings ? "translate-x-0" : "translate-x-full"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex justify-between items-center px-5 py-4 border-b border-slate-150 shrink-0">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Assistant Profile</span>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                aria-label="Close details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Profile Card */}
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="h-16 w-16 rounded-full flex items-center justify-center text-white font-extrabold text-xl shadow-md" style={{ backgroundColor: primaryColor }}>
                  {assistantName[0]}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">{assistantName}</h3>
                  <p className="text-xs text-slate-500 font-medium">Support Assistant</p>
                </div>
                {description && (
                  <p className="text-xs leading-relaxed text-slate-650 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 break-words w-full">
                    {description}
                  </p>
                )}
              </div>

              {/* Business Info */}
              <div className="border-t border-slate-100 pt-5 space-y-2">
                <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Company Information</h4>
                <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 space-y-1">
                  <p className="text-xs font-bold text-slate-800">{businessName}</p>
                  {title && <p className="text-xs text-slate-500">{title}</p>}
                </div>
              </div>

              {/* Suggested Questions */}
              {suggestedQuestions && suggestedQuestions.length > 0 && (
                <div className="border-t border-slate-100 pt-5 space-y-3">
                  <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Suggested Questions</h4>
                  <div className="flex flex-col gap-2">
                    {suggestedQuestions.slice(0, 6).map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => {
                          sendMessage(question);
                          setShowSettings(false);
                        }}
                        className="w-full text-left bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-950 border border-slate-150/80 px-4 py-3 rounded-xl text-xs font-semibold transition active:scale-[0.98] break-words"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-100 shrink-0">
              <button
                onClick={() => setShowSettings(false)}
                className="w-full py-3 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition active:scale-[0.97]"
              >
                Return to Chat
              </button>
            </div>

          </div>
        </div>

      </div>
    </main>
  );
}
