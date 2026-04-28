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
  | 'safe_sleep_surface'
  | 'rolling_swaddle'
  | 'sleep_object_safety'
  | 'medication_supplement'
  | 'fever_lethargy'
  | 'formula_reflux'
  | 'mental_health_crisis'

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
  forceInclude?: boolean
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
  {
    id: 'safe_sleep_surface',
    label: 'Matched safe sleep surface guidance',
    boost: 0.28,
    forceInclude: true,
    queryPatterns: [
      /\bbouncer\b/,
      /\bswing\b/,
      /\bcar seat\b/,
      /\bchest\b/,
      /\binclin(?:e|ed)\b/,
      /\belevat(?:e|ed|ing)\b/,
      /\bcouch\b/,
      /\bsofa\b/,
      /\bco[\s-]?sleep\b/,
      /\bbed\b/,
    ],
    candidatePatterns: [
      /\bsafe sleep(?:ing)?\b/,
      /\bfirm flat\b/,
      /\bflat surface\b/,
      /\bsuffocation\b/,
      /\bsids\b/,
      /\bbouncer\b/,
      /\bcar seat\b/,
      /\bswing\b/,
      /\binclin(?:e|ed)\b/,
      /\bchest\b/,
      /\bcouch\b/,
      /\bsofa\b/,
    ],
  },
  {
    id: 'rolling_swaddle',
    label: 'Matched rolling and swaddle safety guidance',
    boost: 0.3,
    forceInclude: true,
    queryPatterns: [/\bswaddl\w*\b.*\broll\w*\b/, /\broll\w*\b.*\bswaddl\w*\b/, /\btransition(?:ing)? sleeping bag\b/],
    candidatePatterns: [
      /\bswaddl\w*\b.*\broll\w*\b/,
      /\broll\w*\b.*\bswaddl\w*\b/,
      /\bno longer safe\b/,
      /\barms free\b/,
      /\bsafe sleep(?:ing)?\b/,
    ],
  },
  {
    id: 'sleep_object_safety',
    label: 'Matched safe sleep object guidance',
    boost: 0.26,
    forceInclude: true,
    queryPatterns: [/\bstuffed animal\b/, /\bsoft toy\b/, /\bcomforter\b/, /\blovey\b/, /\bpillow\b/, /\bblanket\b/],
    candidatePatterns: [
      /\bsafe sleep(?:ing)?\b/,
      /\bsoft objects?\b/,
      /\bstuffed animal\b/,
      /\bsoft toy\b/,
      /\bcomforter\b/,
      /\bpillow\b/,
      /\bblanket\b/,
      /\bcot clear\b/,
    ],
  },
  {
    id: 'medication_supplement',
    label: 'Matched medication or supplement boundary guidance',
    boost: 0.3,
    forceInclude: true,
    queryPatterns: [/\bpanadol\b/, /\bparacetamol\b/, /\bmelatonin\b/, /\bsupplement\b/, /\bgumm(?:y|ies)\b/, /\bpain relief\b/],
    candidatePatterns: [
      /\bteething\b/,
      /\billness\b/,
      /\bmedication\b/,
      /\bsupplement\b/,
      /\bmelatonin\b/,
      /\bpanadol\b/,
      /\bparacetamol\b/,
      /\bgp\b/,
      /\bchild health nurse\b/,
    ],
  },
  {
    id: 'fever_lethargy',
    label: 'Matched urgent fever or lethargy guidance',
    boost: 0.34,
    forceInclude: true,
    queryPatterns: [/\bfever\b/, /\b39(?:\.\d+)?\b/, /\blethargic\b/, /\bfloppy\b/, /\bpassing out\b/, /\bpassed out\b/],
    candidatePatterns: [
      /\bfever\b/,
      /\blethargic\b/,
      /\bfloppy\b/,
      /\burgent\b/,
      /\bemergency\b/,
      /\bmedical\b/,
      /\billness\b/,
      /\bgp\b/,
      /\bhealthdirect\b/,
    ],
  },
  {
    id: 'formula_reflux',
    label: 'Matched reflux or formula boundary guidance',
    boost: 0.28,
    forceInclude: true,
    queryPatterns: [/\breflux\b/, /\bhypoallergenic\b/, /\bformula brand\b/, /\bspecific formula\b/, /\bformula\b.*\bsleep\b/],
    candidatePatterns: [
      /\breflux\b/,
      /\bformula\b/,
      /\bhypoallergenic\b/,
      /\ballerg(?:y|ies|ic)\b/,
      /\bmedical\b/,
      /\bgp\b/,
      /\bchild health nurse\b/,
    ],
  },
  {
    id: 'mental_health_crisis',
    label: 'Matched parental mental health crisis guidance',
    boost: 0.42,
    forceInclude: true,
    queryPatterns: [/\bpostpartum depression\b/, /\bshak(?:e|ing)\b/, /\bcan t do this anymore\b/, /\bcan't do this anymore\b/, /\bharm\b/],
    candidatePatterns: [
      /\bpostpartum mental health\b/,
      /\bparental crisis\b/,
      /\bpanda\b/,
      /\blifeline\b/,
      /\b000\b/,
      /\bshak(?:e|ing)\b/,
      /\bharm\b/,
    ],
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

  const selected = selectRankedCandidates(ranked, analysis.intents, args.limit)
  const selectedChunkIds = new Set(selected.map((candidate) => candidate.chunkId))

  const diagnostics: RetrievalDiagnostics = {
    queryPreview:
      args.query.length > 160 ? `${args.query.slice(0, 157).trimEnd()}...` : args.query,
    ageBand: args.ageBand,
    methodology: args.methodology,
    strategy: args.strategy,
    limit: args.limit,
    candidateCount: ranked.length,
    selectedCount: selected.length,
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
    selected: selected.map((candidate) => {
      const { rerankBoost, finalScore, reasons, ...rest } = candidate
      void rerankBoost
      void finalScore
      void reasons
      return rest
    }),
    diagnostics,
  }
}

function selectRankedCandidates<
  Candidate extends RetrievalRankingCandidate & {
    finalScore: number
    reasons: RetrievalBoostReason[]
  },
>(ranked: Candidate[], intents: RetrievalIntentSignal[], limit: number) {
  const selected: Candidate[] = []
  const selectedIds = new Set<string>()
  const forceRules = INTENT_RULES.filter(
    (rule) => rule.forceInclude && intents.includes(rule.id)
  )

  for (const rule of forceRules) {
    const forcedCandidate = ranked
      .filter(
        (candidate) =>
          !selectedIds.has(candidate.chunkId) &&
          candidate.reasons.some((reason) => reason.label === rule.label)
      )
      .sort((a, b) => {
        const priorityDiff = getForcedCandidatePriority(rule.id, b) - getForcedCandidatePriority(rule.id, a)
        if (priorityDiff !== 0) {
          return priorityDiff
        }
        return b.finalScore - a.finalScore
      })[0]

    if (!forcedCandidate) {
      continue
    }

    selected.push(forcedCandidate)
    selectedIds.add(forcedCandidate.chunkId)
  }

  for (const candidate of ranked) {
    if (selected.length >= limit) {
      break
    }

    if (selectedIds.has(candidate.chunkId)) {
      continue
    }

    selected.push(candidate)
    selectedIds.add(candidate.chunkId)
  }

  return selected
}

function getForcedCandidatePriority(
  intent: RetrievalIntentSignal,
  candidate: RetrievalRankingCandidate
) {
  const text = normalizeText([candidate.chunkId, candidate.topic, candidate.content].join(' '))

  switch (intent) {
    case 'safe_sleep_surface':
      if (/\ball ages safe sleep(?:ing)?\b/.test(text) || /\bsafe sleep(?:ing)?\b/.test(normalizeText(candidate.topic))) {
        return 50
      }
      if (/\bbouncer\b|\bsuffocation\b|\bfirm flat\b|\bflat surface\b|\bsids\b/.test(text)) {
        return 40
      }
      return 0
    case 'rolling_swaddle':
      if (/\bswaddl\w*\b.*\broll\w*\b|\broll\w*\b.*\bswaddl\w*\b/.test(text)) {
        return 50
      }
      if (/\bno longer safe\b|\barms free\b/.test(text)) {
        return 40
      }
      return 0
    case 'sleep_object_safety':
      if (/\bsafe sleep(?:ing)?\b|\bsoft objects?\b|\bcot clear\b/.test(text)) {
        return 50
      }
      return 0
    case 'medication_supplement':
      if (/\bmedication\b|\bsupplement\b|\bmelatonin\b|\bpanadol\b|\bparacetamol\b/.test(text)) {
        return 50
      }
      if (/\bgp\b|\bchild health nurse\b/.test(text)) {
        return 40
      }
      return 0
    case 'fever_lethargy':
      if (/\bfever\b|\blethargic\b|\burgent\b|\bemergency\b|\bmedical\b/.test(text)) {
        return 50
      }
      return 0
    case 'formula_reflux':
      if (/\breflux\b|\bhypoallergenic\b|\bformula\b|\ballerg/.test(text)) {
        return 50
      }
      if (/\bgp\b|\bchild health nurse\b|\bmedical\b/.test(text)) {
        return 40
      }
      return 0
    case 'mental_health_crisis':
      if (/\bpostpartum mental health\b|\bparental crisis\b|\bpanda\b|\blifeline\b|\b000\b/.test(text)) {
        return 50
      }
      return 0
    default:
      return 0
  }
}
