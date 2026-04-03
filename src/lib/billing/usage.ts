import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

export const FREE_CHAT_DAILY_LIMIT = 10
export const DEFAULT_PROFILE_TIMEZONE = 'Australia/Sydney'
export const DAILY_LIMIT_ERROR_CODE = 'DAILY_CHAT_LIMIT_REACHED'

type RawQuotaRow = {
  allowed: boolean
  usage_date: string
  message_count: number
  daily_limit: number
  remaining: number
  reset_at: string
}

export type ChatQuotaStatus = {
  allowed: boolean
  usageDate: string
  messageCount: number
  dailyLimit: number
  remaining: number
  resetAt: string
  timezone: string
}

function getTimeZoneParts(timezone: string, date: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  return {
    year: Number(read('year')),
    month: Number(read('month')),
    day: Number(read('day')),
    hour: Number(read('hour')),
    minute: Number(read('minute')),
    second: Number(read('second')),
  }
}

function getUsageDateForTimezone(timezone: string, date = new Date()) {
  const parts = getTimeZoneParts(timezone, date)
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(
    2,
    '0'
  )}`
}

function zonedTimeToUtc(input: {
  year: number
  month: number
  day: number
  hour?: number
  minute?: number
  second?: number
  timezone: string
}) {
  const utcGuess = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour ?? 0,
    input.minute ?? 0,
    input.second ?? 0
  )
  const guessParts = getTimeZoneParts(input.timezone, new Date(utcGuess))
  const desiredUtc = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour ?? 0,
    input.minute ?? 0,
    input.second ?? 0
  )
  const actualUtc = Date.UTC(
    guessParts.year,
    guessParts.month - 1,
    guessParts.day,
    guessParts.hour,
    guessParts.minute,
    guessParts.second
  )

  return new Date(utcGuess - (actualUtc - desiredUtc))
}

function getNextResetAt(timezone: string, date = new Date()) {
  const parts = getTimeZoneParts(timezone, date)
  return zonedTimeToUtc({
    year: parts.year,
    month: parts.month,
    day: parts.day + 1,
    timezone,
  }).toISOString()
}

export function sanitizeTimezone(value: string | null | undefined) {
  const candidate = value?.trim()

  if (!candidate) {
    return DEFAULT_PROFILE_TIMEZONE
  }

  try {
    new Intl.DateTimeFormat('en-AU', { timeZone: candidate }).format(new Date())
    return candidate
  } catch {
    return DEFAULT_PROFILE_TIMEZONE
  }
}

function normalizeQuotaRow(row: RawQuotaRow, timezone: string): ChatQuotaStatus {
  return {
    allowed: Boolean(row.allowed),
    usageDate: String(row.usage_date),
    messageCount: Number(row.message_count ?? 0),
    dailyLimit: Number(row.daily_limit ?? FREE_CHAT_DAILY_LIMIT),
    remaining: Number(row.remaining ?? 0),
    resetAt: new Date(row.reset_at).toISOString(),
    timezone,
  }
}

function isMissingQuotaFunction(
  error: { message?: string } | null,
  functionName: 'consume_chat_quota' | 'release_chat_quota'
) {
  return Boolean(
    error?.message &&
      error.message.includes(functionName) &&
      (error.message.includes('does not exist') || error.message.includes('Could not find'))
  )
}

export async function consumeChatQuota(profileId: string, timezone: string) {
  const admin = createAdminClient()
  const safeTimezone = sanitizeTimezone(timezone)
  const { data, error } = await admin.rpc('consume_chat_quota', {
    p_profile_id: profileId,
    p_timezone: safeTimezone,
    p_daily_limit: FREE_CHAT_DAILY_LIMIT,
  })

  if (isMissingQuotaFunction(error, 'consume_chat_quota')) {
    const usageDate = getUsageDateForTimezone(safeTimezone)
    const resetAt = getNextResetAt(safeTimezone)

    const { data: existing, error: existingError } = await admin
      .from('usage_counters')
      .select('id, message_count')
      .eq('profile_id', profileId)
      .eq('usage_date', usageDate)
      .maybeSingle()

    if (existingError) {
      throw new Error(`Failed to load fallback chat quota: ${existingError.message}`)
    }

    let currentCount = Number(existing?.message_count ?? 0)
    let rowId = existing?.id ?? null

    if (!rowId) {
      const { data: created, error: createError } = await admin
        .from('usage_counters')
        .insert({
          profile_id: profileId,
          usage_date: usageDate,
          message_count: 0,
          last_incremented_at: new Date().toISOString(),
        })
        .select('id, message_count')
        .single()

      if (createError) {
        throw new Error(`Failed to create fallback chat quota row: ${createError.message}`)
      }

      rowId = created.id
      currentCount = Number(created.message_count ?? 0)
    }

    if (currentCount >= FREE_CHAT_DAILY_LIMIT) {
      return {
        allowed: false,
        usageDate,
        messageCount: currentCount,
        dailyLimit: FREE_CHAT_DAILY_LIMIT,
        remaining: Math.max(FREE_CHAT_DAILY_LIMIT - currentCount, 0),
        resetAt,
        timezone: safeTimezone,
      }
    }

    const nextCount = currentCount + 1
    const { error: updateError } = await admin
      .from('usage_counters')
      .update({
        message_count: nextCount,
        last_incremented_at: new Date().toISOString(),
      })
      .eq('id', rowId)

    if (updateError) {
      throw new Error(`Failed to increment fallback chat quota: ${updateError.message}`)
    }

    return {
      allowed: true,
      usageDate,
      messageCount: nextCount,
      dailyLimit: FREE_CHAT_DAILY_LIMIT,
      remaining: Math.max(FREE_CHAT_DAILY_LIMIT - nextCount, 0),
      resetAt,
      timezone: safeTimezone,
    }
  }

  if (error) {
    throw new Error(`Failed to consume chat quota: ${error.message}`)
  }

  const row = Array.isArray(data) ? data[0] : null
  if (!row) {
    throw new Error('Quota function returned no data')
  }

  return normalizeQuotaRow(row as RawQuotaRow, safeTimezone)
}

export async function releaseChatQuota(profileId: string, timezone: string) {
  const admin = createAdminClient()
  const safeTimezone = sanitizeTimezone(timezone)
  const { error } = await admin.rpc('release_chat_quota', {
    p_profile_id: profileId,
    p_timezone: safeTimezone,
  })

  if (isMissingQuotaFunction(error, 'release_chat_quota')) {
    const usageDate = getUsageDateForTimezone(safeTimezone)
    const { data: existing, error: existingError } = await admin
      .from('usage_counters')
      .select('id, message_count')
      .eq('profile_id', profileId)
      .eq('usage_date', usageDate)
      .maybeSingle()

    if (existingError) {
      throw new Error(`Failed to load fallback release quota row: ${existingError.message}`)
    }

    if (!existing?.id) {
      return
    }

    const { error: updateError } = await admin
      .from('usage_counters')
      .update({
        message_count: Math.max(Number(existing.message_count ?? 0) - 1, 0),
        last_incremented_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (updateError) {
      throw new Error(`Failed to release fallback chat quota: ${updateError.message}`)
    }

    return
  }

  if (error) {
    throw new Error(`Failed to release chat quota: ${error.message}`)
  }
}

export function buildDailyLimitPayload(quota: ChatQuotaStatus) {
  return {
    error: "You have reached today's free Somni chat limit.",
    code: DAILY_LIMIT_ERROR_CODE,
    message:
      `You have used ${quota.messageCount} of ${quota.dailyLimit} free chats today. ` +
      'Your limit resets at midnight in your selected timezone.',
    dailyLimit: quota.dailyLimit,
    used: quota.messageCount,
    remaining: quota.remaining,
    resetAt: quota.resetAt,
    timezone: quota.timezone,
    upgradeHint: 'Somni Premium removes the daily chat cap so help is there whenever you need it.',
  }
}
