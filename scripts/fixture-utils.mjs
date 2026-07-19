import { createClient } from '@supabase/supabase-js'
import process from 'node:process'
import fs from 'node:fs'
import path from 'path'

const PROJECT_ROOT = process.cwd()

function readDocumentedTestAccount(profileLabel) {
  const source = fs.readFileSync(path.join(PROJECT_ROOT, 'docs', 'TEST_ACCOUNTS.md'), 'utf8')
  const section = source.match(
    new RegExp(`## Profile \\d+ - ${profileLabel}([\\s\\S]*?)(?=\\n## |\\n\\*\\*Notes on usage:)`, 'i'),
  )?.[1]
  const email = section?.match(/\*\*Email:\*\*\s*`([^`]+)`/i)?.[1]?.trim()
  const password = section?.match(/\*\*Password:\*\*\s*`([^`]+)`/i)?.[1]

  if (!email || !password) {
    throw new Error(`Missing documented credentials for the ${profileLabel} test account`)
  }

  return Object.freeze({ email, password })
}

export const TEST_ACCOUNTS = Object.freeze({
  GENTLE: readDocumentedTestAccount('Gentle'),
  BALANCED: readDocumentedTestAccount('Balanced'),
  FAST_TRACK: readDocumentedTestAccount('Fast Track'),
})

const APPROVED_TEST_EMAILS = new Set(Object.values(TEST_ACCOUNTS).map((account) => account.email))

function assertApprovedTestEmail(email) {
  if (!APPROVED_TEST_EMAILS.has(email)) {
    throw new Error('Test operation refused: the requested email is not an approved test account')
  }
}

export function assertSafeLinkedTestTarget() {
  if (process.env.SOMNI_E2E_ALLOW_LINKED_MUTATION !== '1') {
    throw new Error(
      'Linked test mutation refused: set SOMNI_E2E_ALLOW_LINKED_MUTATION=1 only after reviewing the exact scenario cleanup.',
    )
  }

  const appUrl = new URL(process.env.SOMNI_APP_URL || 'http://localhost:3000')
  const isLocalApp = appUrl.hostname === 'localhost' || appUrl.hostname === '127.0.0.1'
  if (!isLocalApp && process.env.SOMNI_E2E_ALLOW_REMOTE_APP !== '1') {
    throw new Error(
      'Linked test mutation refused for a remote app target. Set SOMNI_E2E_ALLOW_REMOTE_APP=1 only for an authorised non-production test environment.',
    )
  }

  const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '')
  const projectRef = supabaseUrl.hostname.split('.')[0]
  const approvedProjectRef = process.env.SOMNI_E2E_APPROVED_PROJECT_REF?.trim()
  if (!projectRef || !approvedProjectRef || approvedProjectRef !== projectRef) {
    throw new Error(
      'Linked test mutation refused: SOMNI_E2E_APPROVED_PROJECT_REF must exactly match the configured Supabase project reference.',
    )
  }
}

export function createAdminClient() {
  assertSafeLinkedTestTarget()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase URL or Service Role Key')
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

export async function getApprovedTestUser(admin, email) {
  assertApprovedTestEmail(email)
  const { data: users, error: usersError } = await admin.auth.admin.listUsers()
  if (usersError) throw usersError

  const user = users.users.find((u) => u.email === email)
  if (!user) {
    throw new Error('An approved pre-created test account is missing. Test setup never creates auth users.')
  }

  return user
}

export async function getOwnedBabyFixture(admin, email) {
  const user = await getApprovedTestUser(admin, email)

  const { data: babies, error: babyError } = await admin
    .from('babies')
    .select('id, name, date_of_birth')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: true })

  if (babyError) throw babyError
  if (!babies || babies.length !== 1) {
    throw new Error(
      `Expected exactly one canonical baby fixture for the approved account; found ${babies?.length ?? 0}. Repair the fixture before testing.`,
    )
  }

  return { user, baby: babies[0] }
}

export async function deleteExactRows(admin, table, ids) {
  const exactIds = [...new Set(ids.filter(Boolean))]
  if (exactIds.length === 0) return
  const { error } = await admin.from(table).delete().in('id', exactIds)
  if (error) throw new Error(`Exact cleanup failed for ${table}: ${error.message}`)
}
