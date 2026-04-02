import { redirect } from 'next/navigation'
import { ChatCoach } from '@/components/chat/ChatCoach'
import { createClient } from '@/lib/supabase/server'
import styles from './page.module.css'

export default async function ChatPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.onboarding_completed) {
    redirect('/onboarding')
  }

  const { data: baby } = await supabase
    .from('babies')
    .select('name')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!baby) {
    redirect('/onboarding')
  }

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <p className={styles.eyebrow}>Chat</p>
        <h1 className={styles.heading}>Sleep coaching for {baby.name}</h1>
        <p className={styles.body}>
          Ask one question at a time and Somni will respond with calm, source-backed
          guidance in Australian English.
        </p>
      </section>

      <ChatCoach babyName={baby.name} />
    </main>
  )
}
