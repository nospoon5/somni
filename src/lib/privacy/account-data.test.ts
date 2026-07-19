import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mocks.from }),
}))

import { compileAccountDataExport, toSafeAuthExport } from './account-data'

type FakeRow = Record<string, unknown>
type FakeResult = { data: FakeRow[] | null; error: { message: string } | null }
type Filter =
  | { kind: 'eq'; column: string; value: unknown }
  | { kind: 'is'; column: string; value: unknown }
  | { kind: 'in'; column: string; value: unknown[] }

class FakeQuery implements PromiseLike<FakeResult> {
  private selected = ''
  private filters: Filter[] = []
  private fromIndex = 0
  private toIndex = 499

  constructor(
    private readonly table: string,
    private readonly rows: FakeRow[],
    private readonly failingTable: string | null
  ) {}

  select(columns: string) {
    this.selected = columns
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.push({ kind: 'eq', column, value })
    return this
  }

  is(column: string, value: unknown) {
    this.filters.push({ kind: 'is', column, value })
    return this
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ kind: 'in', column, value })
    return this
  }

  order() {
    return this
  }

  range(from: number, to: number) {
    this.fromIndex = from
    this.toIndex = to
    return this
  }

  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    const result = this.buildResult()
    return Promise.resolve(result).then(onfulfilled, onrejected)
  }

  private buildResult(): FakeResult {
    if (this.table === this.failingTable) {
      return { data: null, error: { message: 'database unavailable' } }
    }

    const selectedColumns = this.selected.split(',').map((column) => column.trim())
    const filtered = this.rows.filter((row) =>
      this.filters.every((filter) => {
        if (filter.kind === 'in') {
          return filter.value.includes(row[filter.column])
        }
        return row[filter.column] === filter.value
      })
    )

    const page = filtered.slice(this.fromIndex, this.toIndex + 1).map((row) =>
      Object.fromEntries(selectedColumns.map((column) => [column, row[column]]))
    )

    return { data: page, error: null }
  }
}

const user = {
  id: 'user-1',
  email: 'parent@example.com',
  phone: '+61000000000',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
  last_sign_in_at: '2026-01-03T00:00:00.000Z',
  confirmed_at: '2026-01-01T01:00:00.000Z',
  app_metadata: { provider_secret: 'never-export-app-metadata' },
  user_metadata: { private_note: 'never-export-user-metadata' },
  aud: 'authenticated',
} as User

function installFakeDatabase(
  tables: Record<string, FakeRow[]>,
  failingTable: string | null = null
) {
  mocks.from.mockImplementation(
    (table: string) => new FakeQuery(table, tables[table] ?? [], failingTable)
  )
}

