import { runAiMemoryBackfill } from '@/lib/ai/memory-backfill'

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return false
  }

  const authHeader = request.headers.get('authorization') ?? ''
  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runAiMemoryBackfill()
    return Response.json({
      ok: true,
      ...result,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Memory backfill failed unexpectedly'

    console.error('[memory-backfill] route failed', error)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
