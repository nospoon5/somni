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

  // Stage 5 beta-readiness: Store in DB for easy manual querying.
  const { data, error } = await supabase.from('support_tickets').insert({
    profile_id: user.id,
    email: user.email ?? null,
    category: categoryRaw,
    message,
    origin_page: originPage || null,
    support_page: supportPage || null,
    user_agent: userAgent || null,
  }).select('id').single()

  if (error || !data) {
    console.error('Failed to insert support ticket:', error)
    return NextResponse.json({ error: 'Failed to submit support request. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id })
}
