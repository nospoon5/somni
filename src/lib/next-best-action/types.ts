export type NextBestActionState = 'do_this_next' | 'watch_for_this' | 'log_or_confirm' | 'safety_redirect'

export type NextBestActionAllowedAction = 'start_sleep' | 'end_sleep' | 'log_missing_event' | 'accept_rescue' | 'update_plan' | 'ask_somni' | 'dismiss'

export type NextBestActionRecommendation = {
  state: NextBestActionState
  actionTitle: string
  targetTime: string | null
  window: string | null
  shortRationale: string
  confidence: 'low' | 'medium' | 'high'
  expiry: string
  allowedActions: NextBestActionAllowedAction[]
}

export type SleepLogSnapshot = {
  id: string
  startedAt: string
  endedAt: string | null
  isNight: boolean
  tags: string[]
}

export type PendingRescueTargetsSnapshot = {
  sleepTargets?: Array<{
    label: string
    targetTime: string | null
    window: string | null
    notes: string | null
  }>
  feedTargets?: Array<{
    label: string
    targetTime: string | null
    notes: string | null
  }>
  rationale?: string
}

export type NextBestActionEngineInputs = {
  currentTime: string
  timezone: string
  babyAgeWeeks: number | null
  
  activeSleep: SleepLogSnapshot | null
  latestCompletedSleep: SleepLogSnapshot | null
  todaysLogs: SleepLogSnapshot[]
  
  todaysAcceptedPlan: {
    sleepTargets: Array<{
      label: string
      targetTime: string | null
      window: string | null
    }>
    feedTargets: Array<{
      label: string
      targetTime: string | null
    }>
  } | null
  
  pendingRescue: PendingRescueTargetsSnapshot | null
  
  durableBaseline: {
    targetBedtime: string
    usualWakeTime: string
    targetNapCount: number
    wakeWindows: Array<{
      label: string
      minMinutes: number | null
      maxMinutes: number | null
    }>
  } | null
  
  onboardingConstraints: {
    dayStructure: string
  } | null
}
