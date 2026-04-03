import type { Metadata } from 'next'
import styles from '../legal-page.module.css'

export const metadata: Metadata = {
  title: 'Disclaimer | Somni',
}

export default function DisclaimerPage() {
  return (
    <main className={styles.page}>
      <article className={styles.card}>
        <p className={styles.eyebrow}>Legal</p>
        <h1 className={styles.title}>Disclaimer</h1>
        <p className={styles.lede}>
          Somni is designed for calm support during long nights. This page explains
          the boundaries of what the app can and cannot do.
        </p>

        <p className={styles.draft}>
          Draft placeholder for review. This is not legal advice. Before launch,
          replace this with reviewed copy that matches your product and jurisdiction.
        </p>

        <div className={styles.content}>
          <h2>Not medical advice</h2>
          <p>
            Somni provides general sleep coaching information. It does not provide
            medical diagnosis, treatment, or emergency services.
          </p>

          <h2>Urgent help</h2>
          <p>
            If you think your baby is unwell, is struggling to breathe, has bluish
            lips/skin, is unusually drowsy, or you have any urgent concern, seek
            immediate medical help. In Australia, call 000 for emergencies.
          </p>

          <h2>Safe sleep</h2>
          <p>
            Always follow recognised safe sleep guidance. Somni may reference safe
            sleep principles, but the app cannot see your sleep environment and cannot
            guarantee safety.
          </p>

          <h2>AI limitations</h2>
          <ul>
            <li>
              Chat responses can be wrong or incomplete. Use your judgement and check
              sources.
            </li>
            <li>
              Somni aims to be calm and careful, but it cannot replace a clinician
              who knows your baby.
            </li>
          </ul>

          <h2>Internet connection</h2>
          <p>
            Somni’s coaching chat requires an internet connection. If you are offline,
            the app may not be able to respond or sync your latest changes.
          </p>
        </div>
      </article>
    </main>
  )
}

