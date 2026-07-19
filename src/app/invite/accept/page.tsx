import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { acceptInviteAction } from '@/app/profile/actions'
import styles from './page.module.css'

type PageProps = {
  searchParams: Promise<{ id?: string; token?: string }>
}

export default async function AcceptInvitePage(props: PageProps) {
  const searchParams = await props.searchParams
  const shareId = searchParams.id
  const token = searchParams.token

  if (!shareId || !token) {
    return (
      <main className={styles.page}>
        <section className={`${styles.card} card`}>
          <p className={`${styles.eyebrow} text-label`}>Invitation</p>
          <h1 className={`${styles.title} text-display`}>Invalid Link</h1>
          <p className={`${styles.body} text-body`}>
            This invitation link is missing the required identifier or security token.
          </p>
          <div className={styles.actions}>
            <Link className="btn-primary" href="/dashboard">
              Go to Dashboard
            </Link>
          </div>
        </section>
      </main>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If user is not authenticated, show instructions with a sign-in redirect
  if (!user) {
    // We cannot query the share yet because RLS prevents unauthenticated users from reading baby_shares.
    // Instead, we show a generic sign-in prompt and preserve the redirect.
    const redirectUrl = `/login?redirectTo=${encodeURIComponent(`/invite/accept?id=${shareId}&token=${token}`)}`
    const signupUrl = `/signup?redirectTo=${encodeURIComponent(`/invite/accept?id=${shareId}&token=${token}`)}`
    
    return (
      <main className={styles.page}>
        <section className={`${styles.card} card`}>
          <p className={`${styles.eyebrow} text-label`}>Invitation</p>
          <h1 className={`${styles.title} text-display`}>Join a care team</h1>
          <p className={`${styles.body} text-body`}>
            You have been invited to help manage sleep plans and logs on Somni.
          </p>
          <p className={`${styles.body} text-body`}>
            To accept this invitation, please sign in or create an account.
          </p>
          <div className={styles.actions}>
            <Link className="btn-primary" href={redirectUrl}>
              Sign in to accept
            </Link>
            <Link className="btn-secondary" href={signupUrl}>
              Create an account
            </Link>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <section className={`${styles.card} card`}>
        <p className={`${styles.eyebrow} text-label`}>Invitation</p>
        <h1 className={`${styles.title} text-display`}>Accept invitation</h1>
        <p className={`${styles.body} text-body`}>
          A parent has invited you to join their baby&apos;s Somni care team.
        </p>
        <p className={`${styles.body} text-body`}>
          Somni validates the private link, its expiry, and your signed-in email only when
          you accept. This keeps pending family details hidden from other accounts.
        </p>
        
        <form className={styles.actions} action={acceptInviteAction}>
          <input type="hidden" name="shareId" value={shareId} />
          <input type="hidden" name="token" value={token} />
          <button className="btn-primary" type="submit">
            Accept Invitation
          </button>
          <Link className="btn-secondary" href="/dashboard">
            Decline
          </Link>
        </form>
      </section>
    </main>
  )
}
