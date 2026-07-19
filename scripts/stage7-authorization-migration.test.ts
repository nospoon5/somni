import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const MIGRATION_NAME = '20260719090000_authorization_hardening.sql'
const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'migrations', MIGRATION_NAME),
  'utf8',
)

describe('Stage 7 authorization migration', () => {
  it('accepts an invite only through an atomic, locked-down RPC', () => {
    expect(migration).toMatch(
      /CREATE OR REPLACE FUNCTION public\.accept_baby_invite\([\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = ''/,
    )
    expect(migration).toMatch(
      /UPDATE public\.baby_shares AS target_share[\s\S]*?RETURNING target_share\.baby_id/,
    )
    expect(migration).toContain("target_share.status = 'pending'")
    expect(migration).toContain('pg_catalog.lower(target_share.email) = v_user_email')
    expect(migration).toContain('target_share.invite_expires_at > pg_catalog.now()')
    expect(migration).toContain(
      "pg_catalog.sha256(pg_catalog.convert_to(p_raw_token, 'UTF8'))",
    )
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.accept_baby_invite\(UUID, TEXT\)[\s\S]*?GRANT EXECUTE ON FUNCTION public\.accept_baby_invite\(UUID, TEXT\)[\s\S]*?TO authenticated/,
    )
  })

  it('removes every direct authenticated share-update path', () => {
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Owners and invitees can update baby shares"',
    )
    expect(migration).toMatch(
      /REVOKE UPDATE ON TABLE public\.baby_shares\s+FROM PUBLIC, anon, authenticated/,
    )
    expect(migration).not.toMatch(/CREATE POLICY [^\n]+[\s\S]*?ON public\.baby_shares\s+FOR UPDATE/)
  })

  it('preserves owner-only token rotation through a scoped RPC', () => {
    expect(migration).toMatch(
      /CREATE OR REPLACE FUNCTION public\.rotate_baby_invite\([\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = ''/,
    )
    expect(migration).toMatch(
      /UPDATE public\.baby_shares AS target_share[\s\S]*?public\.is_baby_owner\(target_share\.baby_id, v_user_id\)[\s\S]*?RETURNING target_share\.invite_expires_at/,
    )
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.rotate_baby_invite\(UUID, TEXT\)[\s\S]*?GRANT EXECUTE ON FUNCTION public\.rotate_baby_invite\(UUID, TEXT\)[\s\S]*?TO authenticated/,
    )
  })

  it('allows only the caregiver delegation role', () => {
    expect(migration).toContain("SET access_role = 'caregiver'")
    expect(migration).toContain("CHECK (access_role = 'caregiver')")
    expect(migration).not.toMatch(/access_role\s*=\s*'admin'/)
  })

  it('makes baby ownership immutable while preserving safe editable columns', () => {
    expect(migration).toMatch(
      /REVOKE UPDATE ON TABLE public\.babies\s+FROM PUBLIC, anon, authenticated/,
    )
    expect(migration).toMatch(
      /GRANT UPDATE \([\s\S]*?\) ON TABLE public\.babies TO authenticated/,
    )

    const editableColumns = migration.match(
      /GRANT UPDATE \(([\s\S]*?)\) ON TABLE public\.babies TO authenticated/,
    )?.[1]
    expect(editableColumns).toBeDefined()
    expect(editableColumns).not.toContain('profile_id')
    expect(migration).toContain('IF NEW.profile_id IS DISTINCT FROM OLD.profile_id')
    expect(migration).toMatch(
      /CREATE TRIGGER protect_baby_ownership\s+BEFORE UPDATE OF profile_id ON public\.babies/,
    )
  })

  it('hardens access helpers against search-path and cross-user probing', () => {
    for (const functionName of ['is_baby_owner', 'has_baby_access']) {
      expect(migration).toMatch(
        new RegExp(
          `CREATE OR REPLACE FUNCTION public\\.${functionName}\\([\\s\\S]*?SECURITY DEFINER[\\s\\S]*?SET search_path = ''`,
        ),
      )
      expect(migration).toMatch(
        new RegExp(
          `REVOKE ALL ON FUNCTION public\\.${functionName}\\(UUID, UUID\\)[\\s\\S]*?FROM PUBLIC, anon, authenticated`,
        ),
      )
    }

    expect(migration.match(/user_uuid = \(SELECT auth\.uid\(\)\)/g)).toHaveLength(2)
  })
})
