import Link from 'next/link'
import styles from './SiteFooter.module.css'

export function SiteFooter() {
  return (
    <footer className={styles.footer} aria-label="Site footer">
      <div className={styles.inner}>
        <div>© {new Date().getFullYear()} Somni</div>
        <nav className={styles.links} aria-label="Legal links">
          <Link className={styles.link} href="/privacy">
            Privacy
          </Link>
          <Link className={styles.link} href="/terms">
            Terms
          </Link>
          <Link className={styles.link} href="/disclaimer">
            Disclaimer
          </Link>
        </nav>
      </div>
      <p className={styles.note}>
        Somni is designed to support tired parents, not to replace personalised medical
        advice. If you are worried about your baby’s health or breathing, seek urgent
        medical help.
      </p>
    </footer>
  )
}

