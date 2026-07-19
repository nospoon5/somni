import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { createSupportTicket, getRecentTicketCount } from '@/lib/repositories/support'
import { createRequestLogger } from '@/lib/observability/logger'

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
  const reqLogger = createRequestLogger({ endpoint: '/api/support' })
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

  // Rate Limiting Logic: Max 5 tickets per hour
  // Normal users deliberately cannot SELECT support tickets, so the count runs through the
  // server-only admin client after the authenticated profile id has been established above.
  const { count, error: countError } = await getRecentTicketCount(
    createAdminClient(),
    user.id,
    1,
  )
  if (countError) {
    reqLogger.error(
      'Failed to get recent ticket count',
      { userId: user.id },
      countError,
      true,
    )
    return NextResponse.json(
      { error: 'Unable to verify support request limits right now. Please try again shortly.' },
      { status: 503 },
    )
  } else if (count !== null && count >= 5) {
    reqLogger.warn('Support rate limit exceeded', { userId: user.id })
    return NextResponse.json(
      { error: 'You have reached the maximum number of support requests for now. Please try again later.' },
      { status: 429 }
    )
  }

  // Stage 5 beta-readiness: Store in DB for easy manual querying.
  const { error } = await createSupportTicket(supabase, {
    profile_id: user.id,
    email: user.email ?? undefined,
    category: categoryRaw,
    message,
    origin_page: originPage || undefined,
    support_page: supportPage || undefined,
    user_agent: userAgent || undefined,
  })

  if (error) {
    reqLogger.error(
      'Failed to insert support ticket',
      { userId: user.id, category: categoryRaw },
      error,
      true,
    )
    return NextResponse.json({ error: 'Failed to submit support request. Please try again.' }, { status: 500 })
  }

  reqLogger.info('Support ticket created', { userId: user.id, category: categoryRaw })
  return NextResponse.json({ success: true })
}
