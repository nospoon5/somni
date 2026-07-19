import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type SubscriptionRequestBody = {
  endpoint?: unknown
  keys?: {
    p256dh?: unknown
    auth?: unknown
  }
}

const MAX_ENDPOINT_LENGTH = 2_048
const MAX_KEY_LENGTH = 512
const PUSH_KEY_PATTERN = /^[A-Za-z0-9+/_-]+={0,2}$/

function readPushKey(value: unknown) {
  if (typeof value !== 'string') return null

  const key = value.trim()
  if (key.length < 16 || key.length > MAX_KEY_LENGTH || !PUSH_KEY_PATTERN.test(key)) {
    return null
  }

  return key
}

function readEndpoint(value: unknown) {
  if (typeof value !== 'string') return null

  const endpoint = value.trim()
  if (!endpoint || endpoint.length > MAX_ENDPOINT_LENGTH) return null

  try {
    const url = new URL(endpoint)
    return url.protocol === 'https:' ? endpoint : null
  } catch {
    return null
  }
}

async function getAuthenticatedClient() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { supabase, user }
}

export async function POST(request: Request) {
  const { supabase, user } = await getAuthenticatedClient()
  if (!user) {
    return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
  }

  const rawBody = (await request.json().catch(() => null)) as SubscriptionRequestBody | null
  const endpoint = readEndpoint(rawBody?.endpoint)
  const p256dh = readPushKey(rawBody?.keys?.p256dh)
  const auth = readPushKey(rawBody?.keys?.auth)

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Invalid push subscription.' }, { status: 400 })
  }

  // The RLS policy requires profile_id to be the signed-in user. Including it
  // in the conflict update keeps the subscription current without allowing a
  // signed-in user to take over another profile's endpoint.
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      profile_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: request.headers.get('user-agent')?.slice(0, 500) ?? undefined,
    },
    { onConflict: 'endpoint' }
  )

  if (error) {
    console.error('Failed to save push subscription:', error)
    return NextResponse.json({ error: 'Could not save this browser for alerts.' }, { status: 500 })
  }

  return NextResponse.json({ subscribed: true })
}

export async function DELETE(request: Request) {
  const { supabase, user } = await getAuthenticatedClient()
  if (!user) {
    return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
  }

  const rawBody = (await request.json().catch(() => null)) as SubscriptionRequestBody | null
  const endpoint = readEndpoint(rawBody?.endpoint)

  if (!endpoint) {
    return NextResponse.json({ error: 'Invalid push subscription.' }, { status: 400 })
  }

  // Keep the explicit profile filter as defence in depth alongside the RLS
  // delete policy, so a browser can only remove its signed-in user's row.
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('profile_id', user.id)
    .eq('endpoint', endpoint)

  if (error) {
    console.error('Failed to remove push subscription:', error)
    return NextResponse.json({ error: 'Could not remove this browser from alerts.' }, { status: 500 })
  }

  return NextResponse.json({ unsubscribed: true })
}
