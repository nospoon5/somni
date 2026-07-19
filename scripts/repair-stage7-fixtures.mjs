import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  TEST_ACCOUNTS,
  createAdminClient,
  getApprovedTestUser,
} from './fixture-utils.mjs'

const FIXTURES = [
  {
    label: 'Gentle',
    account: TEST_ACCOUNTS.GENTLE,
    babyName: 'GT',
    dateOfBirth: '2025-08-30',
    sleepStyle: 'gentle',
    score: 2,
  },
  {
    label: 'Balanced',
    account: TEST_ACCOUNTS.BALANCED,
    babyName: 'Aria',
    dateOfBirth: '2026-02-28',
    sleepStyle: 'balanced',
    score: 5,
  },
  {
    label: 'Fast Track',
    account: TEST_ACCOUNTS.FAST_TRACK,
    babyName: 'FT',
    dateOfBirth: '2025-12-30',
    sleepStyle: 'fast-track',
    score: 8,
  },
]

const APPLY = process.env.SOMNI_FIXTURE_REPAIR_APPLY === '1'
const admin = createAdminClient()

async function queryRows(table, column, values) {
  if (values.length === 0) return []
  const { data, error } = await admin.from(table).select('*').in(column, values)
  if (error) throw new Error(`Could not back up ${table}: ${error.message}`)
  return data ?? []
}

async function main() {
  const states = []
  for (const fixture of FIXTURES) {
    const user = await getApprovedTestUser(admin, fixture.account.email)
    const { data: babies, error } = await admin
      .from('babies')
      .select('*')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: true })
    if (error) throw error

    const canonical = (babies ?? []).find((baby) => baby.name === fixture.babyName) ??
      ((babies?.length ?? 0) === 1 ? babies[0] : null)
    if (fixture.label !== 'Gentle' && !canonical) {
      throw new Error(`${fixture.label} has no unambiguous canonical baby; refusing automatic repair.`)
    }

    states.push({ fixture, user, babies: babies ?? [], canonical })
  }

  const allBabyIds = states.flatMap((state) => state.babies.map((baby) => baby.id))
  const extraBabyIds = states.flatMap((state) =>
    state.babies.filter((baby) => baby.id !== state.canonical?.id).map((baby) => baby.id),
  )
  const approvedEmails = FIXTURES.map((fixture) => fixture.account.email)
  const { data: approvedShares, error: shareError } = await admin
    .from('baby_shares')
    .select('*')
    .in('baby_id', allBabyIds)
    .in('email', approvedEmails)
  if (shareError) throw shareError

  const backup = {
    capturedAt: new Date().toISOString(),
    mode: APPLY ? 'before-apply' : 'dry-run',
    profiles: await queryRows('profiles', 'id', states.map((state) => state.user.id)),
    babies: states.flatMap((state) => state.babies),
    onboardingPreferences: await queryRows('onboarding_preferences', 'baby_id', allBabyIds),
    sleepLogs: await queryRows('sleep_logs', 'baby_id', allBabyIds),
    messages: await queryRows('messages', 'baby_id', allBabyIds),
    dailyPlans: await queryRows('daily_plans', 'baby_id', allBabyIds),
    sleepPlanProfiles: await queryRows('sleep_plan_profiles', 'baby_id', allBabyIds),
    sleepPlanChangeEvents: await queryRows('sleep_plan_change_events', 'baby_id', allBabyIds),
    babyShares: approvedShares ?? [],
  }

  console.log('Stage 7 fixture repair plan:')
  for (const state of states) {
    console.log(
      `- ${state.fixture.label}: ${state.babies.length} owned baby row(s); canonical ${state.canonical ? 'found' : 'missing'}`,
    )
  }
  console.log(`- Extra owned baby rows to remove: ${extraBabyIds.length}`)
  console.log(`- Stale approved-account share rows to remove: ${approvedShares?.length ?? 0}`)

  if (!APPLY) {
    console.log('Dry run only. Set SOMNI_FIXTURE_REPAIR_APPLY=1 to apply this exact repair.')
    return
  }

  const backupDirectory = path.join(process.cwd(), 'test-results')
  fs.mkdirSync(backupDirectory, { recursive: true })
  const backupPath = path.join(
    backupDirectory,
    `stage7-fixture-backup-${new Date().toISOString().replaceAll(':', '-')}.json`,
  )
  fs.writeFileSync(backupPath, `${JSON.stringify(backup, null, 2)}\n`)

  if ((approvedShares?.length ?? 0) > 0) {
    const { error } = await admin
      .from('baby_shares')
      .delete()
      .in('id', approvedShares.map((share) => share.id))
    if (error) throw error
  }

  if (extraBabyIds.length > 0) {
    const { error } = await admin.from('babies').delete().in('id', extraBabyIds)
    if (error) throw error
  }

  for (const state of states) {
    let canonicalId = state.canonical?.id
    if (!canonicalId) {
      const { data: created, error } = await admin
        .from('babies')
        .insert({
          profile_id: state.user.id,
          name: state.fixture.babyName,
          date_of_birth: state.fixture.dateOfBirth,
          biggest_issue: 'something_else',
          feeding_type: 'breast',
          bedtime_range: 'varies',
        })
        .select('id')
        .single()
      if (error || !created) throw error ?? new Error('Canonical baby creation returned no row')
      canonicalId = created.id
    } else {
      const { error } = await admin
        .from('babies')
        .update({
          name: state.fixture.babyName,
          date_of_birth: state.fixture.dateOfBirth,
          biggest_issue: 'something_else',
          feeding_type: 'breast',
          bedtime_range: 'varies',
        })
        .eq('id', canonicalId)
        .eq('profile_id', state.user.id)
      if (error) throw error
    }

    const { data: preferences, error: preferenceReadError } = await admin
      .from('onboarding_preferences')
      .select('id')
      .eq('baby_id', canonicalId)
      .maybeSingle()
    if (preferenceReadError) throw preferenceReadError
    if (!preferences) {
      const { error } = await admin.from('onboarding_preferences').insert({
        baby_id: canonicalId,
        question_1_score: state.fixture.score,
        question_2_score: state.fixture.score,
        question_3_score: state.fixture.score,
        question_4_score: state.fixture.score,
        question_5_score: state.fixture.score,
        sleep_style_score: state.fixture.score,
        sleep_style_label: state.fixture.sleepStyle,
        typical_wake_time: '07:00',
        day_structure: 'mostly_home_flexible',
        nap_pattern: 'catnaps_or_varies',
        night_feeds: true,
        schedule_preference: 'mix_of_cues_and_anchors',
      })
      if (error) throw error
    }
  }

  for (const fixture of FIXTURES) {
    const user = await getApprovedTestUser(admin, fixture.account.email)
    const { data: babies, error } = await admin
      .from('babies')
      .select('name, date_of_birth')
      .eq('profile_id', user.id)
    if (error) throw error
    if (babies?.length !== 1 || babies[0].name !== fixture.babyName || babies[0].date_of_birth !== fixture.dateOfBirth) {
      throw new Error(`${fixture.label} fixture verification failed after repair.`)
    }
  }

  console.log(`Fixture repair verified. Recovery backup: ${backupPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
