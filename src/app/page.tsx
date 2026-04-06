import Image from 'next/image'
import Link from 'next/link'
import styles from './page.module.css'
import { LiveChatDemo } from '@/components/ui/LiveChatDemo'

function FeatureIcon({ path, isSolid }: { path: string, isSolid?: boolean }) {
  if (isSolid) {
    return (
      <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true" fill="currentColor">
        <path d={path} />
      </svg>
    )
  }
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
          <div className={styles.heroHeader}>
            <Image
              src="/somni_icon_tile.png"
              alt="Somni"
              width={180}
              height={180}
              className={styles.heroLogo}
              priority
            />
            <h1 className={`${styles.title} text-display`}>
              Finally, infant sleep coaching that actually listens to you.
            </h1>
          </div>
          <p className={`${styles.summary} text-body`}>
            Generic schedules don&apos;t work for every baby. Somni gives you tailored, 24/7 advice based on your baby&apos;s unique sleep patterns and your parenting style.
          </p>

          <div className={styles.actions}>
            <Link href="/signup" className="btn-primary">
              Try Somni for Free
            </Link>
            <Link href="/login" className="btn-secondary">
              Sign in
            </Link>
          </div>

          <ul className={styles.highlights}>
            <li className={`${styles.highlightCard} ${styles.largeLeft} card`}>
              <FeatureIcon path="M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20 M12 10a2 2 0 1 0 0 4a2 2 0 1 0 0-4 M12 2v2M12 20v2M2 12h2M20 12h2" />
              <h2 className={`${styles.featureTitle} text-display`}>Personalised to Your Baby</h2>
              <p className="text-body">Coaching that actively adapts to your baby&apos;s age, sleep logs, and your preferred approach.</p>
            </li>
            <li className={`${styles.highlightCard} ${styles.largeRight} card`}>
              <FeatureIcon isSolid={true} path="M18.8 8.4 c-0.6-0.3-2.1-0.2-3.3 0.1 c-0.1 0-0.3 0.1-0.5 0.2 c-1.5 1.2-4.1 4.3-5.2 5.5 h-3 c0 0-1.2 0.3-1.6 1.1 c-0.3 0.7 0.9 1 1.7 0.9 h2.4 l2 3.6 c-0.1 0.4-3.5 6-2 6.5 l1.7 0.1 c0 0 1.2-3.5 1.9-5 c0 0 2 0 1.7 1.5 c-0.3 1 1 1 1 1 s0.3-2-2-4 l2-2 c1.1 0 3-1.4 3-1.4 c1 1.2 1 1.8 1 1.8 l1-0.5 c0 0-0.4-1.1-1.3-3 c1.5-1.3 2.1-3 1.3-4 C21.4 8.7 19.8 8.6 18.8 8.4 z" />
              <h2 className={`${styles.featureTitle} text-display`}>Trusted Local Sources</h2>
              <p className="text-body">Advice grounded in Australian safe-sleep guidelines from Red Nose, Tresillian, and Raising Children.</p>
            </li>
            <li className={`${styles.highlightCard} card`}>
              <FeatureIcon path="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <h2 className={`${styles.featureTitle} text-display`}>Clear, Actionable Guidance</h2>
              <p className="text-body">Stop scrolling Reddit. Get direct answers on exactly what to try next and why.</p>
            </li>
            <li className={`${styles.highlightCard} card`}>
              <FeatureIcon path="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              <h2 className={`${styles.featureTitle} text-display`}>Dynamic Sleep Scoring</h2>
              <p className="text-body">Track real progress with clear sleep scores. Spot trends across days and weeks easily.</p>
            </li>
            <li className={`${styles.highlightCard} card`}>
              <FeatureIcon path="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              <h2 className={`${styles.featureTitle} text-display`}>Your 24/7 Expert</h2>
              <p className="text-body">Access calm, judgement-free support at any time.</p>
            </li>
          </ul>
        </div>

        <LiveChatDemo />
      </section>
    </main>
  )
}
