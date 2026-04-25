'use client'

import { useActionState, useMemo, useState } from 'react'
import type { OnboardingState } from '@/app/onboarding/actions'
import { completeOnboardingAction } from '@/app/onboarding/actions'
import {
  dayStructureOptions,
  napPatternOptions,
  nightFeedOptions,
  schedulePreferenceOptions,
} from '@/lib/onboarding-preferences'
import styles from './OnboardingForm.module.css'

const initialState: OnboardingState = {}

const biggestIssueOptions = [
  { value: 'night_waking', label: 'Night waking' },
  { value: 'short_naps', label: 'Short naps' },
  { value: 'bedtime_battles', label: 'Bedtime battles' },
  { value: 'early_waking', label: 'Early morning waking' },
  { value: 'other', label: 'Something else' },
]

const feedingTypeOptions = [
  { value: 'breast', label: 'Breast' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'mixed', label: 'Mixed' },
]

const bedtimeRangeOptions = [
  { value: '6-7pm', label: '6-7pm' },
  { value: '7-8pm', label: '7-8pm' },
  { value: '8-9pm', label: '8-9pm' },
  { value: 'varies', label: 'Varies' },
]

const questionPrompts = [
  {
    title: 'Approach to progress',
    leftLabel: 'Very gentle, even if progress takes longer',
    rightLabel: 'Fastest progress, comfortable with a stricter approach',
  },
  {
    title: 'Routine preference',
    leftLabel: "Prefer flexible days and following baby's cues",
    rightLabel: 'Prefer a steady, predictable daily routine',
  },
  {
    title: 'Responsiveness vs. Structure',
    leftLabel: 'Prioritize high responsiveness and soothing',
    rightLabel: 'Prioritize structure and independent sleep',
  },
  {
    title: 'Pacing of changes',
    leftLabel: 'Small, gradual changes over time',
    rightLabel: 'A quick, comprehensive reset',
  },
  {
    title: 'Comfort with faster methods',
    leftLabel: 'Cautious, prefer to avoid fast methods',
    rightLabel: 'Ready to try faster methods if safe',
  },
]

