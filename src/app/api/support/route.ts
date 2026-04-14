import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type SupportCategory = 'bug' | 'feedback' | 'billing' | 'other'

type SupportRequestBody = {
  category?: unknown
  message?: unknown
  originPage?: unknown
  supportPage?: unknown
  pageUrl?: unknown
  userAgent?: unknown
}

function isCategory(value: unknown): value is SupportCategory {
  return value === 'bug' || value === 'feedback' || value === 'billing' || value === 'other'
}

function clampText(value: unknown, limit: number) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, limit)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
  }

  const rawBody = (await request.json().catch(() => null)) as SupportRequestBody | null
  const categoryRaw = rawBody?.category
  const message = clampText(rawBody?.message, 2000)
  const originPage = clampText(rawBody?.originPage ?? rawBody?.pageUrl, 300)
  const supportPage = clampText(rawBody?.supportPage, 300)
  const userAgent = clampText(rawBody?.userAgent, 300)

  if (!isCategory(categoryRaw)) {
    return NextResponse.json({ error: 'Invalid support request type.' }, { status: 400 })
  }

  if (message.length < 10) {
    return NextResponse.json(
      { error: 'Please add a little more detail before sending.' },
      { status: 400 }
    )
  }

  const id = crypto.randomUUID()

  // Stage D beta-readiness: keep this lightweight and reliable.
  // We log to runtime logs (searchable in Vercel) instead of introducing a new DB table
  // or email provider dependency during the recovery phase.
  console.log(
    'SUPPORT_REQUEST',
    JSON.stringify({
      id,
      profile_id: user.id,
      email: user.email ?? null,
      category: categoryRaw,
      message,
      origin_page: originPage || null,
      support_page: supportPage || null,
      // Kept for log query compatibility with older filters.
      page_url: originPage || null,
      user_agent: userAgent || null,
      created_at: new Date().toISOString(),
    })
  )

  return NextResponse.json({ id })
}
