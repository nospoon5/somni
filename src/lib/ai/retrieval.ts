import 'server-only'

import { createClient } from '@/lib/supabase/server'

const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001'
const EMBEDDING_DIMENSION = 768
const DEFAULT_MATCH_LIMIT = 5

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
  const trimmedQuery = input.query.trim()
  if (!trimmedQuery) {
    return []
  }

  const queryEmbedding = await embedQuery(trimmedQuery)
  const limit = clampLimit(input.limit)
  const supabase = await createClient()
  const preferredMethodology = normalizeMethodology(input.methodology)
  const preferredAgeBand = input.ageBand?.trim() || null

  const { data, error } = await supabase.rpc('match_corpus_chunks', {
    query_embedding: formatVectorLiteral(queryEmbedding),
    match_count: limit,
    preferred_age_band: preferredAgeBand,
    preferred_methodology: preferredMethodology,
  })

  if (!error) {
    const rows = Array.isArray(data) ? data : []

    return rows.map((row) => ({
      id: String(row.id),
      chunkId: String(row.chunk_id),
      topic: String(row.topic),
      ageBand: row.age_band ? String(row.age_band) : null,
      methodology: String(row.methodology) as SleepMethodology,
      content: String(row.content),
      sources: parseSources(row.sources),
      confidence: String(row.confidence) as RetrievedCorpusChunk['confidence'],
      similarity: Number(row.similarity ?? 0),
    }))
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
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)

  return ranked
}
