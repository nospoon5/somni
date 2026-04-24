import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SupportForm } from '@/components/support/SupportForm'
import styles from './page.module.css'

export default async function SupportPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className={styles.page}>
      <section className={`${styles.card} card`}>
        <p className={`${styles.eyebrow} text-label`}>Support</p>
        <h1 className={`${styles.title} text-display`}>Tell us what happened, or share an idea.</h1>
        <p className={`${styles.lede} text-body`}>
          Somni is still in beta, so rough edges can happen. Tell us what you noticed,
          what you hoped would happen, and which screen you were on. If you saw an error
          message, include that too.
        </p>

        {user ? (
          <SupportForm />
        ) : (
          <div className={styles.signedOut}>
            <p>
              To keep spam low during beta, the support form is available once you&apos;re
              signed in.
            </p>
            <p className={styles.links}>
              <Link href="/login">Sign in</Link>
              {' | '}
              <Link href="/signup">Create an account</Link>
            </p>
          </div>
        )}
      </section>
    </main>
  )
}
