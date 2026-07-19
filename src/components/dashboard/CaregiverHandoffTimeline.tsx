'use client'

import styles from './CaregiverHandoffTimeline.module.css'

export type TimelineEvent = {
  id: string
  timestamp: string
  description: string
  attribution?: string
}

type Props = {
  events: TimelineEvent[]
}

export function CaregiverHandoffTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className={styles.timeline}>
        <p className="text-body text-dim" style={{ textAlign: 'center', padding: 'var(--spacing-md)' }}>No recent activity to show.</p>
      </div>
    )
  }

  return (
    <div className={styles.timeline}>
      <h2 className="text-heading">Recent Activity</h2>
      <ul className={styles.eventList}>
        {events.map((event) => {
          const timeStr = new Date(event.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
          
          return (
            <li key={event.id} className={styles.eventItem}>
              <div className={styles.eventTime} suppressHydrationWarning>{timeStr}</div>
              <div className={styles.eventDetails}>
                <span className={styles.description}>{event.description}</span>
                {event.attribution && (
                  <span className={styles.attribution}>by {event.attribution}</span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
