import Link from 'next/link'
import { AuthForm } from '@/components/auth/AuthForm'
import { signupAction } from '@/app/auth-actions'
import styles from '../auth-page.module.css'

export default function SignupPage() {
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Start with support</p>
          <h2 className={styles.heading}>
            Build your baby&apos;s sleep profile in a few calm steps.
          </h2>
          <p className={styles.body}>
            Somni is designed to feel reassuring, not overwhelming. Create your
            account to begin onboarding and shape the coaching around your
            baby&apos;s age, rhythm, and sleep style.
          </p>
          <p className={styles.meta}>
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </div>

        <AuthForm
          action={signupAction}
          title="Create your account"
          subtitle="We&apos;ll take you straight into onboarding once you&apos;re in."
          submitLabel="Create account"
          mode="signup"
        />
      </section>
    </main>
  )
}
