'use client'

import Link from 'next/link'
import { useChatSession } from './useChatSession'
import { formatResetTime, formatText } from './chat-formatters'
import styles from './ChatCoach.module.css'

type ChatCoachProps = {
  babyName: string
  pageEyebrow: string
  pageTitle: string
  pageSubtitle: string
  billingEnabled: boolean
  hasPremiumAccess: boolean
  isReadOnly?: boolean
  billingDegradedReason?: string | null
}

export function ChatCoach({
  babyName,
  pageEyebrow,
  pageTitle,
  pageSubtitle,
  billingEnabled,
  hasPremiumAccess,
  isReadOnly = false,
  billingDegradedReason = null,
}: ChatCoachProps) {
  const {
    messages,
    draft,
    setDraft,
    isSending,
    error,
    limitState,
    planUpdate,
    billingAction,
    openCheckout,
    submitMessage,
  } = useChatSession({
    babyName,
    billingEnabled,
    isReadOnly,
  })

  return (
    <section className={styles.shell}>
      <section className={`${styles.headerCard} card`}>
        <p className={`${styles.headerEyebrow} text-label`}>{pageEyebrow}</p>
        <h1 className={`${styles.headerTitle} text-display`}>{pageTitle}</h1>
        <p className={`${styles.headerSubtitle} text-body`}>{pageSubtitle}</p>
        <p className={`${styles.headerQuota} text-body`}>
          {hasPremiumAccess ? 'Premium access active' : 'Free plan · 10 chats per day'}
        </p>
        <Link href="/dashboard" className={`${styles.backLink} text-body`}>
          &larr; Back to Dashboard
        </Link>
      </section>

      {billingDegradedReason ? (
        <section className={`${styles.systemNotice} card`}>
          <p className={`${styles.systemNoticeLabel} text-label`}>System notice</p>
          <p className={styles.systemNoticeBody}>{billingDegradedReason}</p>
        </section>
      ) : null}

      {limitState ? (
        <section className={`${styles.limitCard} card`}>
          <p className={`${styles.limitLabel} text-label`}>Daily limit reached</p>
          <h2 className={`${styles.limitTitle} text-display`}>You have used today&apos;s free chats.</h2>
          <p className={styles.limitBody}>{limitState.message}</p>
          <p className={styles.limitMeta}>
            Used {limitState.used} of {limitState.dailyLimit}. Resets{' '}
            {formatResetTime(limitState.resetAt, limitState.timezone)} ({limitState.timezone}).
          </p>
          <p className={styles.limitHint}>{limitState.upgradeHint}</p>

          <div className={styles.limitActions}>
            <button
              className="btn-primary"
              type="button"
              onClick={() => openCheckout('monthly')}
              disabled={!billingEnabled || billingAction !== null || isReadOnly}
            >
              {billingAction === 'monthly' ? 'Opening...' : 'Upgrade monthly'}
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => openCheckout('annual')}
              disabled={!billingEnabled || billingAction !== null || isReadOnly}
            >
              {billingAction === 'annual' ? 'Opening...' : 'Upgrade annual'}
            </button>
          </div>

          {!billingEnabled ? (
            <p className={styles.limitMeta}>
              Billing buttons will start working once Stripe is connected in the app environment.
            </p>
          ) : null}
        </section>
      ) : null}

      {planUpdate ? (
        <section className={`${styles.systemNotice} card`}>
          <p className={`${styles.systemNoticeLabel} text-label`}>Dashboard updated</p>
          <p className={styles.systemNoticeBody}>
            {planUpdate.message}
            {planUpdate.updatedAt
              ? ` Saved at ${new Date(planUpdate.updatedAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}.`
              : ''}
          </p>
        </section>
      ) : null}

      <div className={styles.thread} aria-live="polite">
        {messages.map((message) => (
          <article
            key={message.id}
            className={message.role === 'assistant' ? styles.assistantBubble : styles.userBubble}
          >
            <p className={`${styles.roleLabel} text-label`}>
              {message.role === 'assistant' ? 'Somni' : 'You'}
            </p>
            <p className={styles.messageText}>
              {message.content ? (
                formatText(message.content)
              ) : message.role === 'assistant' && isSending ? (
                <span className={styles.loadingDots}>
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              ) : (
                ''
              )}
            </p>

            {message.safetyNote ? <p className={styles.safetyNote}>{message.safetyNote}</p> : null}

            {message.sources && message.sources.length > 0 ? (
              <div className={styles.sources}>
                {Array.from(new Set(message.sources.map((source) => source.name)))
                  .slice(0, 2)
                  .map((name) => (
                    <span className={styles.sourceChip} key={name}>
                      {name}
                    </span>
                  ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <form className={styles.form} onSubmit={submitMessage}>
        <label className="sr-only" htmlFor="chat-message">
          {isReadOnly ? 'Chat temporarily read-only' : 'Ask Somni'}
        </label>
        <div className={styles.inputRow}>
          <textarea
            id="chat-message"
            className={styles.textarea}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={
              isReadOnly
                ? 'Chat is temporarily unavailable while billing reconnects.'
                : 'Example: We had three night wakes and short naps today. What should I try tonight?'
            }
            disabled={isSending || isReadOnly}
            required
          />
          <button
            className={`${styles.sendButton} ${isSending ? styles.sendButtonLoading : ''}`}
            type="submit"
            disabled={isSending || !draft.trim() || isReadOnly}
            aria-label={isSending ? 'Sending message' : 'Send message'}
          >
            {isSending ? null : '>'}
          </button>
        </div>
      </form>

      {error ? <p className={styles.error}>{error}</p> : null}
    </section>
  )
}
