-- Stage 4: retrieval foundation for chat
-- Adds a pgvector RPC with soft relevance hints for age band and methodology.

CREATE OR REPLACE FUNCTION public.match_corpus_chunks(
  query_embedding vector(768),
  match_count integer DEFAULT 5,
  preferred_age_band text DEFAULT NULL,
  preferred_methodology text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  chunk_id text,
  topic text,
  age_band text,
  methodology text,
  content text,
  sources jsonb,
  confidence text,
  similarity double precision
)
LANGUAGE sql
STABLE
AS $$
  WITH scored_chunks AS (
    SELECT
      c.id,
      c.chunk_id,
      c.topic,
      c.age_band,
      c.methodology,
      c.content,
      c.sources,
      c.confidence,
      (1 - (c.embedding <=> query_embedding)) AS base_similarity,
      CASE
        WHEN preferred_age_band IS NOT NULL
          AND lower(coalesce(c.age_band, '')) = lower(preferred_age_band)
        THEN 0.08
        ELSE 0
      END AS age_band_boost,
      CASE
        WHEN preferred_methodology IS NOT NULL
          AND lower(c.methodology) = lower(preferred_methodology)
        THEN 0.06
        WHEN preferred_methodology IS NOT NULL
          AND lower(c.methodology) = 'all'
        THEN 0.03
        ELSE 0
      END AS methodology_boost,
      CASE
        WHEN lower(c.topic) LIKE '%safe sleep%'
          OR lower(c.topic) LIKE '%safe sleeping%'
        THEN 0.05
        ELSE 0
      END AS safety_boost
    FROM public.corpus_chunks AS c
  )
  SELECT
    id,
    chunk_id,
    topic,
    age_band,
    methodology,
    content,
    sources,
    confidence,
    (base_similarity + age_band_boost + methodology_boost + safety_boost) AS similarity
  FROM scored_chunks
  ORDER BY similarity DESC
  LIMIT LEAST(GREATEST(match_count, 1), 20);
$$;

GRANT EXECUTE ON FUNCTION public.match_corpus_chunks(vector, integer, text, text)
TO authenticated, service_role;
