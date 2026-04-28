import type { RetrievalDiagnostics } from './retrieval'

type RetrievedChunk = {
  topic: string
  sources: Array<{ name: string; url: string }>
}

export type SourceAttribution = {
  name: string
  topic: string
}

export function getConfidenceLabel(matchCount: number): 'high' | 'medium' | 'low' {
  if (matchCount >= 4) {
    return 'high'
  }

  if (matchCount >= 2) {
    return 'medium'
  }

  return 'low'
}

export function toSourceAttribution(chunks: RetrievedChunk[]): SourceAttribution[] {
  const seen = new Set<string>()
  const seenTopics = new Set<string>()
  const output: SourceAttribution[] = []

  for (const chunk of chunks) {
    const topicKey = chunk.topic.toLowerCase()
    if (seenTopics.has(topicKey)) {
      continue
    }

    for (const source of chunk.sources) {
      const key = `${source.name.toLowerCase()}::${chunk.topic.toLowerCase()}`
      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      seenTopics.add(topicKey)
      output.push({ name: source.name, topic: chunk.topic })
      if (output.length >= 5) {
        return output
      }
      break
    }
  }

  return output
}

export function createSseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export function shouldIncludeRetrievalDiagnostics(request: Request, isEvalMode: boolean) {
  const url = new URL(request.url)
  return (
    process.env.SOMNI_INCLUDE_RETRIEVAL_DEBUG === 'true' ||
    isEvalMode ||
    request.headers.get('x-retrieval-debug') === 'true' ||
    url.searchParams.get('retrieval_debug') === '1'
  )
}

export function shouldLogRetrievalDiagnostics(request: Request, isEvalMode: boolean) {
  return (
    shouldIncludeRetrievalDiagnostics(request, isEvalMode) ||
    process.env.SOMNI_LOG_RETRIEVAL === 'true'
  )
}

export function buildRetrievalLogPayload(diagnostics: RetrievalDiagnostics, conversationId: string) {
  return {
    conversationId,
    queryPreview: diagnostics.queryPreview,
    strategy: diagnostics.strategy,
    ageBand: diagnostics.ageBand,
    methodology: diagnostics.methodology,
    intents: diagnostics.intents,
    selectedCount: diagnostics.selectedCount,
    candidates: diagnostics.candidates
      .filter((candidate) => candidate.selected)
      .map((candidate) => ({
        chunkId: candidate.chunkId,
        topic: candidate.topic,
        retrievalScore: candidate.retrievalScore,
        rerankBoost: candidate.rerankBoost,
        finalScore: candidate.finalScore,
        reasons: candidate.reasons.map((reason) => reason.label),
      })),
  }
}

export function getRecentSleepSummary(
  logs: Array<{
    started_at: string
    ended_at: string | null
    is_night: boolean
    tags: string[] | null
  }>
) {
  if (logs.length === 0) {
    return 'No recent sleep logs yet.'
  }

  const nightCount = logs.filter((log) => log.is_night).length
  const dayCount = logs.length - nightCount
  const activeCount = logs.filter((log) => !log.ended_at).length

  return `${logs.length} recent logs (${nightCount} night, ${dayCount} day, ${activeCount} active).`
}
