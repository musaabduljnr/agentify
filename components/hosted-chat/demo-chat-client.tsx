"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Send, User, Settings, X, Sparkles, AlertCircle, ExternalLink } from "lucide-react";
import { formatMarkdownToReact } from "@/lib/markdown";
import { useRouter } from "next/navigation";

type Message = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

type DemoChatClientProps = {
  demoBusinessId: string;
  demoBusinessName: string;
  demoSlug: string;
  assistantName: string;
  welcomeText: string;
  primaryColor: string;
  suggestedQuestions: string[];
  contactParam: string | null;
  websiteUrl: string;
};

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function DemoChatClient({
  demoBusinessId,
  demoBusinessName,
  demoSlug,
  assistantName,
  welcomeText,
  primaryColor,
  suggestedQuestions,
  contactParam,
  websiteUrl,
}: DemoChatClientProps) {
  const router = useRouter();
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

  const storageKey = useMemo(() => `agentify_demo_chat_${demoBusinessId}`, [demoBusinessId]);

  // Handle visitor ID and track page views
  useEffect(() => {
    const storedVisitorId = localStorage.getItem(`${storageKey}_visitor`) || createId("visitor");
    const storedConversationId = localStorage.getItem(`${storageKey}_conversation`);
    localStorage.setItem(`${storageKey}_visitor`, storedVisitorId);
    visitorIdRef.current = storedVisitorId;
    conversationIdRef.current = storedConversationId;

    // Track page view event and open event
    const trackPageView = async () => {
      try {
        const isFirstVisit = !localStorage.getItem(`${storageKey}_visited`);
        localStorage.setItem(`${storageKey}_visited`, "true");

        // Call an internal endpoint or log directly in DB using anon key
        // To be safe and clean, we will post an analytics log to a simple endpoint
        await fetch("/api/demo/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            demoBusinessId,
            visitorId: storedVisitorId,
            eventType: isFirstVisit ? "unique_visitor" : "page_viewed",
            metadata: {
              contact: contactParam,
              referrer: document.referrer || null,
              userAgent: navigator.userAgent,
            },
          }),
        });

        if (contactParam) {
          await fetch("/api/demo/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              demoBusinessId,
              visitorId: storedVisitorId,
              eventType: "demo_opened",
              metadata: { contact: contactParam },
            }),
          });
        }
      } catch (err) {
        console.error("Failed to track analytics:", err);
      }
    };

    trackPageView();
  }, [storageKey, demoBusinessId, contactParam]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

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
      const res = await fetch("/api/demo/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          demoBusinessId,
          conversationId: conversationIdRef.current,
          visitorId: visitorIdRef.current,
          message,
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
      }

      setMessages((current) => [
        ...current,
        { id: createId("assistant"), role: "assistant", content: data.reply },
      ]);
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

  // Handle claiming the assistant
  function handleClaim() {
    // Set cookie that expires in 1 hour
    document.cookie = `agentify_claim_demo=${demoSlug}; path=/; max-age=3600; SameSite=Lax; Secure`;
    router.push(`/signup?claim=${demoSlug}`);
  }

  return (
    <main className="h-screen w-screen overflow-hidden flex flex-col bg-slate-900 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/85">
      {/* 1. Subtle, Professional Agentify Banner */}
      <div className="bg-indigo-650 text-white py-3 px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-medium border-b border-indigo-500/20 shadow-md relative z-30 shrink-0">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <AlertCircle className="h-4.5 w-4.5 text-indigo-200 shrink-0" />
          <span>
            This AI assistant was generated by <strong>Agentify</strong> using publicly available information from this business website.
          </span>
        </div>
        <button
          onClick={handleClaim}
          className="flex items-center gap-1.5 bg-white text-indigo-700 hover:bg-indigo-50 px-4 py-1.5 rounded-full font-bold shadow transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] shrink-0"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Claim This AI Assistant
        </button>
      </div>

      {/* 2. Chat Layout */}
      <div className="flex-1 flex items-center justify-center p-0 sm:p-4 lg:p-6 overflow-hidden min-h-0">
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-slate-50 text-slate-900 sm:max-w-md sm:h-[84vh] sm:rounded-3xl sm:border sm:border-slate-800/40 sm:shadow-2xl">
          
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
                <p className="truncate text-xs font-semibold opacity-85">Demo for {demoBusinessName}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1 shrink-0">
              <span className="mr-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Demo
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
              return (
                <div key={message.id} className={`flex items-start gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
                  {!isUser && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm border border-slate-100">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] min-w-0 rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                      isUser
                        ? "rounded-tr-sm text-white"
                        : "rounded-tl-sm border border-slate-200/60 bg-white text-slate-800"
                    }`}
                    style={isUser ? { backgroundColor: primaryColor } : undefined}
                  >
                    <div className="break-words">{formatMarkdownToReact(message.content)}</div>
                  </div>
                  {isUser && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-600 border border-slate-300/40">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}
            {messages[messages.length - 1]?.role === "assistant" && !isSending && (
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
                <span>Assistant is typing...</span>
              </div>
            )}
          </div>

          {/* Suggested Prompts Quick Rows */}
          {messages.length === 1 && suggestedQuestions && suggestedQuestions.length > 0 && (
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-150 shrink-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Suggested questions:</p>
              <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                {suggestedQuestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendMessage(q)}
                    className="w-full text-left bg-white hover:bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 transition active:scale-[0.99] truncate"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

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
                placeholder="Ask anything about this business..."
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
          </form>

          {/* Sliding Details Drawer */}
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
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="h-16 w-16 rounded-full flex items-center justify-center text-white font-extrabold text-xl shadow-md" style={{ backgroundColor: primaryColor }}>
                    {assistantName[0]}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">{assistantName}</h3>
                    <p className="text-xs text-slate-500 font-medium">Bespoke AI Assistant</p>
                  </div>
                </div>

                {/* Business Info */}
                <div className="border-t border-slate-100 pt-5 space-y-2">
                  <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Business Details</h4>
                  <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-2">
                    <p className="text-xs font-bold text-slate-800">{demoBusinessName}</p>
                    <a
                      href={websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-semibold"
                    >
                      Visit Website
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                {/* Claim CTA */}
                <div className="border-t border-slate-100 pt-5 space-y-3">
                  <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Want this for your site?</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    You can install this exact assistant on your website in under 2 minutes. Claim it now to edit responses, customize styling, and view analytics.
                  </p>
                  <button
                    onClick={handleClaim}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 transition active:scale-[0.98]"
                  >
                    Claim This Assistant Free
                  </button>
                </div>
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
      </div>
    </main>
  );
}
