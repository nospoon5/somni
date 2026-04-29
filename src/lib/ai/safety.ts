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

const FEVER_PATTERN = /\b(?:fever|temperature|temp|high\s+temp|high\s+temperature|febrile)\b/i
const LETHARGY_PATTERN = /\b(?:lethargic|lethargy|limp|floppy|listless|unusually\s+drowsy|very\s+drowsy|barely\s+responding|not\s+responding\s+normally)\b/i
const PASSING_OUT_PATTERN = /\b(?:passing\s+out|passed\s+out|pass(?:es|ed)?\s+out|faint(?:ed|ing)?|black(?:ed|ing)\s+out|collapsed?)\b/i
const DIFFICULT_TO_WAKE_PATTERN = /\b(?:difficult|hard|impossible|can't|cannot|won't|wouldn't)\s+(?:to\s+)?(?:wake|rouse|arouse)\b/i
const BREATHING_DIFFICULTY_PATTERN = /\b(?:breathing\s+(?:difficulty|difficulties|trouble|hard|fast|rapid|labou?red)|struggling\s+to\s+breathe|working\s+hard\s+to\s+breathe|short\s+of\s+breath|not\s+breathing|stopped\s+breathing)\b/i
const BLUE_GREY_PATTERN = /\b(?:blue|grey|gray|dusky)\s+(?:lips?|skin|face|colour|color)\b|\b(?:turning|turned|looks?|looked)\s+(?:blue|grey|gray|dusky)\b/i
const DEHYDRATION_PATTERN = /\b(?:dehydrat(?:ed|ion)|no\s+wet\s+napp(?:y|ies)|dry\s+napp(?:y|ies)|very\s+dry\s+mouth|sunken\s+fontanelle|sunken\s+soft\s+spot|not\s+feeding|refus(?:ing|es)\s+(?:feeds?|milk)|can't\s+keep\s+(?:fluids|milk)\s+down)\b/i
const SEIZURE_PATTERN = /\b(?:seizure|fit|convulsion|convulsing)\b/i
const UNDER_THREE_MONTHS_PATTERN = /\b(?:under|younger\s+than|less\s+than)\s+3\s+months?\b|\b(?:newborn|[0-8]\s*weeks?\s+old|1\s*month\s+old|2\s*months?\s+old)\b/i

export type SafetyCheckResult = {
  isEmergency: boolean
  route: 'none' | 'crisis' | 'urgent_medical'
  safetyNote: string | null
}

export function checkUrgentMedicalRisk(message: string) {
  const hasFever = FEVER_PATTERN.test(message)

  return (
    (hasFever && LETHARGY_PATTERN.test(message)) ||
    (hasFever && PASSING_OUT_PATTERN.test(message)) ||
    DIFFICULT_TO_WAKE_PATTERN.test(message) ||
    BREATHING_DIFFICULTY_PATTERN.test(message) ||
    BLUE_GREY_PATTERN.test(message) ||
    DEHYDRATION_PATTERN.test(message) ||
    SEIZURE_PATTERN.test(message) ||
    (hasFever && UNDER_THREE_MONTHS_PATTERN.test(message))
  )
}

export function checkEmergencyRisk(message: string): SafetyCheckResult {
  const isUrgentMedical = checkUrgentMedicalRisk(message)
  if (isUrgentMedical) {
    return {
      isEmergency: true,
      route: 'urgent_medical',
      safetyNote:
        'This needs urgent medical advice now. Pause sleep coaching and focus on medical care.',
    }
  }

  const isEmergency = EMERGENCY_PATTERNS.some((pattern) => pattern.test(message))

  if (!isEmergency) {
    return {
      isEmergency: false,
      route: 'none',
      safetyNote: null,
    }
  }

  return {
    isEmergency: true,
    route: 'crisis',
    safetyNote:
      'This is urgent. Put the baby safely in the cot, step away, and call 000 now if anyone is at immediate risk.',
  }
}

export function getUrgentMedicalRedirectMessage() {
  return (
    'This needs urgent medical advice now. Fever with lethargy, passing out, being difficult to wake, breathing trouble, blue or grey colour, dehydration signs, or a seizure is not a normal sleep issue. ' +
    'Please contact urgent medical care today, such as your GP after-hours service, Healthdirect on 1800 022 222, or your nearest urgent care or emergency department. Call 000 now if your baby is difficult to wake, having breathing trouble, blue or grey, having a seizure, or you feel they are in immediate danger. ' +
    'Pause sleep coaching until your baby has been medically checked.'
  )
}

export function getEmergencyRedirectMessage(route: SafetyCheckResult['route'] = 'crisis') {
  if (route === 'urgent_medical') {
    return getUrgentMedicalRedirectMessage()
  }

  return (
    'I am really glad you reached out. Put the baby safely in the cot now, step away, and call for help before doing anything else. ' +
    'If anyone is at immediate risk, call 000 now. For urgent parent mental health support, call PANDA on 1300 726 306 or Lifeline on 13 11 14. ' +
    'Sleep coaching can wait until you and the baby are safe.'
  )
}
