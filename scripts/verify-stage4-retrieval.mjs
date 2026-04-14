#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001'
const EMBEDDING_DIMENSION = 768
const MIN_SIMILARITY = 0.3
const MATCH_LIMIT = 5
const INTERNAL_MATCH_LIMIT = 12
const WEAKNESS_CASES_PATH = path.resolve(
  process.cwd(),
  'scripts',
  'eval_data',
  'retrieval_weakness_cases.json'
)

const INTENT_RULES = [
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

async function loadDotEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  const content = await readFile(envPath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    const [, key, value] = match
    if (!process.env[key]) {
      process.env[key] = value.replace(/^["']|["']$/g, '')
    }
  }
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

function parseVector(value) {
  if (typeof value !== 'string' || !value.startsWith('[') || !value.endsWith(']')) {
    return []
  }
  return value
    .slice(1, -1)
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((num) => Number.isFinite(num))
}

function dot(a, b) {
  let sum = 0
  for (let i = 0; i < a.length; i += 1) {
    sum += a[i] * b[i]
  }
  return sum
}

function cosine(a, b) {
  if (a.length !== b.length || a.length === 0) return 0
  const denom = Math.sqrt(dot(a, a) * dot(b, b))
  if (!denom) return 0
  return dot(a, b) / denom
}

function scoreChunk(baseSimilarity, row, ageBand, methodology) {
  const ageBoost =
    ageBand && row.age_band && row.age_band.toLowerCase() === ageBand.toLowerCase() ? 0.08 : 0
  const methodologyBoost =
    methodology && row.methodology.toLowerCase() === methodology
      ? 0.06
      : methodology && row.methodology.toLowerCase() === 'all'
        ? 0.03
        : 0
  const topic = row.topic.toLowerCase()
  const safetyBoost =
    topic.includes('safe sleep') || topic.includes('safe sleeping') ? 0.05 : 0
  return baseSimilarity + ageBoost + methodologyBoost + safetyBoost
}

function normalizeText(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function uniqueValues(values) {
  return [...new Set(values)]
}

function analyzeQuery(query) {
  const normalizedQuery = normalizeText(query)
  const intents = INTENT_RULES.filter((rule) =>
    rule.queryPatterns.some((pattern) => pattern.test(normalizedQuery))
  ).map((rule) => rule.id)

  const focusTerms = uniqueValues(
    normalizedQuery
      .split(/\s+/)
      .filter((term) => term.length >= 4 && !STOP_WORDS.has(term))
      .slice(0, 12)
  )

  return {
    intents,
    focusTerms,
  }
}

function getCandidateText(candidate) {
  return normalizeText([candidate.chunk_id, candidate.topic, candidate.content ?? ''].join(' '))
}

function rerankRows(rows, scenario) {
  const analysis = analyzeQuery(scenario.query)

  return rows
    .map((row) => {
      const candidateText = getCandidateText(row)
      const reasons = []

      for (const rule of INTENT_RULES) {
        if (!analysis.intents.includes(rule.id)) {
          continue
        }
        if (rule.candidatePatterns.some((pattern) => pattern.test(candidateText))) {
          reasons.push({ label: rule.label, value: rule.boost })
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

      const rerankBoost = reasons.reduce((sum, reason) => sum + reason.value, 0)
      return {
        ...row,
        rerankBoost,
        finalScore: row.similarity + rerankBoost,
        reasons,
      }
    })
    .sort((a, b) => {
      if (b.finalScore !== a.finalScore) {
        return b.finalScore - a.finalScore
      }
      return b.similarity - a.similarity
    })
}

async function embedQuery(query, apiKey) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text: query }] },
        outputDimensionality: EMBEDDING_DIMENSION,
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Embedding call failed (${response.status}): ${await response.text()}`)
  }

  const payload = await response.json()
  const values = payload?.embedding?.values
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSION) {
    throw new Error('Embedding output had unexpected dimensions')
  }
  return values
}

async function loadWeaknessCases() {
  const raw = await readFile(WEAKNESS_CASES_PATH, 'utf8')
  const scenarios = JSON.parse(raw)
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    throw new Error('retrieval_weakness_cases.json is empty or invalid')
  }
  return scenarios
}

function printRow(row, index) {
  const reasonText =
    row.reasons.length > 0 ? ` | reasons=${row.reasons.map((reason) => reason.label).join('; ')}` : ''
  console.log(
    `${index + 1}. ${row.chunk_id} | ${row.topic} | retrieval=${row.similarity.toFixed(4)} | final=${row.finalScore.toFixed(4)}${reasonText}`
  )
}

async function main() {
  await loadDotEnvLocal()
  const supabase = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  )
  const apiKey = requireEnv('GEMINI_API_KEY')
  const scenarios = await loadWeaknessCases()

  let failures = 0
  let improved = 0
  let regressed = 0
  let unchanged = 0

  for (const scenario of scenarios) {
    const queryEmbedding = await embedQuery(scenario.query, apiKey)

    const { data: rpcRows, error: rpcError } = await supabase.rpc('match_corpus_chunks', {
      query_embedding: `[${queryEmbedding.join(',')}]`,
      match_count: INTERNAL_MATCH_LIMIT,
      preferred_age_band: scenario.ageBand,
      preferred_methodology: scenario.methodology,
    })

    let rows = rpcRows ?? []
    let mode = 'rpc'

    const rpcMissing =
      rpcError &&
      rpcError.message.includes('match_corpus_chunks') &&
      (rpcError.message.includes('does not exist') || rpcError.message.includes('Could not find'))

    if (rpcMissing) {
      mode = 'fallback'
      const { data: allRows, error: allError } = await supabase
        .from('corpus_chunks')
        .select('chunk_id, topic, age_band, methodology, content, embedding')

      if (allError) {
        throw new Error(allError.message)
      }

      rows = (allRows ?? [])
        .map((row) => {
          const similarity = scoreChunk(
            cosine(queryEmbedding, parseVector(row.embedding)),
            row,
            scenario.ageBand,
            scenario.methodology
          )
          return { ...row, similarity }
        })
        .filter((row) => row.similarity >= MIN_SIMILARITY)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, INTERNAL_MATCH_LIMIT)
    } else if (rpcError) {
      throw new Error(rpcError.message)
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error(`No retrieval rows returned for: ${scenario.label}`)
    }

    const legacyTop = rows.slice(0, MATCH_LIMIT)
    const reranked = rerankRows(rows, scenario).slice(0, MATCH_LIMIT)
    const legacyIndex = legacyTop.findIndex((row) => scenario.expectTopIds.includes(row.chunk_id))
    const matchedIndex = reranked.findIndex((row) => scenario.expectTopIds.includes(row.chunk_id))
    const passed = matchedIndex !== -1 && matchedIndex < Number(scenario.maxRank ?? 1)

    if (legacyIndex === matchedIndex) {
      unchanged += 1
    } else if (legacyIndex === -1 || (matchedIndex !== -1 && matchedIndex < legacyIndex)) {
      improved += 1
    } else {
      regressed += 1
    }

    if (!passed) {
      failures += 1
    }

    console.log(`\n=== ${scenario.label} (${mode}) | ${passed ? 'PASS' : 'FAIL'} ===`)
    reranked.forEach((row, index) => printRow(row, index))
    console.log(
      `Legacy rank: ${legacyIndex === -1 ? 'not in top 5' : legacyIndex + 1} | Hardened rank: ${
        matchedIndex === -1 ? 'not in top 5' : matchedIndex + 1
      }`
    )

    if (matchedIndex !== -1) {
      console.log(
        `Expected chunk matched at rank ${matchedIndex + 1} (target: top ${scenario.maxRank})`
      )
    } else {
      console.log(`Expected chunk IDs not found: ${scenario.expectTopIds.join(', ')}`)
    }
  }

  if (failures > 0) {
    console.error(`\nRetrieval weakness verification failed for ${failures} scenario(s).`)
    process.exit(1)
  }

  console.log(
    `\nWeakness-set comparison: improved ${improved}, regressed ${regressed}, unchanged ${unchanged}`
  )

  if (improved <= regressed) {
    console.error('Net improvement was not achieved on the weakness set.')
    process.exit(1)
  }

  console.log('\nRetrieval weakness verification passed.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
