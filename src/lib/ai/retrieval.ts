import 'server-only'

import { createClient } from '@/lib/supabase/server'
import {
  rerankRetrievedChunks,
  type RetrievalDiagnostics,
  type RetrievalRankingCandidate,
} from '@/lib/ai/retrieval-ranking'
export type { RetrievalDiagnostics } from '@/lib/ai/retrieval-ranking'

const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001'
const EMBEDDING_DIMENSION = 768
const DEFAULT_MATCH_LIMIT = 7
const MIN_SIMILARITY = 0.3
const MAX_INTERNAL_MATCH_LIMIT = 12

export type SleepMethodology = 'gentle' | 'balanced' | 'fast-track' | 'all'

export type RetrievedCorpusChunk = {
  id: string
  chunkId: string
  topic: string
  ageBand: string | null
  methodology: SleepMethodology
  content: string
  sources: Array<{ name: string; url: string }>
  confidence: 'high' | 'medium' | 'low'
  similarity: number
}

export type RetrieveChunksInput = {
  query: string
  ageBand?: string | null
  methodology?: SleepMethodology | null
  limit?: number
}

export type RetrieveChunksResult = {
  chunks: RetrievedCorpusChunk[]
  diagnostics: RetrievalDiagnostics
}

function parseSources(value: unknown): Array<{ name: string; url: string }> {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((source) => {
      if (!source || typeof source !== 'object') {
        return false
      }
      return 'name' in source && 'url' in source
    })
    .map((source) => ({
      name: String((source as { name: unknown }).name ?? ''),
      url: String((source as { url: unknown }).url ?? ''),
    }))
    .filter((source) => source.name.length > 0 && source.url.length > 0)
}

function normalizeMethodology(value: RetrieveChunksInput['methodology']) {
  if (!value) {
    return null
  }

  const normalized = value.toLowerCase()
  if (
    normalized !== 'gentle' &&
    normalized !== 'balanced' &&
    normalized !== 'fast-track' &&
    normalized !== 'all'
  ) {
    return null
  }

  return normalized as SleepMethodology
}

function clampLimit(value: number | undefined) {
  if (!value || Number.isNaN(value)) {
    return DEFAULT_MATCH_LIMIT
  }

  return Math.min(Math.max(Math.floor(value), 1), 20)
}

function getInternalMatchLimit(limit: number) {
  return Math.min(Math.max(limit * 3, limit + 2), MAX_INTERNAL_MATCH_LIMIT)
}

function formatVectorLiteral(values: number[]) {
  return `[${values.join(',')}]`
}

function parseEmbeddingLiteral(value: unknown) {
  if (typeof value !== 'string') {
    return []
  }

  const trimmed = value.trim()
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    return []
  }

  const inner = trimmed.slice(1, -1)
  if (!inner.trim()) {
    return []
  }

  return inner
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((num) => Number.isFinite(num))
}

function dotProduct(a: number[], b: number[]) {
  let sum = 0
  for (let i = 0; i < a.length; i += 1) {
    sum += a[i] * b[i]
  }
  return sum
}

function magnitude(values: number[]) {
  return Math.sqrt(dotProduct(values, values))
}

function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length || a.length === 0) {
    return 0
  }

  const denom = magnitude(a) * magnitude(b)
  if (denom === 0) {
    return 0
  }

  return dotProduct(a, b) / denom
}

function scoreChunk(
  baseSimilarity: number,
  row: {
    topic: string
    age_band: string | null
    methodology: string
  },
  preferredAgeBand: string | null,
  preferredMethodology: SleepMethodology | null
) {
  const ageBandBoost =
    preferredAgeBand &&
    row.age_band &&
    row.age_band.toLowerCase() === preferredAgeBand.toLowerCase()
      ? 0.08
      : 0

  const methodologyBoost =
    preferredMethodology && row.methodology.toLowerCase() === preferredMethodology
      ? 0.06
      : preferredMethodology && row.methodology.toLowerCase() === 'all'
        ? 0.03
        : 0

  const lowerTopic = row.topic.toLowerCase()
  const safetyBoost =
    lowerTopic.includes('safe sleep') || lowerTopic.includes('safe sleeping') ? 0.05 : 0

  return baseSimilarity + ageBandBoost + methodologyBoost + safetyBoost
}

