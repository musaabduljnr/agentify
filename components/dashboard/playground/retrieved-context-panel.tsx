import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Database, FileText, Info, Loader2, Sparkles } from "lucide-react";

interface Chunk {
  content: string;
  similarity: number;
  metadata?: {
    source_title?: string;
  };
}

interface Intent {
  intentType: string;
  confidence: number;
  requestedAction?: string;
}

interface RetrievedContextPanelProps {
  chunks: Chunk[];
  intent?: Intent | null;
  state: "idle" | "loading" | "ready" | "empty" | "error";
  error?: string;
}

export function RetrievedContextPanel({
  chunks,
  intent,
  state,
  error,
}: RetrievedContextPanelProps) {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Database size={16} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Retrieved knowledge</h2>
            <p className="text-[11px] text-muted-foreground">Context used for this answer</p>
          </div>
        </div>
        {chunks.length > 0 && (
          <Badge variant="secondary" className="shrink-0 font-normal">
            {chunks.length} {chunks.length === 1 ? "source" : "sources"}
          </Badge>
        )}
      </div>

      {intent && (
        <div className="mx-3 mt-3 rounded-lg border bg-muted/20 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <Sparkles size={12} className="text-primary" />
              Detected intent
            </span>
            <Badge variant="outline" className="capitalize">
              {intent.intentType.replace(/_/g, " ")}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">Classifier confidence</span>
            <span className="font-medium tabular-nums">{Math.round(intent.confidence * 100)}%</span>
          </div>
          {intent.requestedAction && (
            <div className="mt-2 flex items-start justify-between gap-2 border-t pt-2 text-xs">
              <span className="shrink-0 text-muted-foreground">Requested action</span>
              <span className="text-right font-medium">{intent.requestedAction}</span>
            </div>
          )}
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-3">
          {state === "loading" ? (
            <div role="status" className="flex min-h-40 flex-col items-center justify-center px-4 text-center">
              <Loader2 size={20} className="mb-3 animate-spin text-primary" />
              <p className="text-sm font-medium">Searching your knowledge</p>
              <p className="mt-1 text-xs text-muted-foreground">Relevant context will appear here.</p>
            </div>
          ) : state === "error" ? (
            <div role="alert" className="flex min-h-40 flex-col items-center justify-center px-4 text-center">
              <Info size={20} className="mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">Unable to load context</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {error || "The request could not be completed. Try again."}
              </p>
            </div>
          ) : chunks.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                {state === "empty" ? <FileText size={18} /> : <Info size={18} />}
              </div>
              <p className="text-sm font-medium">
                {state === "empty" ? "No matching knowledge found" : "Knowledge inspector"}
              </p>
              <p className="mt-1.5 max-w-[230px] text-xs leading-relaxed text-muted-foreground">
                {state === "empty"
                  ? "No knowledge chunks were returned for this question. The assistant may still respond using its instructions or general knowledge."
                  : "Ask a question to see the knowledge retrieved for your assistant's response."}
              </p>
            </div>
          ) : (
            chunks.map((chunk, index) => (
              <article key={`${chunk.metadata?.source_title || "source"}-${index}`} className="min-w-0 rounded-lg border bg-background p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Context {index + 1}
                  </span>
                  <Badge variant="outline" className="font-normal tabular-nums">
                    {Math.round(chunk.similarity * 100)}% match
                  </Badge>
                </div>
                {chunk.metadata?.source_title && (
                  <p className="mb-2 flex min-w-0 items-center gap-1.5 text-xs font-medium">
                    <FileText size={13} className="shrink-0 text-muted-foreground" />
                    <span className="truncate">{chunk.metadata.source_title}</span>
                  </p>
                )}
                <p className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
                  {chunk.content}
                </p>
              </article>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
