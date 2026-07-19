'use client'

import { useEffect, useState } from 'react'
import styles from './LiveChatDemo.module.css'

export function LiveChatDemo() {
  const [step, setStep] = useState(3)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    const timeouts = [
      { step: 4, delay: 4000 },
      { step: 5, delay: 5500 },
      { step: 6, delay: 8000 },
    ].map(({ step: nextStep, delay }) =>
      setTimeout(() => setStep(nextStep), delay)
    )

    return () => timeouts.forEach(clearTimeout)
  }, [])

  return (
    <div className={styles.chatContainer}>
      <div className={styles.chatHeader}>
        <span className={styles.chatLabel}>Live Coach Session</span>
        <span className={styles.chatTime}>3:24 PM</span>
      </div>

      <div className={`${styles.message} ${styles.user}`}>
        <div className={styles.bubble}>
          Elly&apos;s second nap ended at 3:20 pm. What should I do with bedtime?
        </div>
        <div className={styles.metadata}>Kate · 3:24 PM</div>
      </div>

      <div className={`${styles.message} ${styles.bot}`}>
        <div className={styles.bubble}>
          <p>
            Based on Elly&apos;s 6-month profile and today&apos;s two short naps, start
            the wind-down around 6:30 pm and aim for sleep near 7:00.
          </p>
          <p>
            If she is rubbing her eyes or getting fussy, move 15 minutes earlier.
            You do not need to stretch a distressed baby just to hit the clock.
          </p>
          <div className={styles.sourceBadge}>
            <span className={styles.sourceBadgeIcon} aria-hidden="true">✓</span>
            Sources: Tresillian, Raising Children Network
          </div>
        </div>
        <div className={styles.metadata}>Somni · 3:24 PM</div>
      </div>

      {step >= 4 ? (
        <div className={`${styles.message} ${styles.user}`}>
          <div className={styles.bubble}>What if she wakes again after 30 minutes?</div>
          <div className={styles.metadata}>Kate · 3:25 PM</div>
        </div>
      ) : null}

      {step === 5 ? (
        <div className={`${styles.message} ${styles.bot}`}>
          <div className={`${styles.bubble} ${styles.typingIndicator}`}>
            <span /><span /><span />
          </div>
        </div>
      ) : null}

      {step >= 6 ? (
        <div className={`${styles.message} ${styles.bot}`}>
          <div className={styles.bubble}>
            <p>
              Treat that as a bedtime false start: keep the room dark, pause briefly,
              then use your usual calm settling steps.
            </p>
            <p>
              If she is hungry, feed responsively. When she is ready for sleep again,
              place her on her back in a clear, flat cot.
            </p>
            <div className={styles.sourceBadge}>
              <span className={styles.sourceBadgeIcon} aria-hidden="true">✓</span>
              Sources: Red Nose Australia, Raising Children Network
            </div>
          </div>
          <div className={styles.metadata}>Somni · 3:25 PM</div>
        </div>
      ) : null}
    </div>
  )
}
