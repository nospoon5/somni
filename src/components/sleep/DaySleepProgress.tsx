'use client'

import { useEffect, useState } from 'react'
import styles from './DaySleepProgress.module.css'

type DaySleepProgressProps = {
  targetMinutes: number
  loggedMinutes: number
  activeNapStart?: string | null
}

export function DaySleepProgress({
  targetMinutes,
  loggedMinutes,
  activeNapStart,
}: DaySleepProgressProps) {
  const [minuteTick, setMinuteTick] = useState(() => Math.floor(Date.now() / 60000))

  useEffect(() => {
    const interval = setInterval(() => {
      setMinuteTick(Math.floor(Date.now() / 60000))
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  const activeMinutes = (() => {
    if (!activeNapStart) {
      return 0
    }

    const start = new Date(activeNapStart).getTime()
    const now = minuteTick * 60000
    return Math.max(0, Math.floor((now - start) / 60000))
  })()

  const totalMinutes = loggedMinutes + activeMinutes
  const isOver = totalMinutes > targetMinutes
  const percentage = Math.min(100, Math.round((totalMinutes / Math.max(1, targetMinutes)) * 100))

  const formatMin = (mins: number) => {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  let statusText = `${formatMin(totalMinutes)} logged • ${formatMin(
    Math.max(0, targetMinutes - totalMinutes)
  )} left`
  let statusDesign = styles.statusNormal

  if (isOver) {
    statusText = `${formatMin(
      totalMinutes - targetMinutes
    )} over target. Cap this nap to protect tonight's sleep.`
    statusDesign = styles.statusOver
  } else if (percentage >= 90) {
    statusText = `Target reached! Perfect for today.`
    statusDesign = styles.statusSweetSpot
  }

  return (
    <div className={`${styles.container} card`}>
      <div className={styles.header}>
        <h2 className="text-body font-semibold">Daytime Sleep Budget</h2>
        <span className={styles.targetLabel}>Target: {formatMin(targetMinutes)}</span>
      </div>

      <div className={styles.track}>
        <div
          className={`${styles.fill} ${percentage >= 100 ? styles.fillOver : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <p className={`${styles.status} ${statusDesign} text-body`}>{statusText}</p>
    </div>
  )
}
