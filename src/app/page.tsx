import Link from 'next/link'
import styles from './page.module.css'

function FeatureIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={`${styles.copy} animate-fade-up`}>
          <div className={styles.brandRow}>
            <span className={styles.brandDot} aria-hidden="true" />
            <span className={styles.brandText}>Somni</span>
          </div>

          <h1 className={`${styles.title} text-display`}>
            Gentle, grounded infant sleep coaching for the longest nights.
          </h1>
          <p className={`${styles.summary} text-body`}>
            Track sleep, spot patterns, and get calm, source-backed guidance when
            you are making decisions at 3am.
          </p>

          <div className={styles.actions}>
            <Link href="/signup" className="btn-primary">
              Create your account
            </Link>
            <Link href="/login" className="btn-secondary">
              Sign in
            </Link>
          </div>

          <ul className={styles.highlights}>
            <li className={`${styles.highlightCard} card`}>
              <FeatureIcon path="M20 15.2c-1.2 2.6-3.8 4.3-6.8 4.3-4.1 0-7.4-3.3-7.4-7.4 0-3 1.7-5.6 4.3-6.8" />
              <h2 className={`${styles.featureTitle} text-display`}>Personalised Coaching</h2>
              <p className="text-body">Based on your baby&apos;s age, logs, and sleep style.</p>
            </li>
            <li className={`${styles.highlightCard} card`}>
              <FeatureIcon path="M12 2v20M2 12h20" />
              <h2 className={`${styles.featureTitle} text-display`}>One-Hand Logging</h2>
              <p className="text-body">Fast sleep logging that works in the middle of the night.</p>
            </li>
            <li className={`${styles.highlightCard} card`}>
              <FeatureIcon path="M12 3l7 3v6c0 4.5-2.8 7.9-7 9-4.2-1.1-7-4.5-7-9V6l7-3z" />
              <h2 className={`${styles.featureTitle} text-display`}>Safety-First Language</h2>
              <p className="text-body">Clear, careful wording with emergency guidance when needed.</p>
            </li>
          </ul>
        </div>

        <div className={`${styles.previewCard} card-glass`}>
          <div className={styles.previewHeader}>
            <span className="text-label">Example coach view</span>
            <span className={styles.previewScore}>Sample</span>
          </div>
          <h2 className={`${styles.previewTitle} text-display`}>Calm next step</h2>
          <p className="text-body">
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

        <div className={styles.atmosphere} aria-hidden="true" />
      </section>
    </main>
  )
}
