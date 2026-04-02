import Link from 'next/link'
import { AuthForm } from '@/components/auth/AuthForm'
import { loginAction } from '@/app/auth-actions'
import styles from '../auth-page.module.css'

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Welcome back</p>
          <h2 className={styles.heading}>Pick up where last night left off.</h2>
          <p className={styles.body}>
            Sign in to review sleep patterns, continue your chat, and keep
            tonight&apos;s plan grounded in your baby&apos;s real data.
          </p>
          <p className={styles.meta}>
            New here? <Link href="/signup">Create your account</Link>
          </p>
        </div>

        <AuthForm
          action={loginAction}
          title="Sign in"
          subtitle="A calm place to track sleep and get grounded guidance."
          submitLabel="Sign in"
          mode="login"
        />
      </section>
    </main>
  )
}
