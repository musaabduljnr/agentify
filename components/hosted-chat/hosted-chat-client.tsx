"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Send, User } from "lucide-react";

type Message = {
  id: string;
  role: "assistant" | "user";
  content: string;
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const visitorIdRef = useRef("");
  const conversationIdRef = useRef<string | null>(null);

  const storageKey = useMemo(() => `agentify_hosted_chat_${businessId}`, [businessId]);

  useEffect(() => {
    const storedVisitorId = localStorage.getItem(`${storageKey}_visitor`) || createId("visitor");
    const storedConversationId = localStorage.getItem(`${storageKey}_conversation`);
    localStorage.setItem(`${storageKey}_visitor`, storedVisitorId);
    visitorIdRef.current = storedVisitorId;
    conversationIdRef.current = storedConversationId;
  }, [storageKey]);

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

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl min-w-0 flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
              style={{ backgroundColor: primaryColor }}
            >
              <Bot className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-500">{businessName}</p>
              <h1 className="break-words text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl">{title}</h1>
            </div>
          </div>
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold uppercase tracking-widest text-emerald-700">
            Online now
          </div>
        </header>

        <section className="flex flex-col lg:grid min-w-0 flex-1 gap-6 py-6 lg:grid-cols-[320px_1fr]">
          <aside className="min-w-0 space-y-5 order-2 lg:order-1">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Assistant</p>
              <h2 className="mt-2 break-words text-lg font-extrabold text-slate-950">{assistantName}</h2>
              <p className="mt-3 break-words text-sm leading-6 text-slate-600">{description}</p>
            </div>

            {suggestedQuestions.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Try asking</p>
                <div className="mt-4 space-y-2">
                  {suggestedQuestions.slice(0, 6).map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() => sendMessage(question)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 break-words"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <div className="flex min-h-[520px] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:min-h-[640px] order-1 lg:order-2">
            <div
              className="border-b border-slate-200 px-5 py-4 text-white"
              style={{ backgroundColor: primaryColor }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-extrabold">{assistantName}</h2>
                  <p className="truncate text-xs font-semibold opacity-80">Replies from {businessName}</p>
                </div>
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4 sm:p-6">
              {messages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <div key={message.id} className={`flex items-start gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                    {!isUser && (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
                        <Bot className="h-5 w-5" />
                      </div>
                    )}
                    <div
                      className={`max-w-[82%] min-w-0 rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm break-words ${
                        isUser
                          ? "rounded-tr-sm text-white"
                          : "rounded-tl-sm border border-slate-200 bg-white text-slate-700"
                      }`}
                      style={isUser ? { backgroundColor: primaryColor } : undefined}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    </div>
                    {isUser && (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-600">
                        <User className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                );
              })}
              {isSending && (
                <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm">
                    <Bot className="h-5 w-5" />
                  </div>
                  {assistantName} is typing...
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-4">
              {error && <p className="mb-3 text-sm font-semibold text-red-600">{error}</p>}
              <div className="flex min-w-0 items-end gap-3">
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
                  className="max-h-32 min-h-12 min-w-0 flex-1 resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none transition focus:border-slate-400"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isSending}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: primaryColor }}
                  aria-label="Send message"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </form>
          </div>
        </section>

        <footer className="border-t border-slate-200 py-4 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
          Powered by Agentify
        </footer>
      </div>
    </main>
  );
}
