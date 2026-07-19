import { createHash } from 'node:crypto'
import {
  TEST_ACCOUNTS,
  createAdminClient,
  getOwnedBabyFixture,
} from './fixture-utils.mjs'

const PROFILE_SCOPES = [
  'profiles',
  'subscriptions',
  'usage_counters',
  'messages',
  'push_subscriptions',
  'notification_logs',
  'support_tickets',
]

const BABY_SCOPES = [
  'babies',
  'baby_shares',
  'sleep_logs',
  'sleep_plan_profiles',
  'sleep_plan_change_events',
  'onboarding_preferences',
  'daily_plans',
]

function digestRows(rows) {
  const canonical = rows.map((row) => JSON.stringify(row)).sort().join('\n')
  return createHash('sha256').update(canonical).digest('hex')
}

async function snapshotScope(admin, table, column, value) {
  const { data, error } = await admin.from(table).select('*').eq(column, value)
  if (error) {
    throw new Error(`Could not snapshot ${table}: ${error.message}`)
  }

  return {
    count: data?.length ?? 0,
    sha256: digestRows(data ?? []),
  }
}

const admin = createAdminClient()
const snapshots = {}

for (const [persona, account] of Object.entries(TEST_ACCOUNTS)) {
  const { user, baby } = await getOwnedBabyFixture(admin, account.email)
  const scopes = {}

  for (const table of PROFILE_SCOPES) {
    const column = table === 'profiles' ? 'id' : 'profile_id'
    scopes[table] = await snapshotScope(admin, table, column, user.id)
  }

  for (const table of BABY_SCOPES) {
    const column = table === 'babies' ? 'id' : 'baby_id'
    scopes[table] = await snapshotScope(admin, table, column, baby.id)
  }

  snapshots[persona.toLowerCase()] = scopes
}

console.log(JSON.stringify(snapshots, null, 2))
