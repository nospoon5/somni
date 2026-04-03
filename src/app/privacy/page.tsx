import type { Metadata } from 'next'
import styles from '../legal-page.module.css'

export const metadata: Metadata = {
  title: 'Privacy Policy | Somni',
}

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <article className={styles.card}>
        <p className={styles.eyebrow}>Legal</p>
        <h1 className={styles.title}>Privacy Policy</h1>
        <p className={styles.lede}>
          This page explains what information Somni collects, why we collect it, and
          how we protect it.
        </p>

        <p className={styles.draft}>
          Draft placeholder for review. This is not legal advice and is not a final
          policy. Before launch, replace this with reviewed copy that matches your
          actual data practices.
        </p>

        <div className={styles.content}>
          <h2>Summary</h2>
          <p>
            Somni is a sleep coaching app for parents. We only want to collect the
            minimum data needed to run the product safely and reliably.
          </p>

          <h2>What we may collect</h2>
          <ul>
            <li>
              Account information: email address and authentication identifiers.
            </li>
            <li>
              Baby profile information you enter: name (or nickname) and date of
              birth.
            </li>
            <li>
              Sleep logs you record: start/end times, tags, and optional notes.
            </li>
            <li>
              Chat messages you send and Somni’s responses, including safety metadata
              needed for quality and audit.
            </li>
            <li>
              Billing status: whether you have an active subscription (payments are
              handled by Stripe, not stored as full card details in Somni).
            </li>
            <li>
              Basic technical logs required for security and reliability (for example
              request timing and error messages).
            </li>
          </ul>

          <h2>Why we use it</h2>
          <ul>
            <li>To provide sleep logging, scoring, and coaching features.</li>
            <li>To keep your account secure and prevent abuse.</li>
            <li>To improve reliability and fix bugs.</li>
            <li>To manage subscription access (free vs premium).</li>
          </ul>

          <h2>What we do not do</h2>
          <ul>
            <li>We do not sell your personal information.</li>
            <li>
              We do not store your full payment card details in Somni (Stripe handles
              payments).
            </li>
          </ul>

          <h2>Data sharing</h2>
          <p>
            Somni uses third-party services to run the product (for example, hosting,
            database, AI providers, and billing). These providers process data only as
            needed to deliver the service.
          </p>

          <h2>Retention</h2>
          <p>
            We retain your data for as long as you keep your account, and longer if
            required for legal, security, or dispute-handling reasons. Replace this
            section with a specific retention schedule.
          </p>

          <h2>Your choices</h2>
          <ul>
            <li>Request access to or deletion of your account data.</li>
            <li>Opt out of optional communications if added later.</li>
          </ul>

          <h2>Contact</h2>
          <p>
            Add your official support contact here before launch (email address and
            business details).
          </p>
        </div>
      </article>
    </main>
  )
}

