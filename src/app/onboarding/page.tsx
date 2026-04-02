import { redirect } from 'next/navigation'
import { OnboardingForm } from '@/components/onboarding/OnboardingForm'
import { createClient } from '@/lib/supabase/server'
import styles from './page.module.css'

export default async function OnboardingPage() {
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

  if (profile?.onboarding_completed) {
    redirect('/dashboard')
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Onboarding</p>
          <h1 className={styles.heading}>
            A few simple details now make the guidance feel much more useful later.
          </h1>
          <p className={styles.body}>
            We&apos;ll shape Somni around your baby&apos;s age, your biggest sleep
            challenge, and the style of support that feels right for your family.
          </p>
        </div>

        <OnboardingForm />
      </section>
    </main>
  )
}
