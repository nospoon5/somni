import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { performance } from 'node:perf_hooks'

const APP_URL = new URL(process.env.SOMNI_APP_URL || 'http://127.0.0.1:3000')
const DURATION_SECONDS = readBoundedInteger('SOMNI_BENCHMARK_DURATION_SECONDS', 10, 1, 60)
const CONNECTIONS = readBoundedInteger('SOMNI_BENCHMARK_CONNECTIONS', 10, 1, 50)
const REQUEST_TIMEOUT_MS = readBoundedInteger(
  'SOMNI_BENCHMARK_REQUEST_TIMEOUT_MS',
  10_000,
  500,
  30_000,
)

function readBoundedInteger(name, fallback, minimum, maximum) {
  const raw = process.env[name]
  const value = raw === undefined ? fallback : Number.parseInt(raw, 10)
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be a whole number between ${minimum} and ${maximum}`)
  }
  return value
}

function assertSafeTarget() {
  const isLocal = APP_URL.hostname === 'localhost' || APP_URL.hostname === '127.0.0.1'
  if (!isLocal && process.env.SOMNI_BENCHMARK_ALLOW_REMOTE !== '1') {
    throw new Error(
      'Remote load testing is disabled. Set SOMNI_BENCHMARK_ALLOW_REMOTE=1 only for an authorised non-production target.',
    )
  }

  if (!['http:', 'https:'].includes(APP_URL.protocol)) {
    throw new Error('SOMNI_APP_URL must use http or https')
  }
}

function percentile(values, quantile) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)]
}

async function runBenchmark({ name, pathname, method = 'GET', body }) {
  const target = new URL(pathname, APP_URL)
  const deadline = performance.now() + DURATION_SECONDS * 1_000
  const latencies = []
  const statuses = new Map()
  let errors = 0
  let completed = 0

  async function worker() {
    while (performance.now() < deadline) {
      const startedAt = performance.now()
      try {
        const response = await fetch(target, {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
          redirect: 'manual',
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
        await response.arrayBuffer()
        statuses.set(response.status, (statuses.get(response.status) || 0) + 1)
      } catch {
        errors += 1
      } finally {
        completed += 1
        latencies.push(performance.now() - startedAt)
      }
    }
  }

  const runStartedAt = performance.now()
  await Promise.all(Array.from({ length: CONNECTIONS }, () => worker()))
  const elapsedSeconds = (performance.now() - runStartedAt) / 1_000

  return {
    name,
    method,
    url: target.toString(),
    connections: CONNECTIONS,
    durationSeconds: Number(elapsedSeconds.toFixed(3)),
    completedRequests: completed,
    requestsPerSecond: Number((completed / elapsedSeconds).toFixed(2)),
    latencyMsAverage: Number(
      (latencies.reduce((sum, value) => sum + value, 0) / Math.max(latencies.length, 1)).toFixed(2),
    ),
    latencyMsP99: percentile(latencies, 0.99),
    statuses: Object.fromEntries([...statuses.entries()].sort(([a], [b]) => a - b)),
    errors,
  }
}

async function main() {
  assertSafeTarget()

  const results = [
    await runBenchmark({ name: 'Landing page', pathname: '/' }),
    await runBenchmark({
      name: 'Unauthorised chat rejection',
      pathname: '/api/chat',
      method: 'POST',
      body: { message: 'Stage 7 benchmark request' },
    }),
  ]

  const report = {
    timestamp: new Date().toISOString(),
    target: APP_URL.toString(),
    nodeVersion: process.version,
    requestTimeoutMs: REQUEST_TIMEOUT_MS,
    results,
  }
  const reportPath = path.join(process.cwd(), 'docs', 'benchmark_report.json')
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)

  for (const result of results) {
    console.log(
      `${result.name}: ${result.requestsPerSecond} req/s, p99 ${result.latencyMsP99?.toFixed(2) ?? 'n/a'} ms, errors ${result.errors}`,
    )
  }
  console.log(`Evidence written to ${reportPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
