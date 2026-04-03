import type { Metadata } from 'next'
import styles from '../legal-page.module.css'

export const metadata: Metadata = {
  title: 'Terms of Service | Somni',
}

export default function TermsPage() {
  return (
    <main className={styles.page}>
      <article className={styles.card}>
        <p className={styles.eyebrow}>Legal</p>
        <h1 className={styles.title}>Terms of Service</h1>
        <p className={styles.lede}>
          These terms describe how Somni works, what you can expect from us, and what
          we need from you.
        </p>

        <p className={styles.draft}>
          Draft placeholder for review. This is not legal advice and is not a final
          agreement. Before launch, replace this with reviewed copy.
        </p>

        <div className={styles.content}>
          <h2>Using Somni</h2>
          <ul>
            <li>You must be at least 18 years old to create an account.</li>
            <li>
              You’re responsible for keeping your login details secure and accurate.
            </li>
            <li>
              Use Somni for personal, non-commercial purposes unless you have written
              permission.
            </li>
          </ul>

          <h2>Medical disclaimer</h2>
          <p>
            Somni provides general information and coaching support. It is not a
            medical device and does not provide medical diagnosis or treatment. If you
            are concerned about your baby’s health, seek advice from a qualified
            health professional.
          </p>

          <h2>Subscriptions</h2>
          <ul>
            <li>
              Somni may offer free and paid subscription tiers. Pricing and inclusions
              may change over time.
            </li>
            <li>
              Paid subscriptions are processed by Stripe. Your subscription status
              controls access to premium features.
            </li>
            <li>
              Add your refund/cancellation policy here before launch (including how
              trials work, if offered).
            </li>
          </ul>

          <h2>Acceptable use</h2>
          <ul>
            <li>Don’t misuse Somni (for example, attempting to break or abuse it).</li>
            <li>Don’t upload content you don’t have the right to share.</li>
          </ul>

          <h2>Availability</h2>
          <p>
            We aim to keep Somni available, but outages can happen. Some features
            (especially chat and sync) require an internet connection.
          </p>

          <h2>Changes</h2>
          <p>
            We may update Somni and these terms from time to time. Add the formal
            change-notice process here before launch.
          </p>

          <h2>Contact</h2>
          <p>
            Add your official support contact and business details here before launch.
          </p>
        </div>
      </article>
    </main>
  )
}

