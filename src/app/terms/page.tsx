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
          These terms describe the current Somni app, including sleep logging,
          coaching chat, and Stripe billing.
        </p>

        <div className={styles.content}>
          <h2>Using Somni</h2>
          <ul>
            <li>You must be at least 18 years old to create an account.</li>
            <li>
              You&apos;re responsible for keeping your login details secure and
              accurate.
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
            are concerned about your baby&apos;s health, seek advice from a qualified
            health professional.
          </p>

          <h2>Subscriptions</h2>
          <ul>
            <li>
              Somni offers a free tier and paid premium access. The free tier includes
              a daily chat cap; premium removes that cap.
            </li>
            <li>
              Paid subscriptions are processed by Stripe. Your subscription status
              controls access to premium features.
            </li>
            <li>
              Pricing and plan details are shown in checkout. Refunds and cancellations
              are handled through the billing flow or support details tied to your
              account.
            </li>
          </ul>

          <h2>Acceptable use</h2>
          <ul>
            <li>Don&apos;t misuse Somni (for example, attempting to break or abuse it).</li>
            <li>Don&apos;t upload content you don&apos;t have the right to share.</li>
          </ul>

          <h2>Availability</h2>
          <p>
            We aim to keep Somni available, but outages can happen. Some features
            (especially chat and sync) require an internet connection.
          </p>

          <h2>Changes</h2>
          <p>
            We may update Somni and these terms from time to time. If a change is
            important, we will make it visible in the product or through the contact
            details on your account.
          </p>

          <h2>Contact</h2>
          <p>
            For account, billing, or terms questions, use the support details tied to
            your Somni account.
          </p>
        </div>
      </article>
    </main>
  )
}