function getLabelForScore(score: number) {
  if (score <= 3.9) {
    return 'Gentle'
  }

  if (score <= 6.9) {
    return 'Balanced'
  }

  return 'Fast-track'
}

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(
    completeOnboardingAction,
    initialState
  )
  const [step, setStep] = useState(0)
  const [babyName, setBabyName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [biggestIssue, setBiggestIssue] = useState('')
  const [feedingType, setFeedingType] = useState('')
  const [bedtimeRange, setBedtimeRange] = useState('')
  const [typicalWakeTime, setTypicalWakeTime] = useState('')
  const [dayStructure, setDayStructure] = useState('')
  const [napPattern, setNapPattern] = useState('')
  const [nightFeeds, setNightFeeds] = useState('')
  const [schedulePreference, setSchedulePreference] = useState('')
  const [questionScores, setQuestionScores] = useState([5, 5, 5, 5, 5])

  const stylePreview = useMemo(() => {
    const average =
      Math.round(
        (questionScores.reduce((total, score) => total + score, 0) / questionScores.length) * 10
      ) / 10

    return {
      score: average.toFixed(1),
      label: getLabelForScore(average),
    }
  }, [questionScores])

  const canContinueFromBasics =
    babyName.trim() &&
    dateOfBirth &&
    biggestIssue &&
    feedingType &&
    bedtimeRange &&
    typicalWakeTime &&
    dayStructure &&
    napPattern &&
    nightFeeds &&
    schedulePreference

  return (
    <form className={`${styles.form} card`} action={formAction}>
      <div className={styles.progressRow}>
        <span className={`${styles.progressStep} text-label`}>Step {step + 1} of 2</span>
        <div className={styles.dotTrack} aria-hidden="true">
          <span className={step === 0 ? styles.dotActive : styles.dot} />
          <span className={step === 1 ? styles.dotActive : styles.dot} />
        </div>
      </div>

      {step === 0 ? (
        <section className={styles.stepSection}>
          <h1 className={`${styles.title} text-display`}>Let&apos;s start with your baby&apos;s details.</h1>
          <p className={`${styles.subtitle} text-body`}>
            We only ask for the basics we need to make the coaching feel relevant,
            gentle, and grounded in your baby&apos;s age.
          </p>

          <div className={styles.fieldGrid}>
            <label className={styles.field}>
              <span>Baby name</span>
              <input
                value={babyName}
                onChange={(event) => setBabyName(event.target.value)}
                placeholder="Your baby's name"
              />
            </label>

            <label className={styles.field}>
              <span>Date of birth</span>
              <input
                value={dateOfBirth}
                onChange={(event) => setDateOfBirth(event.target.value)}
                type="date"
              />
            </label>

            <label className={styles.field}>
              <span>Biggest issue right now</span>
              <select
                value={biggestIssue}
                onChange={(event) => setBiggestIssue(event.target.value)}
              >
                <option value="">Select one</option>
                {biggestIssueOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Feeding type</span>
              <select
                value={feedingType}
                onChange={(event) => setFeedingType(event.target.value)}
              >
                <option value="">Select one</option>
                {feedingTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Typical bedtime</span>
              <select
                value={bedtimeRange}
                onChange={(event) => setBedtimeRange(event.target.value)}
              >
                <option value="">Select one</option>
                {bedtimeRangeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>What time does your baby usually start the day?</span>
              <small className={styles.helpText}>
                Pick the time you most often treat as the morning wake-up.
              </small>
              <input
                value={typicalWakeTime}
                onChange={(event) => setTypicalWakeTime(event.target.value)}
                type="time"
              />
            </label>

            <label className={styles.field}>
              <span>Which best matches most days right now?</span>
              <select
                value={dayStructure}
                onChange={(event) => setDayStructure(event.target.value)}
              >
                <option value="">Select one</option>
                {dayStructureOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>What does the nap pattern usually look like?</span>
              <select
                value={napPattern}
                onChange={(event) => setNapPattern(event.target.value)}
              >
                <option value="">Select one</option>
                {napPatternOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Are night feeds still part of most nights?</span>
              <small className={styles.helpText}>
                This helps us keep the first plan realistic. It does not force night weaning.
              </small>
              <select
                value={nightFeeds}
                onChange={(event) => setNightFeeds(event.target.value)}
              >
                <option value="">Select one</option>
                {nightFeedOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>How would you like the plan to feel?</span>
              <small className={styles.helpText}>
                This helps us adjust the pacing of the recommendations.
              </small>
              <select
                value={schedulePreference}
                onChange={(event) => setSchedulePreference(event.target.value)}
              >
                <option value="">Select one</option>
                {schedulePreferenceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.actions}>
            <button
              className="btn-primary"
              type="button"
              onClick={() => setStep(1)}
              disabled={!canContinueFromBasics}
            >
              Next
            </button>
          </div>
        </section>
      ) : (
        <section className={styles.stepSection}>
          <h1 className={`${styles.title} text-display`}>Now shape the coaching style.</h1>
          <p className={`${styles.subtitle} text-body`}>
            Somni will adapt to you as it gets to know you better. This is just a
            starting point to determine which coaching style suits your family best:
            gentle, balanced, or fast track. There is no right or wrong answer here.
          </p>

          <div className={styles.stylePreview}>
            <span className={styles.stylePreviewLabel}>Current style preview</span>
            <strong>
              {stylePreview.label} - {stylePreview.score}
            </strong>
          </div>

          <div className={styles.questionList}>
            {questionPrompts.map((question, index) => (
              <label className={`${styles.questionCard} card`} key={question.title}>
                <span className={styles.questionText}><strong>{question.title}</strong></span>
                <div className={styles.sliderLabels}>
                  <span>{question.leftLabel}</span>
                  <span className={styles.sliderLabelRight}>{question.rightLabel}</span>
                </div>
                <div className={styles.sliderRow}>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={questionScores[index]}
                    onChange={(event) =>
                      setQuestionScores((current) =>
                        current.map((score, scoreIndex) =>
                          scoreIndex === index ? Number(event.target.value) : score
                        )
                      )
                    }
                  />
                  <span className={styles.sliderValue}>{questionScores[index]}</span>
                </div>
              </label>
            ))}
          </div>

          {state.error ? <p className={styles.error}>{state.error}</p> : null}

          <div className={styles.actions}>
            <button className="btn-secondary" type="button" onClick={() => setStep(0)}>
              Back
            </button>
            <button className="btn-primary" type="submit" disabled={pending}>
              {pending ? 'Saving your profile...' : 'Finish onboarding'}
            </button>
          </div>
        </section>
      )}

      <input type="hidden" name="babyName" value={babyName} />
      <input type="hidden" name="dateOfBirth" value={dateOfBirth} />
      <input type="hidden" name="biggestIssue" value={biggestIssue} />
      <input type="hidden" name="feedingType" value={feedingType} />
      <input type="hidden" name="bedtimeRange" value={bedtimeRange} />
      <input type="hidden" name="typicalWakeTime" value={typicalWakeTime} />
      <input type="hidden" name="dayStructure" value={dayStructure} />
      <input type="hidden" name="napPattern" value={napPattern} />
      <input type="hidden" name="nightFeeds" value={nightFeeds} />
      <input type="hidden" name="schedulePreference" value={schedulePreference} />
      <input type="hidden" name="question1" value={questionScores[0]} />
      <input type="hidden" name="question2" value={questionScores[1]} />
      <input type="hidden" name="question3" value={questionScores[2]} />
      <input type="hidden" name="question4" value={questionScores[3]} />
      <input type="hidden" name="question5" value={questionScores[4]} />
    </form>
  )
}
