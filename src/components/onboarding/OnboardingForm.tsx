'use client'

import { useActionState, useMemo, useState } from 'react'
import type { OnboardingState } from '@/app/onboarding/actions'
import { completeOnboardingAction } from '@/app/onboarding/actions'
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
  'I want a very gentle approach, even if progress takes longer.',
  'I feel comfortable using a steady routine to shape sleep habits.',
  'I want the coaching to balance responsiveness with structure.',
  'I prefer gradual change over a sharp reset.',
  'I am ready for a faster approach if it feels reasonable and safe.',
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
    bedtimeRange

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
            Move the sliders toward what feels right for your family. There is no
            perfect answer here.
          </p>

          <div className={styles.stylePreview}>
            <span className={styles.stylePreviewLabel}>Current style preview</span>
            <strong>
              {stylePreview.label} - {stylePreview.score}
            </strong>
          </div>

          <div className={styles.questionList}>
            {questionPrompts.map((prompt, index) => (
              <label className={`${styles.questionCard} card`} key={prompt}>
                <span className={styles.questionText}>{prompt}</span>
                <div className={styles.sliderRow}>
                  <span>1</span>
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
                  <span>10</span>
                </div>
                <span className={styles.sliderValue}>{questionScores[index]}</span>
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
      <input type="hidden" name="question1" value={questionScores[0]} />
      <input type="hidden" name="question2" value={questionScores[1]} />
      <input type="hidden" name="question3" value={questionScores[2]} />
      <input type="hidden" name="question4" value={questionScores[3]} />
      <input type="hidden" name="question5" value={questionScores[4]} />
    </form>
  )
}