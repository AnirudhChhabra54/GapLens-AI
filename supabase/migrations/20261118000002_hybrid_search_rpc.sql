-- ==============================================================================
-- GapLens AI Migration 2: Reciprocal Rank Fusion (RRF) Hybrid Search RPC
-- ==============================================================================

-- Stored procedure combining dense vector cosine similarity (pgvector)
-- and sparse keyword BM25/full-text ranking (tsvector) using Reciprocal Rank Fusion.
CREATE OR REPLACE FUNCTION match_documents_hybrid(
    p_workspace_id UUID,
    p_query_text TEXT,
    p_query_embedding VECTOR(768),
    p_match_count INT DEFAULT 10,
    p_allowed_doc_types document_type[] DEFAULT ARRAY['syllabus', 'material']::document_type[],
    p_rrf_k INT DEFAULT 60
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    chunk_index INT,
    page_start INT,
    page_end INT,
    section_heading TEXT,
    content TEXT,
    document_name TEXT,
    doc_type document_type,
    similarity FLOAT,
    rrf_score FLOAT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    WITH vector_matches AS (
        SELECT 
            dc.id,
            (1.0 - (dc.embedding <=> p_query_embedding))::FLOAT AS sim,
            ROW_NUMBER() OVER (ORDER BY dc.embedding <=> p_query_embedding ASC) AS rank
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        WHERE dc.workspace_id = p_workspace_id
          AND d.doc_type = ANY(p_allowed_doc_types)
          AND d.status = 'indexed'
        LIMIT GREATEST(p_match_count * 2, 20)
    ),
    fts_matches AS (
        SELECT 
            dc.id,
            ts_rank_cd(dc.fts, websearch_to_tsquery('english', p_query_text))::FLOAT AS rank_score,
            ROW_NUMBER() OVER (ORDER BY ts_rank_cd(dc.fts, websearch_to_tsquery('english', p_query_text)) DESC) AS rank
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
        WHERE dc.workspace_id = p_workspace_id
          AND d.doc_type = ANY(p_allowed_doc_types)
          AND d.status = 'indexed'
          AND dc.fts @@ websearch_to_tsquery('english', p_query_text)
        LIMIT GREATEST(p_match_count * 2, 20)
    ),
    combined AS (
        SELECT 
            COALESCE(v.id, f.id) AS chunk_id,
            COALESCE(v.sim, 0.0)::FLOAT AS sim,
            (COALESCE(1.0 / (p_rrf_k + v.rank), 0.0) + COALESCE(1.0 / (p_rrf_k + f.rank), 0.0))::FLOAT AS score
        FROM vector_matches v
        FULL OUTER JOIN fts_matches f ON v.id = f.id
    )
    SELECT 
        dc.id,
        dc.document_id,
        dc.chunk_index,
        dc.page_start,
        dc.page_end,
        dc.section_heading,
        dc.content,
        d.filename AS document_name,
        d.doc_type,
        c.sim::FLOAT AS similarity,
        c.score::FLOAT AS rrf_score
    FROM combined c
    JOIN document_chunks dc ON c.chunk_id = dc.id
    JOIN documents d ON dc.document_id = d.id
    ORDER BY c.score DESC
    LIMIT p_match_count;
END;
$$;

-- Wrapper alias providing identical signature under hybrid_search_chunks
CREATE OR REPLACE FUNCTION hybrid_search_chunks(
    p_workspace_id UUID,
    p_query_text TEXT,
    p_query_embedding VECTOR(768),
    p_match_count INT DEFAULT 10,
    p_allowed_doc_types document_type[] DEFAULT ARRAY['syllabus', 'material']::document_type[],
    p_rrf_k INT DEFAULT 60
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    chunk_index INT,
    page_start INT,
    page_end INT,
    section_heading TEXT,
    content TEXT,
    document_name TEXT,
    doc_type document_type,
    similarity FLOAT,
    rrf_score FLOAT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM match_documents_hybrid(
        p_workspace_id,
        p_query_text,
        p_query_embedding,
        p_match_count,
        p_allowed_doc_types,
        p_rrf_k
    );
END;
$$;
