'use client'

import { useState, useEffect } from 'react'
import styles from './LiveChatDemo.module.css'

export function LiveChatDemo() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const sequence = [
      { step: 1, delay: 1000 },     // Show user message 1
      { step: 2, delay: 2500 },    // Show bot typing 1
      { step: 3, delay: 5500 },    // Show bot message 1
      { step: 4, delay: 8500 },    // Show user message 2
      { step: 5, delay: 10000 },    // Show bot typing 2
      { step: 6, delay: 13000 },    // Show bot message 2
    ]

    const timeouts = sequence.map(seq => 
      setTimeout(() => setStep(seq.step), seq.delay)
    )

    return () => timeouts.forEach(clearTimeout)
  }, [])

  return (
    <div className={styles.chatContainer}>
      <div className={styles.chatHeader}>
        <span className={styles.chatLabel}>Live Coach Session</span>
        <span className={styles.chatTime}>2:14 AM</span>
      </div>

      {step >= 1 && (
        <div className={`${styles.message} ${styles.user}`}>
          <div className={styles.bubble}>
            Help! Elly still hasn&apos;t woken up for her night feed... should I wake her up?
          </div>
          <div className={styles.metadata}>Kate • 2:14 AM</div>
        </div>
      )}

      {step === 2 && (
        <div className={`${styles.message} ${styles.bot}`}>
          <div className={`${styles.bubble} ${styles.typingIndicator}`}>
            <span></span><span></span><span></span>
          </div>
        </div>
      )}

      {step >= 3 && (
        <div className={`${styles.message} ${styles.bot}`}>
          <div className={styles.bubble}>
            <p>Deep breaths, Kate! It&apos;s completely okay. At 6 months old, it&apos;s very normal for Elly to occasionally sleep through a feed.</p>
            <p>Since your logs show that she only took two short 30-minute naps today, her body is likely just catching up on some much-needed restorative sleep. Let her rest.</p>
            <p><em>(Tip: If you&apos;re feeling uncomfortably full, hand-expressing just enough for comfort is the way to go.)</em></p>
            <div className={styles.sourceBadge}>
              <span className={styles.sourceBadgeIcon}>🛡️</span>
              Sources: Australian Breastfeeding Association, Tresillian
            </div>
          </div>
          <div className={styles.metadata}>Somni • 2:15 AM</div>
        </div>
      )}

      {step >= 4 && (
        <div className={`${styles.message} ${styles.user}`}>
          <div className={styles.bubble}>
            Phew, okay thanks. Does this mean her first morning feed should be earlier now?
          </div>
          <div className={styles.metadata}>Kate • 2:16 AM</div>
        </div>
      )}

      {step === 5 && (
        <div className={`${styles.message} ${styles.bot}`}>
          <div className={`${styles.bubble} ${styles.typingIndicator}`}>
            <span></span><span></span><span></span>
          </div>
        </div>
      )}

      {step >= 6 && (
        <div className={`${styles.message} ${styles.bot}`}>
          <div className={styles.bubble}>
            <p>Not necessarily. Try to hold out for her usual 7:00 AM wake-up time so you don&apos;t accidentally shift her whole daytime schedule.</p>
            <p>If she wakes up starving a little earlier (say, 6:30 AM), it&apos;s totally fine to start the day then. Make sure you get some sleep yourself now! 🌙</p>
            <div className={styles.sourceBadge}>
              <span className={styles.sourceBadgeIcon}>🛡️</span>
              Sources: NSW Health, Karitane
            </div>
          </div>
          <div className={styles.metadata}>Somni • 2:16 AM</div>
        </div>
      )}
    </div>
  )
}
