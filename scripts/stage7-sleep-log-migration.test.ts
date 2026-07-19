import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260719120000_sleep_log_audit_hardening.sql'
  ),
  'utf8'
)

describe('Stage 7 sleep-log audit migration', () => {
  it('sets authenticated attribution in a trigger instead of trusting clients', () => {
    expect(migration).toContain('NEW.logged_by := v_user_id')
    expect(migration).toContain('NEW.logged_by := COALESCE(OLD.logged_by, v_user_id)')
    expect(migration).toContain('NEW.baby_id := OLD.baby_id')
    expect(migration).toMatch(/BEFORE INSERT OR UPDATE ON public\.sleep_logs/)
  })

  it('enforces the 48-hour update and delete boundary in RLS', () => {
    expect(migration.match(/started_at >= pg_catalog\.now\(\) - INTERVAL '48 hours'/g)).toHaveLength(
      3
    )
    expect(migration).toContain('Caregivers can update recent sleep logs')
    expect(migration).toContain('Caregivers can delete recent sleep logs')
  })
})
