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
            Track sleep, spot patterns, and get calm, source-backed guidance when
            you are making decisions at 3am.
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
            <li>Personalised coaching based on your baby&apos;s age, logs, and sleep style</li>
            <li>Fast sleep logging that is easy to use with one hand</li>
            <li>Careful safe-sleep wording and clear emergency guidance</li>
          </ul>
        </div>

        <div className={styles.previewCard}>
          <div className={styles.previewHeader}>
            <span className={styles.previewStatus}>Example coach view</span>
            <span className={styles.previewScore}>Sample</span>
          </div>
          <h2 className={styles.previewTitle}>Calm next step</h2>
          <p className={styles.previewBody}>
            This is an illustration of the coaching tone Somni uses after you add
            real sleep data: steady, specific, and grounded in the latest night
            rather than a generic script.
          </p>
          <div className={styles.previewTags}>
            <span>Illustration</span>
            <span>Gentle</span>
            <span>Source-backed</span>
          </div>
        </div>
      </section>
    </main>
  )
}
