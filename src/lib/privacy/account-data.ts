import 'server-only'

import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/types/database.types'

const EXPORT_PAGE_SIZE = 500

type Tables = Database['public']['Tables']
type TableRow<T extends keyof Tables> = Tables[T]['Row']

type ProfileExport = Pick<
  TableRow<'profiles'>,
  | 'id'
  | 'email'
  | 'full_name'
  | 'timezone'
  | 'onboarding_completed'
  | 'push_enabled'
  | 'in_app_feed_enabled'
  | 'night_suppression_enabled'
  | 'suppression_start'
  | 'suppression_end'
  | 'created_at'
  | 'updated_at'
>

type OwnedBabyQueryRow = Pick<
  TableRow<'babies'>,
  | 'id'
  | 'profile_id'
  | 'name'
  | 'date_of_birth'
  | 'biggest_issue'
  | 'feeding_type'
  | 'bedtime_range'
  | 'ai_memory'
  | 'created_at'
>

type OwnedBabyExport = Omit<OwnedBabyQueryRow, 'profile_id'>

type ShareExport = Pick<
  TableRow<'baby_shares'>,
  'id' | 'baby_id' | 'access_role' | 'status' | 'created_at' | 'updated_at'
>

type SleepLogQueryRow = Pick<
  TableRow<'sleep_logs'>,
  | 'id'
  | 'baby_id'
  | 'started_at'
  | 'ended_at'
  | 'is_night'
  | 'tags'
  | 'notes'
  | 'logged_by'
  | 'created_at'
>

type SleepLogExport = Omit<SleepLogQueryRow, 'logged_by'> & {
  contributor: 'account_holder' | 'caregiver' | 'legacy_unattributed'
}

type PreferenceExport = Pick<
  TableRow<'onboarding_preferences'>,
  | 'id'
  | 'baby_id'
  | 'question_1_score'
  | 'question_2_score'
  | 'question_3_score'
  | 'question_4_score'
  | 'question_5_score'
  | 'sleep_style_score'
  | 'sleep_style_label'
  | 'typical_wake_time'
  | 'day_structure'
  | 'nap_pattern'
  | 'night_feeds'
  | 'schedule_preference'
  | 'created_at'
>

type DailyPlanExport = Pick<
  TableRow<'daily_plans'>,
  | 'id'
  | 'baby_id'
  | 'plan_date'
  | 'sleep_targets'
  | 'feed_targets'
  | 'notes'
  | 'pending_rescue_targets'
  | 'rescue_dismissed'
  | 'created_at'
  | 'updated_at'
>

type SleepPlanProfileExport = Pick<
  TableRow<'sleep_plan_profiles'>,
  | 'id'
  | 'baby_id'
  | 'age_band'
  | 'template_key'
  | 'usual_wake_time'
  | 'target_bedtime'
  | 'target_nap_count'
  | 'wake_window_profile'
  | 'feed_anchor_profile'
  | 'schedule_preference'
  | 'day_structure'
  | 'adaptation_confidence'
  | 'learning_state'
  | 'last_auto_adjusted_at'
  | 'last_evidence_summary'
  | 'created_at'
  | 'updated_at'
>

type ChangeEventExport = Pick<
  TableRow<'sleep_plan_change_events'>,
  | 'id'
  | 'baby_id'
  | 'sleep_plan_profile_id'
  | 'plan_date'
  | 'change_scope'
  | 'change_source'
  | 'change_kind'
  | 'evidence_confidence'
  | 'summary'
  | 'rationale'
  | 'before_snapshot'
  | 'after_snapshot'
  | 'created_at'
>

type MessageExport = Pick<
  TableRow<'messages'>,
  | 'id'
  | 'baby_id'
  | 'conversation_id'
  | 'role'
  | 'content'
  | 'sources_used'
  | 'safety_note'
  | 'is_emergency_redirect'
  | 'confidence'
  | 'model'
  | 'created_at'
>

type SupportTicketExport = Pick<
  TableRow<'support_tickets'>,
  | 'id'
  | 'email'
  | 'category'
  | 'message'
  | 'origin_page'
  | 'support_page'
  | 'user_agent'
  | 'status'
  | 'created_at'
  | 'updated_at'
