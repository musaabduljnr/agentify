export interface RetrievedChunk {
  id: string;
  source_id: string;
  content: string;
  similarity: number;
  metadata: {
    source_type?: string;
    source_title?: string;
    source_url?: string | null;
    page_url?: string | null;
    page_title?: string | null;
    section_heading?: string | null;
    chunk_index?: number;
    token_estimate?: number;
    content_hash?: string;
    [key: string]: any;
  };
}
