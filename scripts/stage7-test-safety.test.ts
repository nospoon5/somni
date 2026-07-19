import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertSafeLinkedTestTarget,
  getApprovedTestUser,
} from './fixture-utils.mjs'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.restoreAllMocks()
})

function configureSafeLocalTarget() {
  vi.stubEnv('SOMNI_E2E_ALLOW_LINKED_MUTATION', '1')
  vi.stubEnv('SOMNI_APP_URL', 'http://127.0.0.1:3000')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://stage7-project.supabase.co')
  vi.stubEnv('SOMNI_E2E_APPROVED_PROJECT_REF', 'stage7-project')
}

describe('Stage 7 linked-test guard', () => {
  it('rejects mutation without an explicit confirmation', () => {
    configureSafeLocalTarget()
    delete process.env.SOMNI_E2E_ALLOW_LINKED_MUTATION
    expect(() => assertSafeLinkedTestTarget()).toThrow(/mutation refused/i)
  })

  it('rejects a mismatched Supabase project reference', () => {
    configureSafeLocalTarget()
    vi.stubEnv('SOMNI_E2E_APPROVED_PROJECT_REF', 'different-project')
    expect(() => assertSafeLinkedTestTarget()).toThrow(/exactly match/i)
  })

  it('rejects a remote app unless the remote target is explicitly authorised', () => {
    configureSafeLocalTarget()
    vi.stubEnv('SOMNI_APP_URL', 'https://example.invalid')
    expect(() => assertSafeLinkedTestTarget()).toThrow(/remote app target/i)
  })

  it('rejects an unapproved account before querying auth admin', async () => {
    const listUsers = vi.fn()
    await expect(
      getApprovedTestUser({ auth: { admin: { listUsers } } }, 'unknown@example.invalid'),
    ).rejects.toThrow(/not an approved test account/i)
    expect(listUsers).not.toHaveBeenCalled()
  })
})

describe('Stage 7 test tooling policy', () => {
  it('contains no auth-user creation or broad canonical-baby mutation in Playwright specs', () => {
    const e2eRoot = path.join(process.cwd(), 'tests', 'e2e')
    const sources = fs
      .readdirSync(e2eRoot, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
      .map((entry) => ({
        file: path.join(entry.parentPath, entry.name),
        source: fs.readFileSync(path.join(entry.parentPath, entry.name), 'utf8'),
      }))

    for (const { file, source } of sources) {
      expect(source, file).not.toMatch(/auth\.admin\.createUser/)
      expect(source, file).not.toMatch(/from\(['"]babies['"]\)\s*\.insert\s*\(/)
      expect(source, file).not.toMatch(/from\(['"]babies['"]\)\s*\.delete\s*\(/)
      expect(source, file).not.toContain('resetTestAccountFixtures')
    }
  })
})
