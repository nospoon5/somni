import type { NextBestActionEngineInputs, NextBestActionRecommendation } from './types'
import { getTimeZoneParts, clockTimeToMinutes, formatClockTime } from '../date-utils'

const VERY_SHORT_NAP_MINUTES = 30;
const NIGHTTIME_START_HOUR = 19; // 7 PM
const NIGHTTIME_END_HOUR = 6; // 6 AM

function getMinutesFromISO(isoString: string, timezone: string): number {
  const parts = getTimeZoneParts(timezone, new Date(isoString));
  return parts.hour * 60 + parts.minute;
}

function getDurationMinutes(startIso: string, endIso: string): number {
  return Math.max(0, (new Date(endIso).getTime() - new Date(startIso).getTime()) / (1000 * 60));
}

export function calculateNextBestAction(inputs: NextBestActionEngineInputs): NextBestActionRecommendation {
  const currentMinutes = getMinutesFromISO(inputs.currentTime, inputs.timezone);
  
  // 1. Safety Rules (Placeholder for future actual safety checks)
  
  // 2. Active Sleep (ongoing)
  if (inputs.activeSleep) {
    const sleepDuration = getDurationMinutes(inputs.activeSleep.startedAt, inputs.currentTime);
    if (sleepDuration > 120 && !inputs.activeSleep.isNight) {
      return {
        state: 'do_this_next',
        actionTitle: 'Time to wake up',
        targetTime: null,
        window: null,
        shortRationale: `This nap has reached 2 hours. Waking them now protects tonight's sleep.`,
        confidence: 'high',
        expiry: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        allowedActions: ['end_sleep']
      }
    }
    return {
      state: 'watch_for_this',
      actionTitle: 'Baby is sleeping',
      targetTime: null,
      window: null,
      shortRationale: `Asleep for ${Math.floor(sleepDuration / 60)}h ${Math.floor(sleepDuration % 60)}m. Enjoy the break!`,
      confidence: 'high',
      expiry: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      allowedActions: ['end_sleep']
    }
  }

  // 3. Pending Rescue (unconfirmed)
  if (inputs.pendingRescue && inputs.pendingRescue.sleepTargets && inputs.pendingRescue.sleepTargets.length > 0) {
    return {
      state: 'log_or_confirm',
      actionTitle: 'Accept schedule rescue?',
      targetTime: null,
      window: null,
      shortRationale: inputs.pendingRescue.rationale || 'Your recent sleep log suggests adjusting the rest of the day.',
      confidence: 'medium',
      expiry: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      allowedActions: ['accept_rescue', 'dismiss']
    }
  }

  // 4. Overdue Actions & Missing Logs
  if (inputs.todaysAcceptedPlan && inputs.todaysAcceptedPlan.sleepTargets.length > 0) {
    const unloggedTargets = inputs.todaysAcceptedPlan.sleepTargets.filter(target => {
      if (!target.targetTime) return false;
      const targetMins = clockTimeToMinutes(target.targetTime);
      if (targetMins === null) return false;
      // if target time is in the past by > 30 mins
      return currentMinutes > targetMins + 30;
    });

    if (unloggedTargets.length > 0) {
      // Pick the earliest overdue target
      const overdue = unloggedTargets[0];
      return {
        state: 'log_or_confirm',
        actionTitle: `Did ${overdue.label.toLowerCase()} happen?`,
        targetTime: overdue.targetTime,
        window: null,
        shortRationale: `We expected ${overdue.label.toLowerCase()} around ${overdue.targetTime ? formatClockTime(overdue.targetTime) : ''}.`,
        confidence: 'high',
        expiry: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        allowedActions: ['log_missing_event']
      }
    }

    // 5. Next Planned Sleep
    const upcomingTargets = inputs.todaysAcceptedPlan.sleepTargets.filter(target => {
      if (!target.targetTime) return false;
      const targetMins = clockTimeToMinutes(target.targetTime);
      if (targetMins === null) return false;
      // Between now and next 90 mins
      return targetMins >= currentMinutes && targetMins <= currentMinutes + 90;
    });

    if (upcomingTargets.length > 0) {
      const next = upcomingTargets[0];
      const isBedtime = next.label.toLowerCase().includes('bedtime');
      return {
        state: 'do_this_next',
        actionTitle: isBedtime ? 'Start the wind-down' : `Prepare for ${next.label.toLowerCase()}`,
        targetTime: next.targetTime,
        window: next.window,
        shortRationale: `Target time is ${next.targetTime ? formatClockTime(next.targetTime) : 'coming up'}.`,
        confidence: 'high',
        expiry: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        allowedActions: ['start_sleep']
      }
    }
  }

  // 6. Very Short Nap Logic
  if (inputs.latestCompletedSleep && !inputs.latestCompletedSleep.isNight) {
    const napDuration = getDurationMinutes(inputs.latestCompletedSleep.startedAt, inputs.latestCompletedSleep.endedAt!);
    const timeSinceNap = getDurationMinutes(inputs.latestCompletedSleep.endedAt!, inputs.currentTime);
    
    if (napDuration <= VERY_SHORT_NAP_MINUTES && timeSinceNap < 120) {
      return {
        state: 'watch_for_this',
        actionTitle: 'Short nap recorded',
        targetTime: null,
        window: null,
        shortRationale: `That nap was only ${Math.floor(napDuration)} minutes. You may need an earlier bedtime tonight.`,
        confidence: 'medium',
        expiry: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        allowedActions: ['ask_somni', 'start_sleep']
      }
    }
  }

  // 7. Quiet Nighttime State
  const currentHour = getTimeZoneParts(inputs.timezone, new Date(inputs.currentTime)).hour;
  if (currentHour >= NIGHTTIME_START_HOUR || currentHour < NIGHTTIME_END_HOUR) {
    return {
      state: 'watch_for_this',
      actionTitle: 'Good night',
      targetTime: null,
      window: null,
      shortRationale: `Enjoy the quiet hours. Log any night wakes if they happen.`,
      confidence: 'high',
      expiry: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      allowedActions: ['start_sleep', 'log_missing_event']
    }
  }

  // 8. Default / Age Fallback
  return {
    state: 'do_this_next',
    actionTitle: 'Follow your baby\'s cues',
    targetTime: null,
    window: null,
    shortRationale: `We don't have a specific target right now. Watch for tired signs.`,
    confidence: 'low',
    expiry: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    allowedActions: ['start_sleep', 'ask_somni']
  }
}
