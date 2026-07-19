'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateBabyAndSleepSettingsAction } from '@/app/profile/actions'
import styles from './BabyAndSleepSettings.module.css'

type BabyAndSleepSettingsProps = {
  baby: {
    id: string
    name: string
    dateOfBirth: string
    biggestIssue: string
    feedingType: string
    bedtimeRange: string
  }
  preferences: {
    sleepStyleLabel: string
    typicalWakeTime: string
    dayStructure: string
    napPattern: string
    nightFeeds: string
    schedulePreference: string
  }
}

export function BabyAndSleepSettings({ baby, preferences }: BabyAndSleepSettingsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  // Form states
  const [babyName, setBabyName] = useState(baby.name)
  const [dateOfBirth, setDateOfBirth] = useState(baby.dateOfBirth)
  const [biggestIssue, setBiggestIssue] = useState(baby.biggestIssue)
  const [feedingType, setFeedingType] = useState(baby.feedingType)
  const [bedtimeRange, setBedtimeRange] = useState(baby.bedtimeRange)

  const [typicalWakeTime, setTypicalWakeTime] = useState(preferences.typicalWakeTime)
  const [dayStructure, setDayStructure] = useState(preferences.dayStructure)
  const [napPattern, setNapPattern] = useState(preferences.napPattern)
  const [nightFeeds, setNightFeeds] = useState(preferences.nightFeeds)
  const [schedulePreference, setSchedulePreference] = useState(preferences.schedulePreference)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    const formData = new FormData()
    formData.append('babyId', baby.id)
    formData.append('babyName', babyName)
    formData.append('dateOfBirth', dateOfBirth)
    formData.append('biggestIssue', biggestIssue)
    formData.append('feedingType', feedingType)
    formData.append('bedtimeRange', bedtimeRange)
    formData.append('typicalWakeTime', typicalWakeTime)
    formData.append('dayStructure', dayStructure)
    formData.append('napPattern', napPattern)
    formData.append('nightFeeds', nightFeeds)
    formData.append('schedulePreference', schedulePreference)

    startTransition(async () => {
      try {
        const res = await updateBabyAndSleepSettingsAction(formData)
        if (res.error) {
          setError(res.error)
        } else {
          setSuccess('Settings saved successfully.')
          router.refresh()
        }
      } catch {
        setError('Failed to save settings. Please try again.')
      }
    })
  }

  return (
    <article className={`${styles.section} card`}>
      <div className={styles.header} onClick={() => setIsOpen(!isOpen)}>
        <div>
          <h2 className={`${styles.sectionTitle} text-display`}>Baby &amp; Sleep Settings</h2>
          <p className={styles.subtitle}>Edit name, age, bedtime, and schedule preferences.</p>
        </div>
        <button 
          className={styles.toggleBtn} 
          type="button" 
          aria-expanded={isOpen}
          aria-label="Toggle Baby &amp; Sleep settings"
        >
          {isOpen ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {isOpen && (
        <form onSubmit={handleSubmit} className={`${styles.form} animate-fade-up`}>
          {error && <p className={styles.error} role="alert">{error}</p>}
          {success && <p className={styles.success} role="status">{success}</p>}

          <fieldset className={styles.group}>
            <legend className={`${styles.groupTitle} text-label`}>Baby details</legend>
            
            <label className={styles.field}>
              <span>Baby Name</span>
              <input 
                type="text" 
                value={babyName} 
                onChange={(e) => setBabyName(e.target.value)} 
                required 
                placeholder="Baby's name"
              />
            </label>

            <label className={styles.field}>
              <span>Date of Birth</span>
              <input 
                type="date" 
                value={dateOfBirth} 
                onChange={(e) => setDateOfBirth(e.target.value)} 
                required 
              />
            </label>

            <label className={styles.field}>
              <span>Biggest Issue</span>
              <select value={biggestIssue} onChange={(e) => setBiggestIssue(e.target.value)}>
                <option value="falling_asleep">Falling asleep</option>
                <option value="night_waking">Frequent night waking</option>
                <option value="short_naps">Short naps</option>
                <option value="early_waking">Early morning waking</option>
                <option value="routine_consistency">Routine consistency</option>
                <option value="something_else">Something else</option>
              </select>
            </label>

            <label className={styles.field}>
              <span>Feeding Type</span>
              <select value={feedingType} onChange={(e) => setFeedingType(e.target.value)}>
                <option value="breast">Breast feeding</option>
                <option value="formula">Formula feeding</option>
                <option value="both">Both breast &amp; formula</option>
                <option value="solids_and_milk">Solids &amp; milk</option>
              </select>
            </label>

            <label className={styles.field}>
              <span>Target Bedtime Window</span>
              <select value={bedtimeRange} onChange={(e) => setBedtimeRange(e.target.value)}>
                <option value="before_7pm">Before 7:00 pm</option>
                <option value="7pm_8pm">7:00 pm to 8:00 pm</option>
                <option value="8pm_9pm">8:00 pm to 9:00 pm</option>
                <option value="after_9pm">After 9:00 pm</option>
                <option value="varies">Varies night to night</option>
              </select>
            </label>
          </fieldset>

          <fieldset className={styles.group}>
            <legend className={`${styles.groupTitle} text-label`}>Coaching &amp; Plan Preferences</legend>

            <div className={styles.styleCard}>
              <span className="text-label">Learned Sleep Style</span>
              <strong>{preferences.sleepStyleLabel}</strong>
              <p className={styles.styleExplanation}>
                Determined during onboarding based on your response profile.
              </p>
            </div>

            <label className={styles.field}>
              <span>Typical Wake Time</span>
              <input 
                type="time" 
                value={typicalWakeTime} 
                onChange={(e) => setTypicalWakeTime(e.target.value)} 
                required 
              />
            </label>

            <label className={styles.field}>
              <span>Day Structure</span>
              <select value={dayStructure} onChange={(e) => setDayStructure(e.target.value)}>
                <option value="mostly_home_flexible">Mostly home &amp; flexible</option>
                <option value="mostly_home_structured">Mostly home &amp; structured</option>
                <option value="daycare">Daycare (rigid wake windows)</option>
                <option value="mix_of_home_and_daycare">Mix of home &amp; daycare</option>
              </select>
            </label>

            <label className={styles.field}>
              <span>Nap Pattern</span>
              <select value={napPattern} onChange={(e) => setNapPattern(e.target.value)}>
                <option value="mostly_4_naps">Mostly 4 naps</option>
                <option value="mostly_3_naps">Mostly 3 naps</option>
                <option value="mostly_2_naps">Mostly 2 naps</option>
                <option value="mostly_1_nap">Mostly 1 nap</option>
                <option value="catnaps_or_varies">Catnaps or varies</option>
              </select>
            </label>

            <label className={styles.field}>
              <span>Overnight Feeds</span>
              <select value={nightFeeds} onChange={(e) => setNightFeeds(e.target.value)}>
                <option value="yes">Yes, overnight feeds are normal</option>
                <option value="no">No overnight feeds</option>
                <option value="trying_to_wean">Trying to wean night feeds</option>
              </select>
            </label>

            <label className={styles.field}>
              <span>Schedule Flavor</span>
              <select value={schedulePreference} onChange={(e) => setSchedulePreference(e.target.value)}>
                <option value="cue_led">Fully cue led</option>
                <option value="clock_based">Strict clock based</option>
                <option value="mix_of_cues_and_anchors">Mix of cues &amp; anchors</option>
              </select>
            </label>
          </fieldset>

          <button className="btn-primary" type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      )}
    </article>
  )
}
