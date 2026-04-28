import 'server-only'

const EMERGENCY_PATTERNS = [
  /not\s+breathing/i,
  /stopped\s+breathing/i,
  /breathing\s+trouble/i,
  /blue\s+lips?/i,
  /turning\s+blue/i,
  /unresponsive/i,
  /passed\s+out/i,
  /seizure/i,
  /fit\b/i,
  /choking/i,
  /collapsed/i,
  /feel\s+like\s+shak(?:e|ing)\s+(?:him|her|them|the\s+baby)/i,
  /\bshak(?:e|ing)\s+(?:him|her|them|the\s+baby)\b/i,
  /\bpostpartum depression\b/i,
  /\bcan't\s+do\s+this\s+anymore\b/i,
  /\bcan'?t\s+do\s+this\s+anymore\b/i,
  /\bharm\s+(?:myself|him|her|them|the\s+baby)\b/i,
  /\bsuicid/i,
]

export type SafetyCheckResult = {
  isEmergency: boolean
  safetyNote: string | null
}

export function checkEmergencyRisk(message: string): SafetyCheckResult {
  const isEmergency = EMERGENCY_PATTERNS.some((pattern) => pattern.test(message))

  if (!isEmergency) {
    return {
      isEmergency: false,
      safetyNote: null,
    }
  }

  return {
    isEmergency: true,
    safetyNote:
      'This is urgent. Put the baby safely in the cot, step away, and call 000 now if anyone is at immediate risk.',
  }
}

export function getEmergencyRedirectMessage() {
  return (
    'I am really glad you reached out. Put the baby safely in the cot now, step away, and call for help before doing anything else. ' +
    'If anyone is at immediate risk, call 000 now. For urgent parent mental health support, call PANDA on 1300 726 306 or Lifeline on 13 11 14. ' +
    'Sleep coaching can wait until you and the baby are safe.'
  )
}
