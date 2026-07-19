import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ensureSubscriptionRecord, hasPremiumAccess } from '@/lib/billing/subscriptions'
import { CaregiverSettings } from '@/components/profile/CaregiverSettings'
import { NotificationSettings } from '@/components/profile/NotificationSettings'
import { BabyAndSleepSettings } from '@/components/profile/BabyAndSleepSettings'
import { DataPrivacyControls } from '@/components/profile/DataPrivacyControls'
import { LogoutButton } from '@/components/profile/LogoutButton'
import styles from './page.module.css'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'full_name, onboarding_completed, push_enabled, in_app_feed_enabled, night_suppression_enabled, suppression_start, suppression_end'
    )
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.onboarding_completed) {
    redirect('/onboarding')
  }

  const subscription = await ensureSubscriptionRecord({
    profileId: user.id,
    email: user.email ?? null,
  })

  const premium = hasPremiumAccess(subscription)

  const { data: ownedBaby } = await supabase
    .from('babies')
    .select('id, name, date_of_birth, biggest_issue, feeding_type, bedtime_range')
    .eq('profile_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  let onboardingPreferences = null
  if (ownedBaby) {
    const { data: prefs } = await supabase
      .from('onboarding_preferences')
      .select('sleep_style_label, typical_wake_time, day_structure, nap_pattern, night_feeds, schedule_preference')
      .eq('baby_id', ownedBaby.id)
      .maybeSingle()
    onboardingPreferences = prefs
  }

  interface DBShareRow {
    id: string
    email: string
    access_role: 'caregiver'
    status: 'pending' | 'accepted'
    profile_id: string | null
    profiles: {
      full_name: string | null
    } | null
  }

  let sharesData: DBShareRow[] = []
  if (ownedBaby) {
    const { data: shares } = await supabase
      .from('baby_shares')
      .select('id, email, access_role, status, profile_id, profiles(full_name)')
      .eq('baby_id', ownedBaby.id)
    sharesData = (shares as unknown as DBShareRow[]) || []
  }

  const formattedShares = sharesData.map((share) => ({
    id: share.id,
    email: share.email,
    access_role: share.access_role,
    status: share.status,
    profile_id: share.profile_id,
    fullName: share.profiles?.full_name ?? null,
  }))

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000'

  return (
    <main className={styles.page}>
      <section className={`${styles.card} card`}>
        <p className={`${styles.eyebrow} text-label`}>Profile</p>
        <h1 className={`${styles.heading} text-display`}>Account &amp; Settings</h1>

        <article className={`${styles.section} card`}>
          <h2 className={`${styles.sectionTitle} text-display`}>Identity</h2>
          <p className="text-body">
            <strong>Name:</strong> {profile.full_name || 'Not set'}
          </p>
          <p className="text-body">
            <strong>Email:</strong> {user.email || 'Not available'}
          </p>
        </article>

        <article className={`${styles.section} card`}>
          <h2 className={`${styles.sectionTitle} text-display`}>Plan</h2>
          <div className={styles.badgeRow}>
            <span className={premium ? styles.premiumBadge : styles.freeBadge}>
              {premium ? 'Premium' : 'Free'}
            </span>
            <span className="text-body">Status: {subscription.status}</span>
          </div>
          <p className="text-body">
            Manage your subscription and payment settings in billing.
          </p>
          <div className={styles.actions}>
            <Link className="btn-primary" href="/billing">
              Open billing
            </Link>
            <Link className="btn-secondary" href="/dashboard">
              Back to dashboard
            </Link>
          </div>
        </article>

        {ownedBaby && onboardingPreferences ? (
          <BabyAndSleepSettings
            baby={{
              id: ownedBaby.id,
              name: ownedBaby.name,
              dateOfBirth: ownedBaby.date_of_birth,
              biggestIssue: ownedBaby.biggest_issue || 'falling_asleep',
              feedingType: ownedBaby.feeding_type || 'breast',
              bedtimeRange: ownedBaby.bedtime_range || '7pm_8pm',
            }}
            preferences={{
              sleepStyleLabel: onboardingPreferences.sleep_style_label || 'balanced',
              typicalWakeTime: onboardingPreferences.typical_wake_time || '07:00',
              dayStructure: onboardingPreferences.day_structure || 'mostly_home_flexible',
              napPattern: onboardingPreferences.nap_pattern || 'mostly_3_naps',
              nightFeeds: onboardingPreferences.night_feeds ? 'yes' : 'no',
              schedulePreference: onboardingPreferences.schedule_preference || 'mix_of_cues_and_anchors',
            }}
          />
        ) : null}

        <NotificationSettings
          initialPreferences={{
            pushEnabled: profile.push_enabled,
            inAppFeedEnabled: profile.in_app_feed_enabled,
            nightSuppressionEnabled: profile.night_suppression_enabled,
            suppressionStart: profile.suppression_start,
            suppressionEnd: profile.suppression_end,
          }}
        />

        {ownedBaby ? (
          <CaregiverSettings
            babyId={ownedBaby.id}
            babyName={ownedBaby.name}
            shares={formattedShares}
            appUrl={appUrl}
          />
        ) : null}

        <article className={`${styles.section} card`}>
          <h2 className={`${styles.sectionTitle} text-display`}>Support &amp; Legal</h2>
          <p className="text-body">
            Need help? Contact support or read our privacy policies and terms of service.
          </p>
          <div className={styles.actions}>
            <Link className="btn-primary" href="/support">
              Contact Support
            </Link>
            <Link className="btn-secondary" href="/privacy">
              Privacy Policy
            </Link>
            <Link className="btn-secondary" href="/terms">
              Terms of Service
            </Link>
          </div>
        </article>

        <DataPrivacyControls babyId={ownedBaby?.id} />

        <article className={`${styles.section} card`}>
          <h2 className={`${styles.sectionTitle} text-display`}>Session</h2>
          <LogoutButton />
        </article>
      </section>
    </main>
  )
}
