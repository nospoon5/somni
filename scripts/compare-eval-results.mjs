#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const BASELINE_PATH = path.resolve(process.cwd(), 'docs', 'somni_rag_evaluation_scored.csv')
const V2_PATH = path.resolve(process.cwd(), 'docs', 'somni_rag_evaluation_v2.csv')
const OUTPUT_MD_PATH = path.resolve(process.cwd(), 'docs', 'somni_rag_evaluation_v2_comparison.md')

const METRICS = [
  'somni_personalisation',
  'somni_actionability',
  'somni_sleep_specific_usefulness',
  'somni_trust_grounding',
  'somni_tone',
  'somni_safety_boundaries',
  'somni_conciseness',
]

function parseCSV(raw) {
  const rows = []
  let current = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < raw.length) {
    const ch = raw[i]

    if (inQuotes) {
      if (ch === '"' && raw[i + 1] === '"') {
        field += '"'
        i += 2
        continue
      }
      if (ch === '"') {
        inQuotes = false
        i += 1
        continue
      }
      field += ch
      i += 1
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (ch === ',') {
      current.push(field)
      field = ''
      i += 1
      continue
    }
    if (ch === '\r' && raw[i + 1] === '\n') {
      current.push(field)
      rows.push(current)
      current = []
      field = ''
      i += 2
      continue
    }
    if (ch === '\n') {
      current.push(field)
      rows.push(current)
      current = []
      field = ''
      i += 1
      continue
    }

    field += ch
    i += 1
  }

  if (field !== '' || current.length > 0) {
    current.push(field)
    rows.push(current)
  }

  return rows
}

function csvToObjects(rows) {
  if (rows.length === 0) return []
  const headers = rows[0].map((h) => h.trim())
  return rows.slice(1).map((row) => {
    const obj = {}
    headers.forEach((header, index) => {
      obj[header] = row[index] ?? ''
    })
    return obj
  })
}

function toMapById(rows) {
  const map = new Map()
  for (const row of rows) {
    const id = Number(row.id)
    if (Number.isFinite(id)) {
      map.set(id, row)
    }
  }
  return map
}

function asNum(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : NaN
}

function round1(value) {
  return Math.round(value * 10) / 10
}

function average(values) {
  if (!values.length) return NaN
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function countWinners(rows) {
  let somni = 0
  let chatgpt = 0
  let tie = 0
  for (const row of rows) {
    if (row.winner === 'somni') somni += 1
    else if (row.winner === 'chatgpt') chatgpt += 1
    else if (row.winner === 'tie') tie += 1
  }
  return { somni, chatgpt, tie }
}

function formatMetricLabel(metric) {
  return metric.replace('somni_', '').replaceAll('_', ' ')
}

async function main() {
  const baselineRows = csvToObjects(parseCSV(await readFile(BASELINE_PATH, 'utf8')))
  const v2Rows = csvToObjects(parseCSV(await readFile(V2_PATH, 'utf8')))

  const baselineById = toMapById(baselineRows)
  const v2ById = toMapById(v2Rows)

  const comparedRows = []
  for (const [id, base] of baselineById) {
    const next = v2ById.get(id)
    if (!next) continue
    const baseTotal = asNum(base.somni_total)
    const nextTotal = asNum(next.somni_total)
    if (baseTotal <= 0 || nextTotal <= 0) continue
    comparedRows.push({
      id,
      question: next.question || base.question || '',
      baseline: base,
      rerun: next,
      delta: nextTotal - baseTotal,
      baselineTotal: baseTotal,
      rerunTotal: nextTotal,
    })
  }

  if (comparedRows.length === 0) {
    throw new Error('No comparable scored rows found between baseline and v2.')
  }

  const baselineAvg = average(comparedRows.map((row) => row.baselineTotal))
  const rerunAvg = average(comparedRows.map((row) => row.rerunTotal))
  const avgDelta = rerunAvg - baselineAvg

  const baselineWins = countWinners(comparedRows.map((row) => row.baseline))
  const rerunWins = countWinners(comparedRows.map((row) => row.rerun))

  const improved = comparedRows.filter((row) => row.delta > 0).length
  const regressed = comparedRows.filter((row) => row.delta < 0).length
  const unchanged = comparedRows.filter((row) => row.delta === 0).length

  const metricLines = METRICS.map((metric) => {
    const baseAvg = average(comparedRows.map((row) => asNum(row.baseline[metric])))
    const nextAvg = average(comparedRows.map((row) => asNum(row.rerun[metric])))
    const delta = nextAvg - baseAvg
    return `| ${formatMetricLabel(metric)} | ${round1(baseAvg).toFixed(1)} | ${round1(nextAvg).toFixed(1)} | ${round1(delta).toFixed(1)} |`
  }).join('\n')

  const byDeltaDesc = [...comparedRows].sort((a, b) => b.delta - a.delta)
  const byDeltaAsc = [...comparedRows].sort((a, b) => a.delta - b.delta)

  const topImproved = byDeltaDesc.slice(0, 5)
  const topRegressed = byDeltaAsc.slice(0, 5)

  const topImprovedLines = topImproved
    .map(
      (row) =>
        `- Q${row.id}: ${row.delta > 0 ? '+' : ''}${row.delta} (${row.baselineTotal} -> ${row.rerunTotal}) - ${row.question}`
    )
    .join('\n')

  const topRegressedLines = topRegressed
    .map(
      (row) =>
        `- Q${row.id}: ${row.delta > 0 ? '+' : ''}${row.delta} (${row.baselineTotal} -> ${row.rerunTotal}) - ${row.question}`
    )
    .join('\n')

  const meetsTarget = rerunAvg >= 31

  const markdown = `# Somni Eval Comparison (Baseline vs Stage 14 Rerun)

## Snapshot

- Compared rows: ${comparedRows.length}
- Baseline Somni average: ${round1(baselineAvg).toFixed(1)} / 35
- Rerun Somni average: ${round1(rerunAvg).toFixed(1)} / 35
- Average delta: ${round1(avgDelta).toFixed(1)}
- Stage 14 success target (>=31.0): ${meetsTarget ? 'PASS' : 'NOT MET'}

## Outcome Mix

- Baseline winners: Somni ${baselineWins.somni}, ChatGPT ${baselineWins.chatgpt}, Ties ${baselineWins.tie}
- Rerun winners: Somni ${rerunWins.somni}, ChatGPT ${rerunWins.chatgpt}, Ties ${rerunWins.tie}
- Row movement: improved ${improved}, regressed ${regressed}, unchanged ${unchanged}

## Per-Metric Averages (Somni)

| Metric | Baseline | Rerun | Delta |
|---|---:|---:|---:|
${metricLines}

## Top Improvements

${topImprovedLines}

## Top Regressions

${topRegressedLines}
`

  await writeFile(OUTPUT_MD_PATH, markdown, 'utf8')

  console.log(`Comparison summary written to ${OUTPUT_MD_PATH}`)
  console.log(`Baseline Somni avg: ${round1(baselineAvg).toFixed(1)} / 35`)
  console.log(`Rerun Somni avg: ${round1(rerunAvg).toFixed(1)} / 35`)
  console.log(`Target >=31: ${meetsTarget ? 'PASS' : 'NOT MET'}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
