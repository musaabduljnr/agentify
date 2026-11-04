import { cn } from "@/lib/utils";
import { User, Bot } from "lucide-react";
import { formatMarkdownToReact } from "@/lib/markdown";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "mb-5 flex w-full gap-3 animate-in fade-in slide-in-from-bottom-2",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg border",
          isUser ? "border-primary bg-primary text-primary-foreground" : "bg-background text-primary"
        )}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>
      <div
        className={cn(
          "flex min-w-0 flex-col gap-1 max-w-[85%] sm:max-w-[80%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "max-w-full rounded-xl px-4 py-3 text-sm",
            isUser
                ? "bg-primary text-primary-foreground"
                : "border bg-background"
          )}
        >
            <div className="break-words leading-6 [overflow-wrap:anywhere]">{formatMarkdownToReact(message.content)}</div>
        </div>
          <time dateTime={message.created_at} className="px-1 text-[10px] text-muted-foreground">
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
          </time>
      </div>
    </div>
  );
}
