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
          <p className={`${styles.eyebrow} text-label`}>Onboarding</p>
          <h1 className={`${styles.heading} text-display`}>
            A few simple details to help Somni tailor your baby&apos;s plan.
          </h1>
          <p className={`${styles.body} text-body`}>
            We ask these questions to tailor Somni to your baby&apos;s details and your parenting style.
          </p>
        </div>

        <OnboardingForm />
      </section>
    </main>
  )
}