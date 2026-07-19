import Link from 'next/link'
import { AuthForm } from '@/components/auth/AuthForm'
import { loginAction } from '@/app/auth-actions'
import styles from '../auth-page.module.css'
import { sanitizeInviteRedirect } from '@/lib/auth/redirect'

type LoginPageProps = {
  searchParams: Promise<{ redirectTo?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const redirectTo = sanitizeInviteRedirect((await searchParams).redirectTo)
  const signupHref = redirectTo
    ? `/signup?redirectTo=${encodeURIComponent(redirectTo)}`
    : '/signup'

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.copy}>
          <p className={`${styles.eyebrow} text-label`}>Welcome back</p>
          <h2 className={`${styles.heading} text-display`}>Pick up where last night left off.</h2>
          <p className={`${styles.body} text-body`}>
            Sign in to review sleep patterns, continue your chat, and keep
            tonight&apos;s plan grounded in your baby&apos;s real data.
          </p>
          <p className={styles.meta}>
            New here? <Link href={signupHref}>Create your account</Link>
          </p>
        </div>

        <AuthForm
          action={loginAction}
          title="Sign in"
          subtitle="A calm place to track sleep and get grounded guidance."
          submitLabel="Sign in"
          mode="login"
          redirectTo={redirectTo}
        />
      </section>
    </main>
  )
}
