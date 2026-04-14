export type RetrievalRankingCandidate = {
  id: string
  chunkId: string
  topic: string
  ageBand: string | null
  methodology: string
  content: string
  sources: Array<{ name: string; url: string }>
  confidence: 'high' | 'medium' | 'low'
  similarity: number
}

export type RetrievalIntentSignal =
  | 'early_morning_waking'
  | 'daycare_constraints'
  | 'nap_transition'
  | 'vague_reset'

export type RetrievalBoostReason = {
  label: string
  value: number
}

export type RetrievalDiagnosticCandidate = {
  chunkId: string
  topic: string
  ageBand: string | null
  methodology: string
  retrievalScore: number
  rerankBoost: number
  finalScore: number
  selected: boolean
  reasons: RetrievalBoostReason[]
}

export type RetrievalDiagnostics = {
  queryPreview: string
  ageBand: string | null
  methodology: string | null
  strategy: 'rpc' | 'fallback' | 'empty'
  limit: number
  candidateCount: number
  selectedCount: number
  intents: RetrievalIntentSignal[]
  candidates: RetrievalDiagnosticCandidate[]
}

type QueryAnalysis = {
  normalizedQuery: string
  intents: RetrievalIntentSignal[]
  focusTerms: string[]
}

type IntentRule = {
  id: RetrievalIntentSignal
  label: string
  boost: number
  queryPatterns: RegExp[]
  candidatePatterns: RegExp[]
}

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'at',
  'be',
  'but',
  'do',
  'for',
  'from',
  'get',
  'has',
  'have',
  'how',
  'i',
  'if',
  'in',
  'is',
  'it',
  'just',
  'my',
  'of',
  'on',
  'or',
  'our',
  'please',
  'she',
  'so',
  'that',
  'the',
  'their',
  'they',
  'this',
  'to',
  'we',
  'what',
  'when',
  'with',
  'you',
])

const INTENT_RULES: IntentRule[] = [
  {
    id: 'early_morning_waking',
    label: 'Matched early morning waking guidance',
    boost: 0.16,
    queryPatterns: [
      /\bearly morning\b/,
      /\b5(?:\s+00)?\s*am\b/,
      /\b5am\b/,
      /\bbefore 6\b/,
      /\b6(?:\s+30)?\s*am\b/,
      /\bwake up\b.*\b6(?:\s+30)?\s*am\b/,
    ],
    candidatePatterns: [/\bearly morning\b/, /\bbefore 6\b/, /\b5am\b/],
  },
  {
    id: 'daycare_constraints',
    label: 'Matched daycare or schedule-constraint guidance',
    boost: 0.14,
    queryPatterns: [/\bdaycare\b/, /\bchildcare\b/, /\bdrop[\s-]?off\b/, /\bpick[\s-]?up\b/, /\bwork\b/],
    candidatePatterns: [/\bdaycare\b/, /\bchildcare\b/, /\bdrop[\s-]?off\b/, /\bwork constraints?\b/, /\bschedule constraints?\b/],
  },
  {
    id: 'nap_transition',
    label: 'Matched nap-transition guidance',
    boost: 0.12,
    queryPatterns: [
      /\bnap transition\b/,
      /\b2 to 1\b/,
      /\bone nap\b/,
      /\btwo naps?\b/,
      /\bmorning nap\b/,
      /\bbridge the gap\b/,
      /\bbridg(?:e|ing)\b/,
      /\b1[123]\s?months?\b/,
      /\b11-month\b/,
      /\b12-month\b/,
      /\b13-month\b/,
    ],
    candidatePatterns: [/\bnap transitions?\b/, /\b2 to 1\b/, /\bone nap\b/, /\bbridg(?:e|ing)\b/],
  },
  {
    id: 'vague_reset',
    label: 'Matched reset-plan guidance for vague sleep questions',
    boost: 0.15,
    queryPatterns: [/\bsleep is bad\b/, /\bfix it\b/, /\breset\b/, /\bnothing works\b/, /\beverything is awful\b/],
    candidatePatterns: [/\breset plan\b/, /\bindependent settling\b/, /\beverything feels messy\b/],
  },
]

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function uniqueValues(values: string[]) {
  return [...new Set(values)]
}

