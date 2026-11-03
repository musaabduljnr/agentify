import "server-only";

import { createServiceClient } from "@/utils/supabase/service";
import { generateEmbedding } from "@/lib/vertex/embeddings";
import { chunkText, estimateTokens } from "@/lib/embeddings/chunker";

export async function generateEmbeddingsForSourceInternal(sourceId: string, businessId: string) {
  const supabase = createServiceClient();
  const { data: source, error: fetchError } = await supabase
    .from("knowledge_sources")
    .select("*")
    .eq("id", sourceId)
    .eq("business_id", businessId)
    .single();

  if (fetchError || !source) return { error: "Knowledge source not found." };
  if (!source.content) return { error: "Source has no content to embed." };

  const chunks = chunkText(source.content);
  if (chunks.length === 0) {
    const updatedMetadata = {
      ...(source.metadata || {}),
      embedded: false,
      chunk_count: 0,
      embedding_error: "No usable text chunks were found. Add more source content or reprocess the website.",
    };

    await supabase
      .from("knowledge_sources")
      .update({ metadata: updatedMetadata })
      .eq("id", sourceId)
      .eq("business_id", businessId);

    return { error: "No usable text was found to embed." };
  }

  await supabase.from("knowledge_chunks").delete().eq("source_id", sourceId).eq("business_id", businessId);

  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i];
    const embedding = await generateEmbedding(content, businessId, "embeddings_generation");

    const { error: insertError } = await supabase.from("knowledge_chunks").insert({
      business_id: businessId,
      source_id: sourceId,
      content,
      embedding,
      chunk_index: i,
      token_estimate: estimateTokens(content),
      metadata: {
        source_type: source.type,
        source_title: source.title,
      },
    });

    if (insertError) throw new Error(`Insert failed: ${insertError.message}`);
  }

  const updatedMetadata = {
    ...(source.metadata || {}),
    embedded: true,
    embedded_at: new Date().toISOString(),
    chunk_count: chunks.length,
  };

  await supabase
    .from("knowledge_sources")
    .update({ metadata: updatedMetadata })
    .eq("id", sourceId)
    .eq("business_id", businessId);

  return { success: true, chunkCount: chunks.length };
}
