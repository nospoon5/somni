const SOUNDS_LIKE_PATTERN = /\bsounds\s+like\b/i
const TOOL_PROTOCOL_LEAK_PATTERN =
  /```(?:json)?\s*[\s\S]*?(?:tool_code|update_sleep_plan_profile|function_call)[\s\S]*?```/i
const GENERIC_EMPATHY_OPENER_PATTERN =
  /^(?:it\s+is|it's)\s+(?:completely\s+)?understandable\b[^.!?]*[.!?]\s*/i
const STREAM_SAFE_TAIL_LENGTH = 48
const MEDICATION_PATTERN =
  /\b(?:panadol|paracetamol|acetaminophen|tylenol|ibuprofen|nurofen|melatonin|medication|medicine|supplements?|sleep\s+gumm(?:y|ies)|dose|dosage)\b/i
const MELATONIN_OR_SUPPLEMENT_PATTERN =
  /\b(?:melatonin|sleep\s+gumm(?:y|ies)|sleep\s+supplements?)\b/i
const UNSAFE_SLEEP_ENVIRONMENT_PATTERNS = [
  /\b(?:place|placing|put|leave|keep|position)\b[^.!?]{0,100}\b(?:worn\s+)?(?:t-?shirt|shirt|clothing|fabric)\b[^.!?]{0,100}\b(?:bassinet|cot|crib|sleep\s+space|near\s+(?:his|her|their|the)\s+head)\b/i,
  /\b(?:warm|warming|pre-?warm)\b[^.!?]{0,80}\b(?:bassinet|cot|crib|mattress|sheet)\b[^.!?]{0,80}\b(?:heat\s+pack|hot[- ]water\s+bottle)\b/i,
  /\b(?:place|put|leave|keep|use|add|allow)\b[^.!?]{0,100}\b(?:pillows?|blankets?|toys?|wedges?|positioners?|inclined?\s+(?:sleeper|surface)|weighted\s+(?:blanket|swaddle)|loose\s+(?:fabric|bedding))\b[^.!?]{0,100}\b(?:bassinet|cot|crib|sleep\s+space|mattress|with\s+(?:him|her|them))\b/i,
  /\b(?:safe|fine|okay)\b[^.!?]{0,60}\b(?:sleep\s+(?:face[- ]?down|prone|on\s+(?:the\s+)?(?:tummy|side))|bed[- ]?share|co[- ]?sleep)\b/i,
]
const SAFE_SLEEP_NEGATION_PATTERN =
  /\b(?:do\s+not|don't|never|remove|without|keep\s+(?:the\s+)?(?:cot|bassinet|sleep\s+space)\s+clear|no)\b/i
const MEDICATION_UNSAFE_PERMISSION_PATTERNS = [
  /\babsolutely\s+use\b/i,
  /\bdefinitely\s+use\b/i,
  /\byou\s+can\s+absolutely\b/i,
  /\byes,\s+you\s+can\b/i,
  /\bsafe\s+to\s+give\b/i,
  /\b(?:fine|okay|safe)\s+to\s+(?:give|use)\b/i,
  /\bit\s+(?:should|would)\s+be\s+(?:fine|okay|safe)\s+to\s+(?:give|use)\b/i,
  /\byou\s+(?:can|could|should|might)\s+(?:consider\s+|try\s+|reasonably\s+)?(?:giving|using)[^.!?]{0,50}\b(?:panadol|paracetamol|acetaminophen|tylenol|ibuprofen|nurofen|melatonin|medicine|medication|supplement|gumm(?:y|ies)|it|this)\b/i,
  /\b(?:i|we)\s+(?:recommend|suggest)\s+(?:giving|using)[^.!?]{0,50}\b(?:panadol|paracetamol|acetaminophen|tylenol|ibuprofen|nurofen|melatonin|medicine|medication|supplement|gumm(?:y|ies)|it|this)\b/i,
]
const NEGATED_MEDICATION_PERMISSION_PATTERNS = [
  /\b(?:can't|cannot|can\s+not|won't|wouldn't)\s+(?:confirm|say|tell\s+you|assure\s+you)[^.!?]{0,80}\bsafe\s+to\s+give\b/i,
  /\b(?:not|never)\s+(?:considered\s+)?(?:fine|okay|safe)\s+to\s+(?:give|use)\b/i,
]

const MEDICATION_BOUNDARY_RESPONSE =
  "You were right to check before giving medicine. I can't decide whether pain relief is appropriate for your baby, so follow the product label and age/weight instructions and check with your GP, pharmacist, or child health nurse if you are unsure before giving it. Seek medical advice promptly for concerning symptoms such as fever, unusual drowsiness, poor feeding, breathing difficulty, dehydration signs, or if your gut says something is not right. Pause sleep coaching while pain or illness is being handled."
const MELATONIN_BOUNDARY_RESPONSE =
  "You were right to check. Do not give melatonin, sleep gummies, or sleep supplements unless your child's GP or pharmacist has specifically recommended them. Babies and young children need individual clinical guidance here rather than a general sleep recommendation. Pause the supplement plan and address the sleep pattern without medication while you wait for that advice."
const SAFE_SLEEP_BOUNDARY_RESPONSE =
  'Contact-seeking is very common in the early months. For every sleep, place your baby on their back in their own bassinet or cot on a firm, flat, level mattress, and keep the sleep space clear - no clothing, heat packs, pillows, toys, or loose fabric. To make the transfer gentler, wait until their body relaxes, lower them feet-first and then bottom and head, and keep a steady hand on their chest for a moment. If you might fall asleep while holding them, put them down safely even if they protest and ask another adult for help if one is available.'
const ROLLING_SLEEP_BOUNDARY_RESPONSE =
  'Always place your baby on their back to sleep. Only if they can confidently roll both ways on their own can you leave them in the position they choose; if they cannot roll back independently, gently return them to their back.'
const ROLLING_CONTEXT_PATTERN = /\broll\w*\b[^.!?]{0,100}\b(?:tummy|stomach|face[- ]?down)\b|\b(?:tummy|stomach|face[- ]?down)\b[^.!?]{0,100}\broll\w*\b/i
const ROLLING_POSITION_PERMISSION_PATTERN =
  /\b(?:safe|fine|okay)\b[^.!?]{0,100}\b(?:sleep|leave|position)\b|\b(?:sleep|leave)\b[^.!?]{0,100}\b(?:safe|fine|okay)\b/i
const BOTH_WAYS_PATTERN = /\bboth\s+(?:ways|directions)\b/i

function splitIntoSentences(text: string) {
  return text.match(/[^.!?]+[.!?]?/g) ?? [text]
}

function repairOneWayRollingPermission(text: string, contextText = '') {
  if (!ROLLING_CONTEXT_PATTERN.test(`${contextText}\n${text}`)) {
    return text
  }

  return splitIntoSentences(text)
    .map((sentence) => {
      const permitsSleepPosition =
        /\broll\w*\b/i.test(sentence) &&
        /\b(?:tummy|stomach|position)\b/i.test(sentence) &&
        ROLLING_POSITION_PERMISSION_PATTERN.test(sentence)

      if (!permitsSleepPosition || BOTH_WAYS_PATTERN.test(sentence)) {
        return sentence
      }

      return `${sentence.match(/^\s*/)?.[0] ?? ''}${ROLLING_SLEEP_BOUNDARY_RESPONSE}`
    })
    .join('')
}

export function hasMedicationContext(text: string) {
  return MEDICATION_PATTERN.test(text)
}

function sentenceContainsUnsafeMedicationPermission(sentence: string) {
  if (NEGATED_MEDICATION_PERMISSION_PATTERNS.some((pattern) => pattern.test(sentence))) {
    return false
  }

  return MEDICATION_UNSAFE_PERMISSION_PATTERNS.some((pattern) => pattern.test(sentence))
}

export function containsUnsafeMedicationPermission(text: string, contextText = '') {
  const combinedContext = `${contextText}\n${text}`
  if (!hasMedicationContext(combinedContext)) {
    return false
  }

  return splitIntoSentences(text).some(
    (sentence) =>
      (hasMedicationContext(contextText) || MEDICATION_PATTERN.test(sentence)) &&
      sentenceContainsUnsafeMedicationPermission(sentence)
  )
}

export function containsUnsafeSleepEnvironmentAdvice(text: string) {
  return splitIntoSentences(text).some(
    (sentence) =>
      !SAFE_SLEEP_NEGATION_PATTERN.test(sentence) &&
      UNSAFE_SLEEP_ENVIRONMENT_PATTERNS.some((pattern) => pattern.test(sentence))
  )
}

export function getMedicationBoundaryResponse(contextText = '') {
  return MELATONIN_OR_SUPPLEMENT_PATTERN.test(contextText)
    ? MELATONIN_BOUNDARY_RESPONSE
    : MEDICATION_BOUNDARY_RESPONSE
}

export function filterResponse(text: string, contextText = ''): string {
  if (!text) {
    return text
  }

  const withoutToolProtocol = text
    .replace(
      /```(?:json)?\s*[\s\S]*?(?:tool_code|update_sleep_plan_profile|function_call)[\s\S]*?```/gi,
      ''
    )
    .trim()
  const withoutLeadingOh = withoutToolProtocol.replace(/^(\s*)oh,\s*/i, '$1')
  const withoutGenericEmpathy = withoutLeadingOh
    .replace(GENERIC_EMPATHY_OPENER_PATTERN, '')
    .replace(/^however,\s*/i, '')
  const withoutSoundsLike = withoutGenericEmpathy
    .replace(/\band\s+it\s+sounds\s+like\s+/gi, 'and ')
    .replace(/\bit\s+sounds\s+like\s+/gi, '')
    .replace(/\bthat\s+sounds\s+like\b/gi, 'that points to')
    .replace(/\bthis\s+sounds\s+like\b/gi, 'this points to')
    .replace(/\bsounds\s+like\b/gi, 'points to')
    .replace(
      /\byou\s+do(?:\s+not|n't)\s+need\s+to\s+(?:flip|roll|turn)\s+(?:him|her|them|your\s+baby)\s+back\s+(?:on)?to\s+(?:his|her|their|the)\s+tummy\s*[.!]?/gi,
      'If your baby wakes crying and cannot roll back independently, gently return them to their back.'
    )

  const rollingSafeText = repairOneWayRollingPermission(withoutSoundsLike, contextText)
  const medicationSafeText = containsUnsafeMedicationPermission(rollingSafeText, contextText)
    ? getMedicationBoundaryResponse(`${contextText}\n${withoutSoundsLike}`)
    : rollingSafeText
  const safeSleepText = containsUnsafeSleepEnvironmentAdvice(medicationSafeText)
    ? SAFE_SLEEP_BOUNDARY_RESPONSE
    : medicationSafeText

  const firstLetterIndex = safeSleepText.search(/[A-Za-z]/)

  if (firstLetterIndex === -1) {
    return safeSleepText
  }

  const firstLetter = safeSleepText.charAt(firstLetterIndex)
  const capitalizedLetter = firstLetter.toUpperCase()

  if (firstLetter === capitalizedLetter) {
    return safeSleepText
  }

  return (
    safeSleepText.slice(0, firstLetterIndex) +
    capitalizedLetter +
    safeSleepText.slice(firstLetterIndex + 1)
  )
}

export function containsForbiddenResponsePhrase(text: string, contextText = '') {
  return (
    SOUNDS_LIKE_PATTERN.test(text) ||
    TOOL_PROTOCOL_LEAK_PATTERN.test(text) ||
    containsUnsafeMedicationPermission(text, contextText) ||
    containsUnsafeSleepEnvironmentAdvice(text)
  )
}

function sanitizeStreamingText(text: string, isAtStart: boolean) {
  const withoutLeadingOh = isAtStart ? text.replace(/^(\s*)oh,\s*/i, '$1') : text
  const withoutGenericEmpathy = isAtStart
    ? withoutLeadingOh
        .replace(GENERIC_EMPATHY_OPENER_PATTERN, '')
        .replace(/^however,\s*/i, '')
    : withoutLeadingOh
  const withoutSoundsLike = withoutGenericEmpathy
    .replace(/\band\s+it\s+sounds\s+like\s+/gi, 'and ')
    .replace(/\bit\s+sounds\s+like\s+/gi, '')
    .replace(/\bthat\s+sounds\s+like\b/gi, 'that points to')
    .replace(/\bthis\s+sounds\s+like\b/gi, 'this points to')
    .replace(/\bsounds\s+like\b/gi, 'points to')

  if (!isAtStart) {
    return withoutSoundsLike
  }

  const firstLetterIndex = withoutSoundsLike.search(/[A-Za-z]/)
  if (firstLetterIndex === -1) {
    return withoutSoundsLike
  }

  const firstLetter = withoutSoundsLike.charAt(firstLetterIndex)
  if (firstLetter === firstLetter.toUpperCase()) {
    return withoutSoundsLike
  }

  return (
    withoutSoundsLike.slice(0, firstLetterIndex) +
    firstLetter.toUpperCase() +
    withoutSoundsLike.slice(firstLetterIndex + 1)
  )
}

export function createResponseTokenFilter(onToken: (token: string) => void) {
  let buffer = ''
  let hasEmitted = false

  return {
    push(token: string) {
      buffer += token
      buffer = sanitizeStreamingText(buffer, !hasEmitted)

      if (buffer.length <= STREAM_SAFE_TAIL_LENGTH) {
        return
      }

      const emitLength = buffer.length - STREAM_SAFE_TAIL_LENGTH
      const safeToken = buffer.slice(0, emitLength)
      buffer = buffer.slice(emitLength)

      if (safeToken) {
        hasEmitted = hasEmitted || safeToken.trim().length > 0
        onToken(safeToken)
      }
    },
    flush() {
      buffer = sanitizeStreamingText(buffer, !hasEmitted)
      if (buffer) {
        onToken(buffer)
      }
      buffer = ''
    },
  }
}
