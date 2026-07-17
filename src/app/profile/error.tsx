'use client'

import { useEffect } from 'react'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main style={{ padding: '24px' }}>
      <section className="card">
        <h1 className="text-display">Something went wrong</h1>
        <p className="text-body" style={{ marginTop: '12px' }}>
          We encountered an error loading this page.
        </p>
        <button
          className="btn-primary"
          style={{ marginTop: '24px' }}
          onClick={() => reset()}
        >
          Try again
        </button>
      </section>
    </main>
  )
}
