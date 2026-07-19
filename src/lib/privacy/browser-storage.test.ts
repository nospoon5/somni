import { describe, expect, it } from 'vitest'
import { isSomniStorageKey } from './browser-storage'

describe('Somni browser storage cleanup', () => {
  it('targets only Somni-owned keys', () => {
    expect(isSomniStorageKey('somni:daily-plan:user:baby')).toBe(true)
    expect(isSomniStorageKey('somni:last-in-app-page')).toBe(true)
    expect(isSomniStorageKey('another-app:key')).toBe(false)
    expect(isSomniStorageKey(null)).toBe(false)
  })
})
