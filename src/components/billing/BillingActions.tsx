'use client'

import { useState } from 'react'
import styles from './BillingActions.module.css'

type BillingActionsProps = {
  billingEnabled: boolean
  hasPremiumAccess: boolean
}

export function BillingActions({ billingEnabled, hasPremiumAccess }: BillingActionsProps) {
  const [busy, setBusy] = useState<'monthly' | 'annual' | 'portal' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function openCheckout(plan: 'monthly' | 'annual') {
    if (!billingEnabled || busy) return
    setBusy(plan)
    setError(null)

    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || typeof payload?.url !== 'string') {
        throw new Error(payload?.error ?? 'Unable to open checkout right now.')
      }
      window.location.assign(payload.url)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to open checkout right now.')
      setBusy(null)
    }
  }

  async function openPortal() {
    if (!billingEnabled || busy) return
    setBusy('portal')
    setError(null)

    try {
      const response = await fetch('/api/billing/portal', { method: 'POST' })
      const payload = await response.json().catch(() => null)
      if (!response.ok || typeof payload?.url !== 'string') {
        throw new Error(payload?.error ?? 'Unable to open billing portal right now.')
      }
      window.location.assign(payload.url)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to open billing portal right now.')
      setBusy(null)
    }
  }

  return (
    <div className={styles.actions}>
      {hasPremiumAccess ? (
        <button
          className="btn-secondary"
          type="button"
          onClick={openPortal}
          disabled={!billingEnabled || busy !== null}
        >
          {busy === 'portal' ? 'Opening...' : 'Manage billing'}
        </button>
      ) : (
        <>
          <button
            className="btn-primary"
            type="button"
            onClick={() => openCheckout('monthly')}
            disabled={!billingEnabled || busy !== null}
          >
            {busy === 'monthly' ? 'Opening...' : 'Upgrade monthly'}
          </button>
          <button
            className="btn-secondary"
            type="button"
            onClick={() => openCheckout('annual')}
            disabled={!billingEnabled || busy !== null}
          >
            {busy === 'annual' ? 'Opening...' : 'Upgrade annual'}
          </button>
        </>
      )}

      {!billingEnabled ? (
        <p className={styles.note}>Stripe is not configured yet in this environment.</p>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  )
}
