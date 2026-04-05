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
        <h1 className={`${styles.title} text-display`}>Report a bug or share feedback.</h1>
        <p className={`${styles.lede} text-body`}>
          This beta is still improving. If something feels off, tell us what happened and
          what you expected to see. It helps to include the screen you were on and any
          error message.
        </p>

        {user ? (
          <SupportForm />
        ) : (
          <div className={styles.signedOut}>
            <p>
              To help reduce spam during beta, support requests currently require a signed-in
              account.
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