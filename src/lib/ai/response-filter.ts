const SOUNDS_LIKE_PATTERN = /\bsounds\s+like\b/i
const STREAM_SAFE_TAIL_LENGTH = 48
const MEDICATION_PATTERN = /\b(?:panadol|paracetamol|ibuprofen|nurofen|medication|medicine|dose|dosage)\b/i
const MEDICATION_UNSAFE_PERMISSION_PATTERNS = [
  /\babsolutely\s+use\b/i,
  /\bdefinitely\s+use\b/i,
  /\byou\s+can\s+absolutely\b/i,
  /\byes,\s+you\s+can\b/i,
  /\bsafe\s+to\s+give\b/i,
]

const MEDICATION_BOUNDARY_RESPONSE =
  'Pain or illness can derail sleep, so pause sleep coaching while you work out whether pain relief is appropriate. Paracetamol/Panadol is commonly used in some situations, but only use it according to the label and the age/weight dosing instructions. If you are unsure, check with your GP, pharmacist, or child health nurse before giving medicine. Seek medical advice promptly if there are concerning symptoms such as fever, unusual drowsiness, poor feeding, breathing difficulty, dehydration signs, or your gut says something is not right. Once pain or illness is handled, use calm resettling and return to the sleep plan when your baby is well.'

function splitIntoSentences(text: string) {
  return text.match(/[^.!?]+[.!?]?/g) ?? [text]
}

export function hasMedicationContext(text: string) {
  return MEDICATION_PATTERN.test(text)
}

export function containsUnsafeMedicationPermission(text: string, contextText = '') {
  const combinedContext = `${contextText}\n${text}`
  if (!hasMedicationContext(combinedContext)) {
    return false
  }

  if (
    hasMedicationContext(contextText) &&
    MEDICATION_UNSAFE_PERMISSION_PATTERNS.some((pattern) => pattern.test(text))
  ) {
    return true
  }

  return splitIntoSentences(text).some(
    (sentence) =>
      MEDICATION_PATTERN.test(sentence) &&
      MEDICATION_UNSAFE_PERMISSION_PATTERNS.some((pattern) => pattern.test(sentence))
  )
}

export function getMedicationBoundaryResponse() {
  return MEDICATION_BOUNDARY_RESPONSE
}

export function filterResponse(text: string, contextText = ''): string {
  if (!text) {
    return text
  }

  const withoutLeadingOh = text.replace(/^(\s*)oh,\s*/i, '$1')
  const withoutSoundsLike = withoutLeadingOh
    .replace(/^(\s*)it\s+sounds\s+like\s+/i, '$1')
    .replace(/\bthat\s+sounds\s+like\b/gi, 'that points to')
    .replace(/\bthis\s+sounds\s+like\b/gi, 'this points to')
    .replace(/\bsounds\s+like\b/gi, 'points to')

  const medicationSafeText = containsUnsafeMedicationPermission(withoutSoundsLike, contextText)
    ? MEDICATION_BOUNDARY_RESPONSE
    : withoutSoundsLike

  const firstLetterIndex = medicationSafeText.search(/[A-Za-z]/)

  if (firstLetterIndex === -1) {
    return medicationSafeText
  }

  const firstLetter = medicationSafeText.charAt(firstLetterIndex)
  const capitalizedLetter = firstLetter.toUpperCase()

  if (firstLetter === capitalizedLetter) {
    return medicationSafeText
  }

  return (
    medicationSafeText.slice(0, firstLetterIndex) +
    capitalizedLetter +
    medicationSafeText.slice(firstLetterIndex + 1)
  )
}

export function containsForbiddenResponsePhrase(text: string, contextText = '') {
  return SOUNDS_LIKE_PATTERN.test(text) || containsUnsafeMedicationPermission(text, contextText)
}

function sanitizeStreamingText(text: string, isAtStart: boolean) {
  const withoutLeadingOh = isAtStart ? text.replace(/^(\s*)oh,\s*/i, '$1') : text
  const withoutSoundsLike = withoutLeadingOh
    .replace(/^(\s*)it\s+sounds\s+like\s+/i, '$1')
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
