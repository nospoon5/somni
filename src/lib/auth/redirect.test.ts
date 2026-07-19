import { describe, expect, it } from 'vitest'
import { sanitizeInviteRedirect } from './redirect'

const SHARE_ID = '123e4567-e89b-42d3-a456-426614174000'
const TOKEN = 'a'.repeat(64)

describe('invite redirect sanitization', () => {
  it('preserves one well-formed internal invitation target', () => {
    expect(
      sanitizeInviteRedirect(`/invite/accept?id=${SHARE_ID}&token=${TOKEN}`),
    ).toBe(`/invite/accept?id=${SHARE_ID}&token=${TOKEN}`)
  })

  it.each([
    'https://attacker.example/invite/accept',
    '//attacker.example/invite/accept',
    '/dashboard',
    `/invite/accept?id=not-a-uuid&token=${TOKEN}`,
    `/invite/accept?id=${SHARE_ID}&token=short`,
  ])('rejects unsafe or malformed target %s', (target) => {
    expect(sanitizeInviteRedirect(target)).toBeNull()
  })
})
