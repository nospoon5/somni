'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const LAST_IN_APP_PAGE_KEY = 'somni:last-in-app-page'

export function SupportOriginTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return
    if (pathname === '/support') return

    sessionStorage.setItem(LAST_IN_APP_PAGE_KEY, pathname)
  }, [pathname])

  return null
}
