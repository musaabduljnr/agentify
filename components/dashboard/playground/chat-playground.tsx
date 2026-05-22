"use client";

import { useState, useRef, useEffect } from "react";
import { MessageBubble } from "./message-bubble";
import { ChatInput } from "./chat-input";
import { RetrievedContextPanel } from "./retrieved-context-panel";
import { sendDashboardTestMessage } from "@/lib/actions/chat";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Trash2, ShieldAlert } from "lucide-react";
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
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (text: string) => {
    // 1. Add user message optimisticly
    const userMsg: Message = {
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setActiveChunks([]);

    try {
      const result = await sendDashboardTestMessage({
        message: text,
        conversationId,
      }) as any;

      if (result.error) {
        toast.error(result.error);
        return;
      }

      // Handle usage limit reached — show as assistant message
      if (result.limitReached) {
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
        setActiveChunks(result.retrievedChunks || []);
      }
    } catch (error) {
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setConversationId(undefined);
    setActiveChunks([]);
  };

  if (!initialAssistant) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center p-6 bg-muted/10 rounded-2xl border-2 border-dashed">
        <ShieldAlert size={48} className="text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold mb-2">Assistant Not Configured</h2>
        <p className="text-muted-foreground max-w-md mb-6">
          You need to set up your AI assistant profile before you can test it in the playground.
        </p>
        <Button asChild>
          <a href="/dashboard/assistant">Configure Assistant</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 h-[calc(100vh-140px)] gap-6 overflow-hidden">
      <div className="lg:col-span-3 flex flex-col bg-background rounded-2xl border shadow-sm overflow-hidden relative">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-none">{initialAssistant.name}</h3>
              <p className="text-[11px] text-muted-foreground mt-1">
                Tone: <span className="capitalize">{initialAssistant.tone}</span>
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleNewChat} className="text-muted-foreground hover:text-destructive">
            <Trash2 size={16} className="mr-2" />
            Clear
          </Button>
        </div>

        {/* Warning if no knowledge */}
        {!hasKnowledge && (
          <div className="bg-yellow-50 border-b border-yellow-100 p-3 flex items-center gap-3 px-6">
            <ShieldAlert size={16} className="text-yellow-600 shrink-0" />
            <p className="text-[11px] text-yellow-700 font-medium">
              No embedded knowledge found. Your assistant will answer from general knowledge or its system prompt.
            </p>
          </div>
        )}

        {/* Chat Body */}
        <ScrollArea className="flex-1 p-6" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-center">
              <div className="h-16 w-16 bg-primary/5 rounded-full flex items-center justify-center mb-4">
                <Sparkles size={32} className="text-primary/40" />
              </div>
              <h4 className="text-lg font-semibold mb-2">Test Your Assistant</h4>
              <p className="text-sm text-muted-foreground max-w-sm">
                This is a private testing environment. Your assistant will use the knowledge you&apos;ve added to answer questions.
              </p>
              <div className="mt-8 p-4 bg-muted/50 rounded-lg border text-left max-w-md">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">Try asking:</p>
                <div className="space-y-2">
                  <button onClick={() => handleSendMessage("What does this business do?")} className="w-full text-left text-xs p-2 rounded hover:bg-background transition-colors border border-transparent hover:border-border">
                    "What does this business do?"
                  </button>
                  <button onClick={() => handleSendMessage("How can I contact you?")} className="w-full text-left text-xs p-2 rounded hover:bg-background transition-colors border border-transparent hover:border-border">
                    "How can I contact you?"
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
              ))}
              {isLoading && (
                <div className="flex flex-row gap-3 mb-4 animate-pulse">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-muted">
                    <Sparkles size={16} className="text-muted-foreground" />
                  </div>
                  <div className="bg-muted rounded-lg px-4 py-2 h-10 w-24"></div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Input area */}
        <div className="p-4 bg-background">
          <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
          <p className="text-[10px] text-center text-muted-foreground mt-3">
            AI can make mistakes. Verify important information.
          </p>
        </div>
      </div>

      {/* Right Sidebar - Context Panel */}
      <div className="lg:col-span-1 h-full overflow-hidden rounded-2xl border bg-background shadow-sm hidden lg:block">
        <RetrievedContextPanel chunks={activeChunks} />
      </div>
    </div>
  );
}
