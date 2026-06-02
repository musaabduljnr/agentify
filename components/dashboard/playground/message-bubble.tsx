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
        "flex w-full gap-3 mb-4 animate-in fade-in slide-in-from-bottom-2",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border shadow",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
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
            "max-w-full rounded-lg px-4 py-2 text-sm break-words",
            isUser
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-muted shadow-sm"
          )}
        >
          <div className="leading-relaxed break-words">{formatMarkdownToReact(message.content)}</div>
        </div>
        <span className="text-[10px] text-muted-foreground px-1">
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
