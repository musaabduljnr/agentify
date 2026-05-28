"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSendMessage, isLoading }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  return (
    <form
      onSubmit={handleSubmit}
      className="relative flex min-w-0 items-end gap-2 rounded-xl border bg-background p-2 shadow-lg ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
    >
      <Textarea
        ref={textareaRef}
        placeholder="Type a message to test your AI assistant..."
        rows={1}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        className="min-h-[44px] w-full min-w-0 resize-none border-0 bg-transparent py-3 focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      <Button
        type="submit"
        size="icon"
        disabled={!input.trim() || isLoading}
        className="h-10 w-10 shrink-0 rounded-lg"
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Send className="h-5 w-5" />
        )}
      </Button>
    </form>
  );
}
