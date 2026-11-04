"use client";

import { useState, useRef, useEffect } from "react";
import { MessageBubble } from "./message-bubble";
import { ChatInput } from "./chat-input";
import { RetrievedContextPanel } from "./retrieved-context-panel";
import { sendDashboardTestMessage } from "@/lib/actions/chat";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, Database, ShieldAlert, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  retrieved_chunks?: any[];
}

interface ChatPlaygroundProps {
  initialAssistant: any;
  hasKnowledge: boolean;
}

export function ChatPlayground({ initialAssistant, hasKnowledge }: ChatPlaygroundProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [activeChunks, setActiveChunks] = useState<any[]>([]);
  const [activeIntent, setActiveIntent] = useState<any | null>(null);
  const [knowledgeState, setKnowledgeState] = useState<"idle" | "loading" | "ready" | "empty" | "error">("idle");
  const [knowledgeError, setKnowledgeError] = useState<string | undefined>();
  const [isKnowledgeOpen, setIsKnowledgeOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (text: string) => {
    if (isLoading) return;

    // 1. Add user message optimisticly
    const userMsg: Message = {
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setActiveChunks([]);
    setActiveIntent(null);
    setKnowledgeState("loading");
    setKnowledgeError(undefined);

    try {
      const result = await sendDashboardTestMessage({
        message: text,
        conversationId,
      }) as any;

      if (result.error) {
        setKnowledgeState("error");
        setKnowledgeError("The request could not be completed. Try again.");
        toast.error(result.error);
        return;
      }

      // Handle usage limit reached — show as assistant message
      if (result.limitReached) {
        setKnowledgeState("idle");
        const limitMsg: Message = {
          role: "assistant",
          content: result.reply || "You've reached your message limit. Please upgrade your plan.",
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, limitMsg]);
        return;
      }

      if (result.success && result.assistantMessage) {
        setConversationId(result.conversationId);
        setMessages(prev => [...prev, result.assistantMessage as Message]);
        const chunks = result.retrievedChunks || [];
        setActiveChunks(chunks);
        setActiveIntent(result.intent || null);
        setKnowledgeState(chunks.length > 0 ? "ready" : "empty");
        return;
      }

      setKnowledgeState("error");
      setKnowledgeError("The request could not be completed. Try again.");
      toast.error("Failed to send message. Please try again.");
    } catch {
      setKnowledgeState("error");
      setKnowledgeError("The request could not be completed. Try again.");
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setConversationId(undefined);
    setActiveChunks([]);
    setActiveIntent(null);
    setKnowledgeState("idle");
    setKnowledgeError(undefined);
  };

  if (!initialAssistant) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 p-6 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <ShieldAlert size={22} />
        </div>
        <h2 className="mb-2 text-lg font-semibold">Assistant not configured</h2>
        <p className="mb-6 max-w-md text-sm text-muted-foreground">
          You need to set up your AI assistant profile before you can test it in the playground.
        </p>
        <Button asChild size="sm">
          <a href="/dashboard/assistant">Configure Assistant</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 lg:h-[calc(100dvh-290px)] lg:min-h-[560px] lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
      <section aria-label="Assistant conversation" className="flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm lg:min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Conversation</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Assistant tone: <span className="capitalize text-foreground">{initialAssistant.tone || "Default"}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground lg:hidden"
              onClick={() => setIsKnowledgeOpen((open) => !open)}
              aria-expanded={isKnowledgeOpen}
              aria-controls="playground-knowledge-mobile"
            >
              <Database size={15} className="mr-1.5" />
              Knowledge
              <ChevronDown size={14} className={`ml-1 transition-transform ${isKnowledgeOpen ? "rotate-180" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNewChat}
              className="h-8 text-muted-foreground hover:text-destructive"
              aria-label="Clear conversation"
            >
              <Trash2 size={15} className="mr-1.5" />
              Clear
            </Button>
          </div>
        </div>

        {!hasKnowledge && (
          <div className="flex items-start gap-2.5 border-b border-primary/10 bg-primary/[0.035] px-4 py-3 sm:px-5">
            <Database size={15} className="mt-0.5 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              No embedded knowledge found. Your assistant will answer from general knowledge or its system prompt.
            </p>
            <a href="/dashboard/knowledge" className="ml-auto shrink-0 text-xs font-medium text-primary hover:underline">
              Add knowledge
            </a>
          </div>
        )}

        <ScrollArea className="min-h-0 flex-1" ref={scrollRef}>
          <div className="min-h-full p-4 sm:p-5">
          {messages.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center px-5 py-10 text-center sm:min-h-[360px]">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border bg-muted/40 text-primary">
                <Sparkles size={22} />
              </div>
              <h3 className="mb-1.5 text-base font-semibold">Test your assistant</h3>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                Explore how your assistant responds using its configured instructions and knowledge base.
              </p>
              <div className="mt-6 w-full max-w-md">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Try a question</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleSendMessage("What does this business do?")}
                    className="rounded-lg border bg-background px-3 py-2.5 text-left text-xs leading-relaxed transition-colors hover:border-primary/30 hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    What does this business do?
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleSendMessage("How can I contact you?")}
                    className="rounded-lg border bg-background px-3 py-2.5 text-left text-xs leading-relaxed transition-colors hover:border-primary/30 hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    How can I contact you?
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
              ))}
              {messages[messages.length - 1]?.role === "assistant" && !isLoading && (
                <div className="flex justify-start pl-11">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleSendMessage("Continue")}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Continue response
                  </Button>
                </div>
              )}
              {isLoading && (
                <div role="status" aria-label="Assistant is generating a response" className="mb-4 flex animate-pulse flex-row gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border bg-muted">
                    <Sparkles size={16} className="text-muted-foreground" />
                  </div>
                  <div className="h-10 w-28 rounded-lg bg-muted" />
                </div>
              )}
            </div>
          )}
          </div>
        </ScrollArea>

        <div className="border-t bg-background p-3 sm:p-4">
          <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            AI can make mistakes. Verify important information.
          </p>
        </div>
      </section>

      <aside aria-label="Retrieved knowledge" className="hidden min-h-0 overflow-hidden rounded-xl border bg-card shadow-sm lg:flex">
        <RetrievedContextPanel
          chunks={activeChunks}
          intent={activeIntent}
          state={knowledgeState}
          error={knowledgeError}
        />
      </aside>
      <aside
        id="playground-knowledge-mobile"
        aria-label="Retrieved knowledge"
        aria-hidden={!isKnowledgeOpen}
        className={`${isKnowledgeOpen ? "flex" : "hidden"} h-[360px] min-h-0 overflow-hidden rounded-xl border bg-card shadow-sm lg:hidden`}
      >
        <RetrievedContextPanel
          chunks={activeChunks}
          intent={activeIntent}
          state={knowledgeState}
          error={knowledgeError}
        />
      </aside>
    </div>
  );
}
