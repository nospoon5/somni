const INCOMPLETE_SECTION_ENDINGS = ['check-in:', 'check in:', 'what to try tonight:', 'what']
const COMPLETE_TERMINAL_PUNCTUATION = /[.!?)"']$/
const LIST_ITEM_PATTERN = /^\s*(?:\d+\.|[-*])\s+/
const CHECK_IN_LINE_PATTERN = /^\s*check-?\s*in:/i
const DANGLING_FINAL_WORD_PATTERN =
  /\b(?:a|an|and|as|because|before|but|by|for|from|how|if|in|into|like|most|of|onto|or|that|the|this|to|when|where|which|while|who|why|with|without|find|temporarily)$/i

export function looksIncompleteAssistantResponse(text: string) {
  const stripped = text.trim()
  if (!stripped) {
    return true
  }

  const lower = stripped.toLowerCase()
  if (INCOMPLETE_SECTION_ENDINGS.some((ending) => lower.endsWith(ending))) {
    return true
  }

  const words = stripped.split(/\s+/)
  if (words.length < 12) {
    return true
  }

  if (COMPLETE_TERMINAL_PUNCTUATION.test(stripped)) {
    return false
  }

  const nonEmptyLines = stripped.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const lastLine = nonEmptyLines.at(-1)?.trim() ?? ''

  if (LIST_ITEM_PATTERN.test(lastLine)) {
    return true
  }

  // A missing full stop on a final check-in sentence is untidy, but not a true truncation.
  if (CHECK_IN_LINE_PATTERN.test(lastLine) && words.length >= 80) {
    return false
  }

  if (DANGLING_FINAL_WORD_PATTERN.test(stripped)) {
    return true
  }

  return words.length < 70
}

type CompleteFallbackOptions = {
  babyName?: string | null
  medicationContext?: boolean
}

export function buildCompleteFallbackResponse({
  babyName,
  medicationContext = false,
}: CompleteFallbackOptions = {}) {
  const childLabel = babyName?.trim() || 'your baby'
  const medicalBoundary = medicationContext
    ? [
        '',
        'Medication note:',
        'If pain relief or medicine is being considered, only use it according to the label and age/weight instructions. If you are unsure, check with your GP, pharmacist, or child health nurse before giving medicine.',
      ]
    : []

  return [
    'I want to keep this practical and safe rather than overcomplicate it.',
    '',
    'What to try tonight:',
    `1. Keep ${childLabel}'s next sleep attempt calm, dark, and predictable.`,
    '2. Offer comfort until things settle, then place your baby back down when they are calm.',
    '3. If crying escalates, illness symptoms appear, or something feels medically off, pause sleep coaching and seek appropriate medical advice.',
    ...medicalBoundary,
    '',
    "Check-in: Tell me what happened at the next wake or nap, and I'll help you adjust.",
  ].join('\n')
}
