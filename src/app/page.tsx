import Link from 'next/link'
import styles from './page.module.css'

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <img
          src="/somni_logo.png"
          alt="Somni"
          className={styles.logo}
          height={36}
        />

        <div className={`${styles.copy} animate-fade-up`}>
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
              <span className={styles.icon} aria-hidden="true">
                ??
              </span>
              <h2 className={`${styles.featureTitle} text-display`}>
                Personalised Coaching
              </h2>
              <p className="text-body">
                Based on your baby&apos;s age, logs, and sleep style.
              </p>
            </li>
            <li className={`${styles.highlightCard} card`}>
              <span className={styles.icon} aria-hidden="true">
                ?
              </span>
              <h2 className={`${styles.featureTitle} text-display`}>One-Hand Logging</h2>
              <p className="text-body">Fast sleep logging that works in the middle of the night.</p>
            </li>
            <li className={`${styles.highlightCard} card`}>
              <span className={styles.icon} aria-hidden="true">
                ???
              </span>
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

        <img
          src="/somni_icon.png"
          alt=""
          aria-hidden="true"
          className={styles.atmosphere}
        />
      </section>
    </main>
  )
}