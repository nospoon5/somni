'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './SiteFooter.module.css'

export function SiteFooter() {
  const pathname = usePathname()

  // Hide footer on core app routes.
  const appRoutes = ['/dashboard', '/sleep', '/chat', '/profile']
  if (pathname && appRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return null
  }

  return (
    <>
      {process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true' && (
        <div className={styles.maintenanceBanner} role="alert">
          Somni is currently undergoing scheduled maintenance. Some features may be temporarily unavailable.
        </div>
      )}
      <footer className={styles.footer} aria-label="Site footer">
      <div className={styles.inner}>
        <div>&copy; {new Date().getFullYear()} Somni</div>
        <nav className={styles.links} aria-label="Footer links">
          <Link className={styles.link} href="/privacy">
            Privacy
          </Link>
          <Link className={styles.link} href="/terms">
            Terms
          </Link>
          <Link className={styles.link} href="/disclaimer">
            Disclaimer
          </Link>
          <Link className={styles.link} href="/support">
            Support
          </Link>
        </nav>
      </div>
      <p className={styles.note}>
        Somni is designed to support tired parents and help babies sleep better, it does not replace professional medical advice.<br />
        If you are worried about your baby&apos;s health call Pregnancy, Birth and Baby on 1800 882 436 (7am to midnight)
        or Health Direct on 1800 022 222 (24/7) for advice from registered nurses.
        For urgent medical issues in Australia, call Triple Zero 000.
      </p>
    </footer>
    </>
  )
}
