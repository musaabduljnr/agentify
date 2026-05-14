import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Info, Database } from "lucide-react";

interface Chunk {
  content: string;
  similarity: number;
  metadata?: any;
}

export function RetrievedContextPanel({ chunks }: { chunks: Chunk[] }) {
  return (
    <div className="flex flex-col h-full border-l bg-muted/30">
      <div className="p-4 border-b bg-background flex items-center gap-2">
        <Database size={18} className="text-primary" />
        <h3 className="font-semibold text-sm">Retrieved Knowledge</h3>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {chunks.length === 0 ? (
            <div className="text-center py-10 px-4">
              <Info size={32} className="mx-auto mb-2 text-muted-foreground opacity-20" />
              <p className="text-sm text-muted-foreground">
                Ask a question to see the retrieved knowledge chunks used by the AI.
              </p>
            </div>
          ) : (
            chunks.map((chunk, i) => (
              <div key={i} className="bg-background rounded-lg border p-3 shadow-sm text-xs relative group">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    # {i + 1}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] text-green-600 bg-green-50 border-green-200">
                    {Math.round(chunk.similarity * 100)}% Match
                  </Badge>
                </div>
                <p className="text-muted-foreground leading-relaxed">
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
