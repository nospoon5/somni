'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const pathname = usePathname()

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
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' }}>
          <button
            className="btn-primary"
            onClick={() => reset()}
          >
            Try again
          </button>
          <Link
            className="btn-secondary"
            href={`/support?originPage=${encodeURIComponent(pathname)}`}
          >
            Contact Support
          </Link>
        </div>
      </section>
    </main>
  )
}