>

type NotificationExport = Pick<
  TableRow<'notification_logs'>,
  'id' | 'title' | 'body' | 'is_read' | 'created_at'
>

type DeviceExport = Pick<TableRow<'push_subscriptions'>, 'id' | 'user_agent' | 'created_at'>

type BillingExport = Pick<
  TableRow<'subscriptions'>,
  'plan' | 'status' | 'current_period_end' | 'is_trial' | 'created_at' | 'updated_at'
>

type UsageExport = Pick<
  TableRow<'usage_counters'>,
  'usage_date' | 'message_count' | 'last_incremented_at'
>

type ExportPageResult = {
  data: unknown[] | null
  error: { message: string } | null
}

type ExportPageQuery = (from: number, to: number) => PromiseLike<ExportPageResult>

export type AccountDataExport = {
  schemaVersion: 1
  exportedAt: string
  account: {
    auth: {
      id: string
      email: string | null
      phone: string | null
      created_at: string
      updated_at: string | null
      last_sign_in_at: string | null
      confirmed_at: string | null
    }
    profile: ProfileExport | null
    billing: BillingExport | null
    usage: UsageExport[]
    messages: MessageExport[]
    support_tickets: SupportTicketExport[]
    notifications: NotificationExport[]
    registered_devices: DeviceExport[]
    shares: {
      access_granted_to_others: ShareExport[]
      invitations_for_this_account: ShareExport[]
    }
  }
  owned_babies: Array<
    OwnedBabyExport & {
      onboarding_preferences: PreferenceExport[]
      sleep_logs: SleepLogExport[]
      daily_plans: DailyPlanExport[]
      sleep_plan_profiles: SleepPlanProfileExport[]
      sleep_plan_change_events: ChangeEventExport[]
    }
  >
  shared_family_contributions: {
    sleep_logs: SleepLogExport[]
  }
}

async function fetchAllRows<T>(label: string, queryPage: ExportPageQuery): Promise<T[]> {
  const rows: T[] = []

  for (let page = 0; ; page += 1) {
    const from = page * EXPORT_PAGE_SIZE
    const to = from + EXPORT_PAGE_SIZE - 1
    const { data, error } = await queryPage(from, to)

    if (error) {
      throw new Error(`Could not export ${label}: ${error.message}`)
    }

    const pageRows = (data ?? []) as T[]
    rows.push(...pageRows)

    if (pageRows.length < EXPORT_PAGE_SIZE) {
      return rows
    }
  }
}

function firstOrNull<T>(label: string, rows: T[]): T | null {
  if (rows.length > 1) {
    throw new Error(`Could not export ${label}: more than one record was returned.`)
  }

  return rows[0] ?? null
}

function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  return [...new Map(rows.map((row) => [row.id, row])).values()]
}

function toSleepLogExport(row: SleepLogQueryRow, accountId: string): SleepLogExport {
  const { logged_by: loggedBy, ...safeRow } = row

  return {
    ...safeRow,
    contributor:
      loggedBy === accountId
        ? 'account_holder'
        : loggedBy
          ? 'caregiver'
          : 'legacy_unattributed',
  }
}

function toOwnedBabyExport(row: OwnedBabyQueryRow): OwnedBabyExport {
  return {
    id: row.id,
    name: row.name,
    date_of_birth: row.date_of_birth,
    biggest_issue: row.biggest_issue,
    feeding_type: row.feeding_type,
    bedtime_range: row.bedtime_range,
    ai_memory: row.ai_memory,
    created_at: row.created_at,
  }
}

export function toSafeAuthExport(user: User): AccountDataExport['account']['auth'] {
  return {
    id: user.id,
    email: user.email ?? null,
    phone: user.phone ?? null,
    created_at: user.created_at,
    updated_at: user.updated_at ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
    confirmed_at: user.confirmed_at ?? null,
  }
}

