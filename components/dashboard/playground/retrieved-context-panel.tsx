import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Info, Database, Sparkles } from "lucide-react";

interface Chunk {
  content: string;
  similarity: number;
  metadata?: any;
}

interface Intent {
  intentType: string;
  confidence: number;
  requestedAction?: string;
}

interface RetrievedContextPanelProps {
  chunks: Chunk[];
  intent?: Intent | null;
}

export function RetrievedContextPanel({ chunks, intent }: RetrievedContextPanelProps) {
  return (
    <div className="flex h-full min-w-0 flex-col bg-muted/30">
      <div className="p-4 border-b bg-background flex items-center gap-2">
        <Database size={18} className="text-primary" />
        <h3 className="font-semibold text-sm">Retrieved Knowledge</h3>
      </div>

      {intent && (
        <div className="mx-4 mt-4 p-3 bg-indigo-600/5 border border-indigo-500/15 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1">
              <Sparkles size={11} className="animate-pulse" />
              User Intent Detected
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
              {intent.intentType.replace("_", " ")}
            </span>
          </div>
          
          <div className="flex justify-between text-[10px] text-muted-foreground pt-1">
            <span>Intent Classifier Confidence</span>
            <span className="font-mono font-bold text-foreground">
              {Math.round(intent.confidence * 100)}%
            </span>
          </div>

          {intent.requestedAction && (
            <div className="flex justify-between text-[10px] text-muted-foreground border-t border-indigo-500/10 pt-1.5 mt-1">
              <span>Automatic Action</span>
              <span className="font-semibold text-indigo-300">
                {intent.requestedAction}
              </span>
            </div>
          )}
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {chunks.length === 0 ? (
            <div className="text-center py-10 px-4">
              <Info size={32} className="mx-auto mb-2 text-muted-foreground opacity-20" />
              <p className="text-xs text-muted-foreground">
                Ask a question to see the retrieved knowledge chunks and intent classification results.
              </p>
            </div>
          ) : (
            chunks.map((chunk, i) => (
              <div key={i} className="bg-background rounded-lg border p-3 shadow-sm text-xs relative group min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    # {i + 1}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] text-green-600 bg-green-50/50 border-green-200/50">
                    {Math.round(chunk.similarity * 100)}% Match
                  </Badge>
                </div>
                <p className="text-muted-foreground leading-relaxed break-words">
                  {chunk.content}
                </p>
                {chunk.metadata?.source_title && (
                  <div className="mt-2 pt-2 border-t text-[10px] italic truncate text-muted-foreground">
                    Source: {chunk.metadata.source_title}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
