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
  medicationBoundary?: string | null
}

export function buildCompleteFallbackResponse({
  babyName,
  medicationContext = false,
  medicationBoundary,
}: CompleteFallbackOptions = {}) {
  const childLabel = babyName?.trim() || 'your baby'

  if (medicationContext) {
    return [
      'I want to keep this clear and safe rather than guess.',
      medicationBoundary?.trim() ||
        "You were right to check before giving medicine. I can't decide whether it is appropriate for your baby, so follow the product label and age/weight instructions and check with your GP, pharmacist, or child health nurse if you are unsure before giving it.",
    ].join('\n\n')
  }

  return [
    'I want to answer this properly rather than guess after my last reply cut off.',
    `At the next sleep, what is the exact sticking point for ${childLabel}: settling, the transfer into the cot, or waking again soon after?`,
  ].join(' ')
}
