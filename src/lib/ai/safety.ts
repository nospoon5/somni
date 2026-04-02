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
      'This sounds urgent. If your baby is having trouble breathing, is unresponsive, or is getting worse, call 000 now.',
  }
}

export function getEmergencyRedirectMessage() {
  return (
    'I am really glad you reached out. I cannot safely coach through this in chat. ' +
    'Please call 000 now if your baby has breathing trouble, looks blue, is unresponsive, or you feel this is an emergency. ' +
    'If it feels urgent but not immediately life-threatening, contact your GP, Healthdirect (1800 022 222), or your nearest emergency department now.'
  )
}