export async function compileAccountDataExport(user: User): Promise<AccountDataExport> {
  const admin = createAdminClient()
  const normalizedEmail = user.email?.trim().toLowerCase() ?? null

  const [
    profileRows,
    ownedBabies,
    directShares,
    pendingEmailShares,
    billingRows,
    usage,
    messages,
    supportTickets,
    notifications,
    devices,
  ] = await Promise.all([
    fetchAllRows<ProfileExport>('profile', (from, to) =>
      admin
        .from('profiles')
        .select(
          'id, email, full_name, timezone, onboarding_completed, push_enabled, in_app_feed_enabled, night_suppression_enabled, suppression_start, suppression_end, created_at, updated_at'
        )
        .eq('id', user.id)
        .range(from, to)
    ),
    fetchAllRows<OwnedBabyQueryRow>('owned baby profiles', (from, to) =>
      admin
        .from('babies')
        .select(
          'id, profile_id, name, date_of_birth, biggest_issue, feeding_type, bedtime_range, ai_memory, created_at'
        )
        .eq('profile_id', user.id)
        .order('created_at', { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<ShareExport>('accepted family access', (from, to) =>
      admin
        .from('baby_shares')
        .select('id, baby_id, access_role, status, created_at, updated_at')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: true })
        .range(from, to)
    ),
    normalizedEmail
      ? fetchAllRows<ShareExport>('pending family invitations', (from, to) =>
          admin
            .from('baby_shares')
            .select('id, baby_id, access_role, status, created_at, updated_at')
            .eq('email', normalizedEmail)
            .eq('status', 'pending')
            .is('profile_id', null)
            .order('created_at', { ascending: true })
            .range(from, to)
        )
      : Promise.resolve([]),
    fetchAllRows<BillingExport>('billing history', (from, to) =>
      admin
        .from('subscriptions')
        .select('plan, status, current_period_end, is_trial, created_at, updated_at')
        .eq('profile_id', user.id)
        .range(from, to)
    ),
    fetchAllRows<UsageExport>('usage history', (from, to) =>
      admin
        .from('usage_counters')
        .select('usage_date, message_count, last_incremented_at')
        .eq('profile_id', user.id)
        .order('usage_date', { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<MessageExport>('chat messages', (from, to) =>
      admin
        .from('messages')
        .select(
          'id, baby_id, conversation_id, role, content, sources_used, safety_note, is_emergency_redirect, confidence, model, created_at'
        )
        .eq('profile_id', user.id)
        .order('created_at', { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<SupportTicketExport>('support tickets', (from, to) =>
      admin
        .from('support_tickets')
        .select(
          'id, email, category, message, origin_page, support_page, user_agent, status, created_at, updated_at'
        )
        .eq('profile_id', user.id)
        .order('created_at', { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<NotificationExport>('notification history', (from, to) =>
      admin
        .from('notification_logs')
        .select('id, title, body, is_read, created_at')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<DeviceExport>('registered devices', (from, to) =>
      admin
        .from('push_subscriptions')
        .select('id, user_agent, created_at')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: true })
        .range(from, to)
    ),
  ])

  const ownedBabyIds = ownedBabies.map((baby) => baby.id)
  const ownedBabyIdSet = new Set(ownedBabyIds)
  const invitationsForAccount = uniqueById([...directShares, ...pendingEmailShares])
  const sharedBabyIds = uniqueById(directShares)
    .filter((share) => share.status === 'accepted' && !ownedBabyIdSet.has(share.baby_id))
    .map((share) => share.baby_id)

  const [
    ownerShares,
    preferences,
    ownedSleepLogs,
    dailyPlans,
    sleepPlanProfiles,
    changeEvents,
    sharedSleepLogs,
  ] = await Promise.all([
    ownedBabyIds.length > 0
      ? fetchAllRows<ShareExport>('caregiver access records', (from, to) =>
          admin
            .from('baby_shares')
            .select('id, baby_id, access_role, status, created_at, updated_at')
            .in('baby_id', ownedBabyIds)
            .order('created_at', { ascending: true })
            .range(from, to)
        )
      : Promise.resolve([]),
    ownedBabyIds.length > 0
      ? fetchAllRows<PreferenceExport>('onboarding preferences', (from, to) =>
          admin
            .from('onboarding_preferences')
            .select(
              'id, baby_id, question_1_score, question_2_score, question_3_score, question_4_score, question_5_score, sleep_style_score, sleep_style_label, typical_wake_time, day_structure, nap_pattern, night_feeds, schedule_preference, created_at'
            )
            .in('baby_id', ownedBabyIds)
            .order('created_at', { ascending: true })
            .range(from, to)
        )
      : Promise.resolve([]),
    ownedBabyIds.length > 0
      ? fetchAllRows<SleepLogQueryRow>('owned baby sleep logs', (from, to) =>
          admin
            .from('sleep_logs')
            .select(
              'id, baby_id, started_at, ended_at, is_night, tags, notes, logged_by, created_at'
            )
            .in('baby_id', ownedBabyIds)
            .order('created_at', { ascending: true })
            .range(from, to)
        )
      : Promise.resolve([]),
    ownedBabyIds.length > 0
      ? fetchAllRows<DailyPlanExport>('daily plans', (from, to) =>
          admin
            .from('daily_plans')
            .select(
              'id, baby_id, plan_date, sleep_targets, feed_targets, notes, pending_rescue_targets, rescue_dismissed, created_at, updated_at'
            )
            .in('baby_id', ownedBabyIds)
            .order('created_at', { ascending: true })
            .range(from, to)
        )
      : Promise.resolve([]),
    ownedBabyIds.length > 0
      ? fetchAllRows<SleepPlanProfileExport>('sleep plan profiles', (from, to) =>
          admin
            .from('sleep_plan_profiles')
            .select(
              'id, baby_id, age_band, template_key, usual_wake_time, target_bedtime, target_nap_count, wake_window_profile, feed_anchor_profile, schedule_preference, day_structure, adaptation_confidence, learning_state, last_auto_adjusted_at, last_evidence_summary, created_at, updated_at'
            )
            .in('baby_id', ownedBabyIds)
            .order('created_at', { ascending: true })
            .range(from, to)
        )
      : Promise.resolve([]),
    ownedBabyIds.length > 0
      ? fetchAllRows<ChangeEventExport>('sleep plan change events', (from, to) =>
          admin
            .from('sleep_plan_change_events')
            .select(
              'id, baby_id, sleep_plan_profile_id, plan_date, change_scope, change_source, change_kind, evidence_confidence, summary, rationale, before_snapshot, after_snapshot, created_at'
            )
            .in('baby_id', ownedBabyIds)
            .order('created_at', { ascending: true })
            .range(from, to)
        )
      : Promise.resolve([]),
    sharedBabyIds.length > 0
      ? fetchAllRows<SleepLogQueryRow>('shared family contributions', (from, to) =>
          admin
            .from('sleep_logs')
            .select(
              'id, baby_id, started_at, ended_at, is_night, tags, notes, logged_by, created_at'
            )
            .in('baby_id', sharedBabyIds)
            .eq('logged_by', user.id)
            .order('created_at', { ascending: true })
            .range(from, to)
        )
      : Promise.resolve([]),
  ])

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    account: {
      auth: toSafeAuthExport(user),
      profile: firstOrNull('profile', profileRows),
      billing: firstOrNull('billing history', billingRows),
      usage,
      messages,
      support_tickets: supportTickets,
      notifications,
      registered_devices: devices,
      shares: {
        access_granted_to_others: ownerShares,
        invitations_for_this_account: invitationsForAccount,
      },
    },
    owned_babies: ownedBabies.map((rawBaby) => {
      const baby = toOwnedBabyExport(rawBaby)
      return {
        ...baby,
        onboarding_preferences: preferences.filter((row) => row.baby_id === baby.id),
        sleep_logs: ownedSleepLogs
          .filter((row) => row.baby_id === baby.id)
          .map((row) => toSleepLogExport(row, user.id)),
        daily_plans: dailyPlans.filter((row) => row.baby_id === baby.id),
        sleep_plan_profiles: sleepPlanProfiles.filter((row) => row.baby_id === baby.id),
        sleep_plan_change_events: changeEvents.filter((row) => row.baby_id === baby.id),
      }
    }),
    shared_family_contributions: {
      sleep_logs: sharedSleepLogs.map((row) => toSleepLogExport(row, user.id)),
    },
  }
}