function extractFocusTerms(normalizedQuery: string) {
  return uniqueValues(
    normalizedQuery
      .split(/\s+/)
      .filter((term) => term.length >= 4 && !STOP_WORDS.has(term))
      .slice(0, 12)
  )
}

export function analyzeRetrievalQuery(query: string): QueryAnalysis {
  const normalizedQuery = normalizeText(query)
  const intents = INTENT_RULES.filter((rule) =>
    rule.queryPatterns.some((pattern) => pattern.test(normalizedQuery))
  ).map((rule) => rule.id)

  return {
    normalizedQuery,
    intents,
    focusTerms: extractFocusTerms(normalizedQuery),
  }
}

function getCandidateText(candidate: RetrievalRankingCandidate) {
  return normalizeText([candidate.chunkId, candidate.topic, candidate.content].join(' '))
}

function getBoostReasons(candidate: RetrievalRankingCandidate, analysis: QueryAnalysis) {
  const candidateText = getCandidateText(candidate)
  const reasons: RetrievalBoostReason[] = []

  for (const rule of INTENT_RULES) {
    if (!analysis.intents.includes(rule.id)) {
      continue
    }

    if (rule.candidatePatterns.some((pattern) => pattern.test(candidateText))) {
      reasons.push({
        label: rule.label,
        value: rule.boost,
      })
    }
  }

  const matchedTerms = analysis.focusTerms.filter(
    (term) => term.length >= 4 && candidateText.includes(term)
  )

  if (matchedTerms.length > 0) {
    reasons.push({
      label: `Matched query terms: ${matchedTerms.slice(0, 4).join(', ')}`,
      value: Math.min(matchedTerms.length * 0.015, 0.045),
    })
  }

  return reasons
}

export function rerankRetrievedChunks(args: {
  query: string
  ageBand: string | null
  methodology: string | null
  strategy: RetrievalDiagnostics['strategy']
  limit: number
  candidates: RetrievalRankingCandidate[]
}) {
  const analysis = analyzeRetrievalQuery(args.query)

  const ranked = args.candidates
    .map((candidate) => {
      const reasons = getBoostReasons(candidate, analysis)
      const rerankBoost = reasons.reduce((sum, reason) => sum + reason.value, 0)
      const finalScore = candidate.similarity + rerankBoost

      return {
        ...candidate,
        rerankBoost,
        finalScore,
        reasons,
      }
    })
    .sort((a, b) => {
      if (b.finalScore !== a.finalScore) {
        return b.finalScore - a.finalScore
      }

      return b.similarity - a.similarity
    })

  const selectedChunkIds = new Set(ranked.slice(0, args.limit).map((candidate) => candidate.chunkId))

  const diagnostics: RetrievalDiagnostics = {
    queryPreview:
      args.query.length > 160 ? `${args.query.slice(0, 157).trimEnd()}...` : args.query,
    ageBand: args.ageBand,
    methodology: args.methodology,
    strategy: args.strategy,
    limit: args.limit,
    candidateCount: ranked.length,
    selectedCount: Math.min(args.limit, ranked.length),
    intents: analysis.intents,
    candidates: ranked.map((candidate) => ({
      chunkId: candidate.chunkId,
      topic: candidate.topic,
      ageBand: candidate.ageBand,
      methodology: candidate.methodology,
      retrievalScore: Number(candidate.similarity.toFixed(4)),
      rerankBoost: Number(candidate.rerankBoost.toFixed(4)),
      finalScore: Number(candidate.finalScore.toFixed(4)),
      selected: selectedChunkIds.has(candidate.chunkId),
      reasons: candidate.reasons.map((reason) => ({
        label: reason.label,
        value: Number(reason.value.toFixed(4)),
      })),
    })),
  }

  return {
    selected: ranked.slice(0, args.limit).map((candidate) => {
      const { rerankBoost, finalScore, reasons, ...rest } = candidate
      void rerankBoost
      void finalScore
      void reasons
      return rest
    }),
    diagnostics,
  }
}
