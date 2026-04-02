'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type SleepActionState = {
  error?: string
  success?: string
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function isNightTime(date: Date) {
  const hour = date.getHours()
  return hour >= 19 || hour < 6
}

async function getCurrentUserBabyId() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.onboarding_completed) {
    redirect('/onboarding')
  }

  const { data: baby } = await supabase
    .from('babies')
    .select('id')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!baby) {
    redirect('/onboarding')
  }

  return { supabase, babyId: baby.id }
}

export async function startSleepAction(): Promise<SleepActionState> {
  const { supabase, babyId } = await getCurrentUserBabyId()

  const { data: activeLog } = await supabase
    .from('sleep_logs')
    .select('id')
    .eq('baby_id', babyId)
    .is('ended_at', null)
    .maybeSingle()

  if (activeLog) {
    return { error: 'A sleep session is already running.' }
  }

  const now = new Date()

  const { error } = await supabase.from('sleep_logs').insert({
    baby_id: babyId,
    started_at: now.toISOString(),
    is_night: isNightTime(now),
  })

  if (error) {
    return { error: error.message ?? 'We could not start sleep logging.' }
  }

  return { success: 'Sleep tracking has started.' }
}

export async function endSleepAction(
  _previousState: SleepActionState,
  formData: FormData
): Promise<SleepActionState> {
  const { supabase, babyId } = await getCurrentUserBabyId()
  const activeLogId = getString(formData, 'activeLogId')
  const notes = getString(formData, 'notes')
  const tags = formData
    .getAll('tags')
    .filter((value): value is string => typeof value === 'string')

  if (!activeLogId) {
    return { error: 'We could not find the active sleep session.' }
  }

  const now = new Date()

  const { error } = await supabase
    .from('sleep_logs')
    .update({
      ended_at: now.toISOString(),
      notes: notes || null,
      tags,
    })
    .eq('id', activeLogId)
    .eq('baby_id', babyId)
    .is('ended_at', null)

  if (error) {
    return { error: error.message ?? 'We could not end this sleep session.' }
  }

  return { success: 'Sleep session saved.' }
}