describe('account data export', () => {
  beforeEach(() => {
    mocks.from.mockReset()
  })

  it('returns a complete, paged allowlist and strips credentials and other-family identifiers', async () => {
    const usageRows = Array.from({ length: 501 }, (_, index) => ({
      profile_id: 'user-1',
      usage_date: `2026-01-${String((index % 28) + 1).padStart(2, '0')}`,
      message_count: index,
      last_incremented_at: '2026-01-01T00:00:00.000Z',
    }))

    installFakeDatabase({
      profiles: [{
        id: 'user-1', email: 'parent@example.com', full_name: 'Parent', timezone: 'Australia/Sydney',
        onboarding_completed: true, push_enabled: true, in_app_feed_enabled: true,
        night_suppression_enabled: false, suppression_start: '22:00', suppression_end: '07:00',
        created_at: 'created', updated_at: 'updated', secret_column: 'never-export-profile-secret',
      }],
      babies: [
        { id: 'owned-baby', profile_id: 'user-1', name: 'Owned', date_of_birth: '2026-01-01', biggest_issue: null, feeding_type: null, bedtime_range: null, ai_memory: 'context', created_at: 'created' },
        { id: 'shared-baby', profile_id: 'other-owner', name: 'Other family baby', date_of_birth: '2026-02-01', biggest_issue: null, feeding_type: null, bedtime_range: null, ai_memory: 'never-export-other-baby', created_at: 'created' },
      ],
      baby_shares: [
        { id: 'owner-share', baby_id: 'owned-baby', profile_id: 'other-caregiver', email: 'other-caregiver@example.com', access_role: 'caregiver', status: 'accepted', created_at: 'created', updated_at: 'updated', invite_token_hash: 'never-export-invite-token' },
        { id: 'my-share', baby_id: 'shared-baby', profile_id: 'user-1', email: 'parent@example.com', access_role: 'caregiver', status: 'accepted', created_at: 'created', updated_at: 'updated' },
        { id: 'pending-share', baby_id: 'pending-baby', profile_id: null, email: 'parent@example.com', access_role: 'caregiver', status: 'pending', created_at: 'created', updated_at: 'updated' },
      ],
      subscriptions: [{ profile_id: 'user-1', plan: 'monthly', status: 'active', current_period_end: 'later', is_trial: false, created_at: 'created', updated_at: 'updated', stripe_customer_id: 'never-export-customer', stripe_subscription_id: 'never-export-subscription' }],
      usage_counters: usageRows,
      messages: [{ id: 'message-1', profile_id: 'user-1', baby_id: 'shared-baby', conversation_id: 'conversation-1', role: 'user', content: 'my contribution', sources_used: null, safety_note: null, is_emergency_redirect: false, confidence: null, model: null, created_at: 'created' }],
      support_tickets: [{ id: 'ticket-1', profile_id: 'user-1', email: 'parent@example.com', category: 'billing', message: 'help', origin_page: '/billing', support_page: '/support', user_agent: 'browser', status: 'open', created_at: 'created', updated_at: 'updated' }],
      notification_logs: [{ id: 'notice-1', profile_id: 'user-1', title: 'Reminder', body: 'Sleep', is_read: false, created_at: 'created', idempotency_key: 'never-export-idempotency-key' }],
      push_subscriptions: [{ id: 'device-1', profile_id: 'user-1', endpoint: 'never-export-push-endpoint', p256dh: 'never-export-p256dh', auth: 'never-export-push-auth', user_agent: 'browser', created_at: 'created' }],
      onboarding_preferences: [],
      daily_plans: [],
      sleep_plan_profiles: [],
      sleep_plan_change_events: [],
      sleep_logs: [
        { id: 'owned-log', baby_id: 'owned-baby', started_at: 'start', ended_at: 'end', is_night: true, tags: [], notes: null, logged_by: 'other-caregiver', created_at: 'created' },
        { id: 'my-shared-log', baby_id: 'shared-baby', started_at: 'start', ended_at: 'end', is_night: true, tags: [], notes: 'my note', logged_by: 'user-1', created_at: 'created' },
        { id: 'other-shared-log', baby_id: 'shared-baby', started_at: 'start', ended_at: 'end', is_night: true, tags: [], notes: 'never-export-other-contribution', logged_by: 'other-caregiver', created_at: 'created' },
      ],
    })

    const result = await compileAccountDataExport(user)
    const serialized = JSON.stringify(result)

    expect(result.account.usage).toHaveLength(501)
    expect(result.owned_babies).toHaveLength(1)
    expect(result.owned_babies[0].sleep_logs[0].contributor).toBe('caregiver')
    expect(result.shared_family_contributions.sleep_logs.map((row) => row.id)).toEqual([
      'my-shared-log',
    ])
    expect(result.account.shares.invitations_for_this_account.map((row) => row.id)).toEqual([
      'my-share',
      'pending-share',
    ])
    expect(serialized).not.toContain('never-export')
    expect(serialized).not.toContain('other-caregiver@example.com')
    expect(serialized).not.toContain('logged_by')
    expect(serialized).not.toContain('profile_id')
  })

  it('fails the whole export when any required dataset cannot be read', async () => {
    installFakeDatabase({}, 'support_tickets')

    await expect(compileAccountDataExport(user)).rejects.toThrow(
      'Could not export support tickets: database unavailable'
    )
  })

  it('allowlists safe auth fields instead of serializing metadata', () => {
    expect(toSafeAuthExport(user)).toEqual({
      id: 'user-1',
      email: 'parent@example.com',
      phone: '+61000000000',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
      last_sign_in_at: '2026-01-03T00:00:00.000Z',
      confirmed_at: '2026-01-01T01:00:00.000Z',
    })
  })
})
