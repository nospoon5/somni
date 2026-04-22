'use server'

import { redirect } from 'next/navigation'
import {
  ensureSleepPlanProfile,
} from '@/lib/sleep-plan-profile-init'
import { createClient } from '@/lib/supabase/server'
import {
  getSleepStyleLabel,
  normalizeDayStructure,
  normalizeNapPattern,
  normalizeSchedulePreference,
  parseNightFeeds,
} from '@/lib/onboarding-preferences'
import { normalizeSleepPlanClockTime } from '@/lib/sleep-plan-profile'

export type OnboardingState = {
  error?: string
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function getQuestionScore(formData: FormData, key: string) {
  const raw = getString(formData, key)
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : NaN
}

export async function completeOnboardingAction(
  _previousState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const babyName = getString(formData, 'babyName')
  const dateOfBirth = getString(formData, 'dateOfBirth')
  const biggestIssue = getString(formData, 'biggestIssue')
  const feedingType = getString(formData, 'feedingType')
  const bedtimeRange = getString(formData, 'bedtimeRange')
  const typicalWakeTime = normalizeSleepPlanClockTime(getString(formData, 'typicalWakeTime'))
  const dayStructure = normalizeDayStructure(getString(formData, 'dayStructure'))
  const napPattern = normalizeNapPattern(getString(formData, 'napPattern'))
  const nightFeeds = parseNightFeeds(getString(formData, 'nightFeeds'))
  const schedulePreference = normalizeSchedulePreference(getString(formData, 'schedulePreference'))

  const questionScores = [
    getQuestionScore(formData, 'question1'),
    getQuestionScore(formData, 'question2'),
    getQuestionScore(formData, 'question3'),
    getQuestionScore(formData, 'question4'),
    getQuestionScore(formData, 'question5'),
  ]

  if (
    !babyName ||
    !dateOfBirth ||
    !biggestIssue ||
    !feedingType ||
    !bedtimeRange ||
    !typicalWakeTime ||
    !dayStructure ||
    !napPattern ||
    nightFeeds === null ||
    !schedulePreference
  ) {
    return { error: 'Please complete every onboarding step before continuing.' }
  }

  if (questionScores.some((score) => Number.isNaN(score) || score < 1 || score > 10)) {
    return { error: 'Each sleep style question needs a score between 1 and 10.' }
  }

  const sleepStyleScore =
    Math.round(
      (questionScores.reduce((total, score) => total + score, 0) / questionScores.length) * 10
    ) / 10
  const sleepStyleLabel = getSleepStyleLabel(sleepStyleScore)

  const { data: baby, error: babyError } = await supabase
    .from('babies')
    .insert({
      profile_id: user.id,
      name: babyName,
      date_of_birth: dateOfBirth,
      biggest_issue: biggestIssue,
      feeding_type: feedingType,
      bedtime_range: bedtimeRange,
    })
    .select('id')
    .single()

  if (babyError || !baby) {
    return { error: babyError?.message ?? 'We could not save your baby details.' }
  }

  const { error: preferencesError } = await supabase.from('onboarding_preferences').insert({
    baby_id: baby.id,
    question_1_score: questionScores[0],
    question_2_score: questionScores[1],
    question_3_score: questionScores[2],
    question_4_score: questionScores[3],
    question_5_score: questionScores[4],
    sleep_style_score: sleepStyleScore,
    sleep_style_label: sleepStyleLabel,
    typical_wake_time: typicalWakeTime,
    day_structure: dayStructure,
    nap_pattern: napPattern,
    night_feeds: nightFeeds,
    schedule_preference: schedulePreference,
  })

  if (preferencesError) {
    return {
      error: preferencesError.message ?? 'We could not save the sleep style answers.',
    }
  }

  try {
    await ensureSleepPlanProfile({
      supabase,
      source: 'onboarding',
      id: baby.id,
      name: babyName,
      dateOfBirth,
      sleepStyleLabel,
      typicalWakeTime,
      dayStructure,
      napPattern,
      nightFeeds,
      schedulePreference,
    })
  } catch (profileBootstrapError) {
    return {
      error:
        profileBootstrapError instanceof Error
          ? profileBootstrapError.message
          : 'We could not create the starting sleep plan profile.',
    }
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ onboarding_completed: true })
    .eq('id', user.id)

  if (profileError) {
    return {
      error: profileError.message ?? 'Your profile was not updated correctly.',
    }
  }

  redirect('/dashboard')
}