async function embedQuery(query: string) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY for retrieval embedding')
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: {
          parts: [{ text: query }],
        },
        outputDimensionality: EMBEDDING_DIMENSION,
      }),
    }
  )

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Gemini query embedding failed (${response.status}): ${errorBody}`)
  }

  const data = await response.json()
  const values = data?.embedding?.values

  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `Expected ${EMBEDDING_DIMENSION}-dimension query embedding, got ${
        Array.isArray(values) ? values.length : 'invalid'
      }`
    )
  }

  return values as number[]
}

export async function retrieveRelevantChunks(
  input: RetrieveChunksInput
): Promise<RetrievedCorpusChunk[]> {
  const result = await retrieveRelevantChunksWithDiagnostics(input)
  return result.chunks
}

function buildEmptyDiagnostics(input: RetrieveChunksInput, limit: number): RetrievalDiagnostics {
  return {
    queryPreview: '',
    ageBand: input.ageBand?.trim() || null,
    methodology: normalizeMethodology(input.methodology),
    strategy: 'empty',
    limit,
    candidateCount: 0,
    selectedCount: 0,
    intents: [],
    candidates: [],
  }
}

function toRetrievedChunk(row: {
  id: unknown
  chunk_id: unknown
  topic: unknown
  age_band: unknown
  methodology: unknown
  content: unknown
  sources: unknown
  confidence: unknown
  similarity: unknown
}) {
  return {
    id: String(row.id),
    chunkId: String(row.chunk_id),
    topic: String(row.topic),
    ageBand: row.age_band ? String(row.age_band) : null,
    methodology: String(row.methodology) as SleepMethodology,
    content: String(row.content),
    sources: parseSources(row.sources),
    confidence: String(row.confidence) as RetrievedCorpusChunk['confidence'],
    similarity: Number(row.similarity ?? 0),
  } satisfies RetrievedCorpusChunk
}

function rerankChunks(args: {
  query: string
  ageBand: string | null
  methodology: SleepMethodology | null
  strategy: RetrievalDiagnostics['strategy']
  limit: number
  candidates: RetrievedCorpusChunk[]
}): RetrieveChunksResult {
  const reranked = rerankRetrievedChunks({
    query: args.query,
    ageBand: args.ageBand,
    methodology: args.methodology,
    strategy: args.strategy,
    limit: args.limit,
    candidates: args.candidates as RetrievalRankingCandidate[],
  })

  return {
    chunks: reranked.selected as RetrievedCorpusChunk[],
    diagnostics: reranked.diagnostics,
  }
}

export async function retrieveRelevantChunksWithDiagnostics(
  input: RetrieveChunksInput
): Promise<RetrieveChunksResult> {
  const trimmedQuery = input.query.trim()
  const limit = clampLimit(input.limit)

  if (!trimmedQuery) {
    return {
      chunks: [],
      diagnostics: buildEmptyDiagnostics(input, limit),
    }
  }

  const queryEmbedding = await embedQuery(trimmedQuery)
  const supabase = await createClient()
  const preferredMethodology = normalizeMethodology(input.methodology)
  const preferredAgeBand = input.ageBand?.trim() || null
  const internalLimit = getInternalMatchLimit(limit)

  const { data, error } = await supabase.rpc('match_corpus_chunks', {
    query_embedding: formatVectorLiteral(queryEmbedding),
    match_count: internalLimit,
    preferred_age_band: preferredAgeBand,
    preferred_methodology: preferredMethodology,
  })

  if (!error) {
    const rows = (Array.isArray(data) ? data : [])
      .map((row) => toRetrievedChunk(row))
      .filter((row) => row.similarity >= MIN_SIMILARITY)

    return rerankChunks({
      query: trimmedQuery,
      ageBand: preferredAgeBand,
      methodology: preferredMethodology,
      strategy: 'rpc',
      limit,
      candidates: rows,
    })
  }

  const isMissingRpc =
    error.message.includes('match_corpus_chunks') &&
    (error.message.includes('does not exist') || error.message.includes('Could not find'))

  if (!isMissingRpc) {
    throw new Error(`Retrieval query failed: ${error.message}`)
  }

  const { data: fallbackRows, error: fallbackError } = await supabase
    .from('corpus_chunks')
    .select('id, chunk_id, topic, age_band, methodology, content, sources, confidence, embedding')

  if (fallbackError) {
    throw new Error(`Retrieval fallback query failed: ${fallbackError.message}`)
  }

  const ranked = (fallbackRows ?? [])
    .map((row) => {
      const chunkEmbedding = parseEmbeddingLiteral(row.embedding)
      const baseSimilarity = cosineSimilarity(queryEmbedding, chunkEmbedding)
      const similarity = scoreChunk(
        baseSimilarity,
        {
          topic: row.topic,
          age_band: row.age_band,
          methodology: row.methodology,
        },
        preferredAgeBand,
        preferredMethodology
      )

      return {
        id: String(row.id),
        chunkId: String(row.chunk_id),
        topic: String(row.topic),
        ageBand: row.age_band ? String(row.age_band) : null,
        methodology: String(row.methodology) as SleepMethodology,
        content: String(row.content),
        sources: parseSources(row.sources),
        confidence: String(row.confidence) as RetrievedCorpusChunk['confidence'],
        similarity,
      }
    })
    .filter((row) => row.similarity >= MIN_SIMILARITY)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, internalLimit)

  return rerankChunks({
    query: trimmedQuery,
    ageBand: preferredAgeBand,
    methodology: preferredMethodology,
    strategy: 'fallback',
    limit,
    candidates: ranked,
  })
}
