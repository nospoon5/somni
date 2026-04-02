import Link from 'next/link'
import styles from './page.module.css'

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Somni</p>
          <h1 className={styles.title}>
            Gentle, grounded infant sleep coaching for the longest nights.
          </h1>
          <p className={styles.summary}>
            Track sleep, understand patterns, and receive calm, source-backed
            guidance designed for tired parents making decisions at 3am.
          </p>
          <div className={styles.actions}>
            <Link href="/signup" className={styles.primaryAction}>
              Create your account
            </Link>
            <Link href="/login" className={styles.secondaryAction}>
              Sign in
            </Link>
          </div>
          <ul className={styles.highlights}>
            <li>Personalised coaching grounded in curated sleep guidance</li>
            <li>3am-friendly sleep logging built for one-handed use</li>
            <li>Premium, calm design with safe-sleep compliant language</li>
          </ul>
        </div>

        <div className={styles.previewCard}>
          <div className={styles.previewHeader}>
            <span className={styles.previewStatus}>Tonight&apos;s focus</span>
            <span className={styles.previewScore}>78</span>
          </div>
          <h2 className={styles.previewTitle}>Improving</h2>
          <p className={styles.previewBody}>
            Bedtime is steady, but the second overnight wake is stretching the
            whole household. A smaller tweak tonight is to protect the last nap
            from running too late.
          </p>
          <div className={styles.previewTags}>
            <span>4-6 months</span>
            <span>Gentle</span>
            <span>Source-backed</span>
          </div>
        </div>
      </section>
    </main>
  )
}
