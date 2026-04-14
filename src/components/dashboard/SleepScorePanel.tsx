import type { SleepScoreSummary } from '../../lib/scoring/sleep-score'

type SleepScorePanelProps = {
  sleepScore: SleepScoreSummary | null
  hasActiveSleep: boolean
  styles: Record<string, string>
}

export function SleepScorePanel({
  sleepScore,
  hasActiveSleep,
  styles,
}: SleepScorePanelProps) {
  return (
    <div className={`${styles.scorePanel} card-glass animate-fade-up`}>
      <div className={styles.scoreHeader}>
        <div>
          <p className={`${styles.scoreKicker} text-label`}>Sleep score</p>
          <h2 className={`${styles.scoreTitle} text-display`}>
            {sleepScore?.hasScore
              ? `${sleepScore.totalScore}/100`
              : sleepScore?.dataState === 'sparse'
                ? 'Learning your rhythm'
                : hasActiveSleep
                  ? 'Sleep in progress'
                  : 'Ready when you are'}
          </h2>
        </div>
        <span className={styles.scoreBadge}>{sleepScore?.statusLabel ?? 'No score yet'}</span>
      </div>

      {sleepScore?.hasScore ? (
        <>
          <p className={styles.scoreBody}>
            Strongest area: <strong>{sleepScore.strongestArea}</strong>
            {' | '}
            Biggest challenge: <strong>{sleepScore.biggestChallenge}</strong>
          </p>
          <p className={styles.scoreBody}>{sleepScore.explanation}</p>
          <p className={styles.scoreFocus}>
            <span className="text-label">Tonight&apos;s focus</span>
            {sleepScore.tonightFocus}
          </p>

          <div className={styles.metricGrid}>
            <article className={`${styles.metricCard} card animate-fade-up`}>
              <span className="text-label">Night sleep</span>
              <strong className="text-data">{sleepScore.breakdown.nightSleep}/100</strong>
            </article>
            <article className={`${styles.metricCard} card animate-fade-up`}>
              <span className="text-label">Day sleep</span>
              <strong className="text-data">{sleepScore.breakdown.daySleep}/100</strong>
            </article>
            <article className={`${styles.metricCard} card animate-fade-up`}>
              <span className="text-label">Total sleep</span>
              <strong className="text-data">{sleepScore.breakdown.totalSleep}/100</strong>
            </article>
            <article className={`${styles.metricCard} card animate-fade-up`}>
              <span className="text-label">Settling</span>
              <strong className="text-data">{sleepScore.breakdown.settling}/100</strong>
            </article>
          </div>

          <p className={styles.scoreMeta}>
            Age band: {sleepScore.ageBand} | Observed {sleepScore.observedSleepHours}h across{' '}
            {sleepScore.coverageDays} covered day{sleepScore.coverageDays === 1 ? '' : 's'} in
            the last 7 days | Target {sleepScore.targetSleepHours}h/day
          </p>
        </>
      ) : sleepScore?.dataState === 'sparse' ? (
        <>
          <p className={styles.scoreBody}>{sleepScore.explanation}</p>
          <p className={styles.scoreFocus}>
            <span className="text-label">Best next step tonight</span>
            {sleepScore.tonightFocus}
          </p>

          <div className={styles.questionCard}>
            <span className="text-label">Questions that will sharpen Somni&apos;s read</span>
            <ul className={styles.questionList}>
              {sleepScore.clarifyingQuestions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </div>

          <p className={styles.scoreMeta}>
            Age band: {sleepScore.ageBand} | {sleepScore.logCount} log
            {sleepScore.logCount === 1 ? '' : 's'} across {sleepScore.coverageDays} covered day
            {sleepScore.coverageDays === 1 ? '' : 's'} | Observed {sleepScore.observedSleepHours}
            h so far
          </p>
        </>
      ) : (
        <>
          <p className={styles.scoreBody}>
            {hasActiveSleep
              ? 'When you end the current sleep session, Somni will start building a simple, fair score from your real sleep history.'
              : 'Log your first sleep and Somni will build a fair score from real history, not guesses.'}
          </p>

          <div className={styles.emptySteps} aria-label="Getting started steps">
            <div className={`${styles.step} card`}>
              <span className={styles.stepNumber}>1</span>
              <div className={styles.stepBody}>
                <strong>Log the next sleep</strong>
                <span>
                  Tap <em>Log sleep</em>, then press Start when sleep begins and End when your
                  baby wakes.
                </span>
              </div>
            </div>
            <div className={`${styles.step} card`}>
              <span className={styles.stepNumber}>2</span>
              <div className={styles.stepBody}>
                <strong>Add optional tags</strong>
                <span>
                  If it helps later, add a quick tag like <em>feed</em> or <em>resettle</em>. Skip
                  it if you are tired.
                </span>
              </div>
            </div>
            <div className={`${styles.step} card`}>
              <span className={styles.stepNumber}>3</span>
              <div className={styles.stepBody}>
                <strong>Ask Somni one focused question</strong>
                <span>
                  Best format: baby age + what happened + what you have tried + what you want to
                  change.
                </span>
              </div>
            </div>
          </div>

          <p className={styles.emptyTip}>
            Tip: close enough is good enough. A few honest logs are far more helpful than perfect
            timestamps.
          </p>
        </>
      )}
    </div>
  )
}
