'use client'

import { useEffect } from 'react'

export function PwaServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // Service workers in dev can be confusing because they "stick" in the browser.
    // We still register it (so install can be tested), but the worker itself
    // is written to be effectively no-op on localhost.
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Silent fail: PWA is a progressive enhancement, not a core feature.
    })
  }, [])

  return null
}

