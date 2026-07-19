import Link from 'next/link'
import { AuthForm } from '@/components/auth/AuthForm'
import { signupAction } from '@/app/auth-actions'
import styles from '../auth-page.module.css'
import { sanitizeInviteRedirect } from '@/lib/auth/redirect'

type SignupPageProps = {
  searchParams: Promise<{ redirectTo?: string }>
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const redirectTo = sanitizeInviteRedirect((await searchParams).redirectTo)
  const loginHref = redirectTo
    ? `/login?redirectTo=${encodeURIComponent(redirectTo)}`
    : '/login'

  if (process.env.NEXT_PUBLIC_COHORT_LAUNCH_ENABLED !== 'true' && !redirectTo) {
    return (
      <main className={styles.page}>
        <section className={styles.panel}>
          <div className={styles.copy}>
            <p className={`${styles.eyebrow} text-label`}>Private Alpha</p>
            <h2 className={`${styles.heading} text-display`}>
              Somni is currently in a closed trial.
            </h2>
            <p className={`${styles.body} text-body`}>
              We are not accepting new public signups at this time. If you have an invitation from an existing user, please follow the link in your email.
            </p>
            <p className={styles.meta}>
              Already have an account? <Link href={loginHref}>Sign in</Link>
            </p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.copy}>
          <p className={`${styles.eyebrow} text-label`}>Start with support</p>
          <h2 className={`${styles.heading} text-display`}>
            Build your baby&apos;s sleep profile in a few calm steps.
          </h2>
          <p className={`${styles.body} text-body`}>
            Somni is designed to feel reassuring, not overwhelming. Create your
            account to begin onboarding and shape the coaching around your
            baby&apos;s age, rhythm, and sleep style.
          </p>
          <p className={styles.meta}>
            Already have an account? <Link href={loginHref}>Sign in</Link>
          </p>
        </div>

        <AuthForm
          action={signupAction}
          title="Create your account"
          subtitle="We'll take you straight into onboarding once you're in."
          submitLabel="Create account"
          mode="signup"
          redirectTo={redirectTo}
        />
      </section>
    </main>
  )
}
