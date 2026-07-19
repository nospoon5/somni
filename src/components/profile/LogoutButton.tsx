'use client'

import { logoutAction } from '@/app/auth-actions'
import { clearSomniBrowserStorage } from '@/lib/privacy/browser-storage'

export function LogoutButton() {
  return (
    <form action={logoutAction} onSubmit={clearSomniBrowserStorage}>
      <button className="btn-secondary" type="submit">
        Sign out
      </button>
    </form>
  )
}
