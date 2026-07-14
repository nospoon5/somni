import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { acceptInviteAction } from '@/app/profile/actions'
import styles from './page.module.css'

type PageProps = {
  searchParams: Promise<{ id?: string }>
}

export default async function AcceptInvitePage(props: PageProps) {
  const searchParams = await props.searchParams
  const shareId = searchParams.id

  if (!shareId) {
    return (
      <main className={styles.page}>
        <section className={`${styles.card} card`}>
          <p className={`${styles.eyebrow} text-label`}>Invitation</p>
          <h1 className={`${styles.title} text-display`}>Invalid Link</h1>
          <p className={`${styles.body} text-body`}>
            This invitation link is missing the required identifier.
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

  // Fetch invitation details
  const { data: share, error: shareError } = await supabase
    .from('baby_shares')
    .select('id, email, status, baby_id, babies(name, profiles(full_name))')
    .eq('id', shareId)
    .maybeSingle()

  if (shareError || !share) {
    return (
      <main className={styles.page}>
        <section className={`${styles.card} card`}>
          <p className={`${styles.eyebrow} text-label`}>Invitation</p>
          <h1 className={`${styles.title} text-display`}>Invitation Not Found</h1>
          <p className={`${styles.body} text-body`}>
            This invitation does not exist, has expired, or has been revoked.
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

  const baby = share.babies as unknown as {
    name: string
    profiles: { full_name: string | null } | null
  } | null
  const inviterName = baby?.profiles?.full_name || 'A parent'
  const babyName = baby?.name || 'their baby'

  // If user is not authenticated, show instructions with a sign-in redirect
  if (!user) {
    const redirectUrl = `/login?redirectTo=/invite/accept?id=${shareId}`
    return (
      <main className={styles.page}>
        <section className={`${styles.card} card`}>
          <p className={`${styles.eyebrow} text-label`}>Invitation</p>
          <h1 className={`${styles.title} text-display`}>Join {babyName}&apos;s care team</h1>
          <p className={`${styles.body} text-body`}>
            {inviterName} has invited you to help manage sleep plans and logs for <strong>{babyName}</strong> on Somni.
          </p>
          <p className={`${styles.body} text-body`}>
            To accept this invitation, please sign in or create an account using your invited email address: <strong>{share.email}</strong>.
          </p>
          <div className={styles.actions}>
            <Link className="btn-primary" href={redirectUrl}>
              Sign in to accept
            </Link>
            <Link className="btn-secondary" href={`/signup?redirectTo=/invite/accept?id=${shareId}`}>
              Create an account
            </Link>
          </div>
        </section>
      </main>
    )
  }

  if (share.status === 'accepted') {
    redirect('/dashboard')
  }

  const isEmailMismatch = user.email?.toLowerCase() !== share.email.toLowerCase()

  if (isEmailMismatch) {
    return (
      <main className={styles.page}>
        <section className={`${styles.card} card`}>
          <p className={`${styles.eyebrow} text-label`}>Invitation Mismatch</p>
          <h1 className={`${styles.title} text-display`}>Wrong account</h1>
          <p className={`${styles.body} text-body`}>
            This invitation was sent to <strong>{share.email}</strong>, but you are signed in as <strong>{user.email}</strong>.
          </p>
          <p className={`${styles.body} text-body`}>
            Please sign out and sign back in with the correct email address to accept this invitation.
          </p>
          <div className={styles.actions}>
            <Link className="btn-primary" href="/profile">
              Go to Profile to Sign Out
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
          {inviterName} has invited you to help care for <strong>{babyName}</strong>.
        </p>
        <p className={`${styles.body} text-body`}>
          By accepting, you will be able to view and log sleep sessions, adjust schedules, and chat with Somni for {babyName}.
        </p>
        
        <form className={styles.actions} action={acceptInviteAction}>
          <input type="hidden" name="shareId" value={shareId} />
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
