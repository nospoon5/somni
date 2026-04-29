import 'server-only'

type TimingMetadata = Record<string, string | number | boolean | null | undefined>

function secondsFromMs(value: number) {
  return Number((value / 1000).toFixed(3))
}

function roundSeconds(value: number) {
  return Number(value.toFixed(3))
}

function nowMs() {
  return performance.now()
}

export function createLatencyTimer() {
  const startedAt = nowMs()
  const requestStartedAt = new Date().toISOString()
  const activeStages = new Map<string, number>()
  const stageSeconds: Record<string, number> = {}
  const marksSeconds: Record<string, number> = {
    request_start: 0,
  }
  const metadata: TimingMetadata = {}

  function addStageSeconds(stageName: string, seconds: number) {
    stageSeconds[stageName] = roundSeconds((stageSeconds[stageName] ?? 0) + seconds)
  }

  return {
    start(stageName: string) {
      activeStages.set(stageName, nowMs())
    },

    end(stageName: string) {
      const started = activeStages.get(stageName)
      if (started === undefined) {
        return
      }

      activeStages.delete(stageName)
      addStageSeconds(stageName, secondsFromMs(nowMs() - started))
    },

    add(stageName: string, seconds: number | undefined | null) {
      if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
        return
      }

      addStageSeconds(stageName, seconds)
    },

    mark(markName: string) {
      marksSeconds[markName] = secondsFromMs(nowMs() - startedAt)
    },

    setMetadata(values: TimingMetadata) {
      for (const [key, value] of Object.entries(values)) {
        if (value !== undefined) {
          metadata[key] = value
        }
      }
    },

    async time<T>(stageName: string, work: () => Promise<T>): Promise<T> {
      const started = nowMs()
      try {
        return await work()
      } finally {
        addStageSeconds(stageName, secondsFromMs(nowMs() - started))
      }
    },

    timeSync<T>(stageName: string, work: () => T): T {
      const started = nowMs()
      try {
        return work()
      } finally {
        addStageSeconds(stageName, secondsFromMs(nowMs() - started))
      }
    },

    snapshot(extraMetadata: TimingMetadata = {}) {
      const totalLatencySeconds = secondsFromMs(nowMs() - startedAt)
      return {
        version: 1,
        request_started_at: requestStartedAt,
        total_latency_seconds: totalLatencySeconds,
        stage_seconds: { ...stageSeconds },
        marks_seconds: { ...marksSeconds },
        ...metadata,
        ...extraMetadata,
      }
    },
  }
}
