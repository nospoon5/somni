const GENERIC_EMPATHY_OPENER_PATTERN =
  /^(?:it\s+is|it's)\s+(?:completely\s+)?understandable\b/i
const GENERIC_CLOSER_PATTERN =
  /\blet me know\b|\bwe can adjust\b|\b(?:perhaps\s+)?we can look at\b/i
const FORMULAIC_SUBJECT_OPENER_PATTERN =
  /^(?:your\s+baby|your\s+little\s+one|your\s+\d+(?:[- ](?:week|month|year))?[- ]old|the\s+baby)\s+is\s+(?:experiencing|becoming|showing|having)\b/i

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function firstSentence(text: string) {
  return text.trim().match(/^[\s\S]*?[.!?](?:\s|$)/)?.[0]?.trim() ?? text.trim()
}

export function getPremiumVoiceViolations(text: string, babyName: string) {
  const stripped = text.trim()
  if (!stripped) {
    return ['empty_response']
  }

  const violations: string[] = []
  const childName = babyName.trim()
  const wordCount = stripped.split(/\s+/).length

  if (wordCount > 200) {
    violations.push('over_200_words')
  }

  if (GENERIC_EMPATHY_OPENER_PATTERN.test(stripped)) {
    violations.push('generic_empathy_opener')
  }

  if (GENERIC_CLOSER_PATTERN.test(stripped)) {
    violations.push('generic_closer')
  }

  if (FORMULAIC_SUBJECT_OPENER_PATTERN.test(stripped)) {
    violations.push('formulaic_subject_opener')
  }

  const lower = stripped.toLowerCase()
  if (
    lower.includes('what to try') &&
    lower.includes('what compromise') &&
    lower.includes('check-in')
  ) {
    violations.push('full_template')
  }

  if (childName) {
    const escapedName = escapeRegExp(childName)
    const namePattern = new RegExp(`\\b${escapedName}\\b`, 'gi')
    const firstSentenceNamePattern = new RegExp(`\\b${escapedName}\\b`, 'i')
    const nameCount = stripped.match(namePattern)?.length ?? 0
    const nameLedPattern = new RegExp(
      `^${escapedName}\\s+(?:is\\s+(?:experiencing|most likely|showing|having|becoming)|has\\s+(?:developed|discovered))\\b`,
      'i'
    )

    if (nameCount > 1) {
      violations.push('baby_name_count')
    }
    if (firstSentenceNamePattern.test(firstSentence(stripped))) {
      violations.push('baby_name_in_first_sentence')
    }
    if (nameLedPattern.test(stripped)) {
      violations.push('formulaic_name_opener')
    }
  }

  return violations
}

export function normalizeBabyNamePlacement(text: string, babyName: string) {
  const childName = babyName.trim()
  if (!childName || !text.trim()) {
    return text
  }

  const escapedName = escapeRegExp(childName)
  const first = firstSentence(text)
  const firstNamePattern = new RegExp(`\\b${escapedName}\\b`, 'gi')
  const normalizedFirst = first.replace(firstNamePattern, (match, offset) =>
    offset === 0 ? 'Your baby' : 'your baby'
  )
  let normalized = `${normalizedFirst}${text.slice(first.length)}`
  let laterNameCount = 0

  normalized = normalized.replace(new RegExp(`\\b${escapedName}\\b`, 'gi'), (match) => {
    laterNameCount += 1
    return laterNameCount === 1 ? match : 'your baby'
  })

  return normalized.replace(
    /^(?:your\s+baby|your\s+little\s+one|your\s+\d+(?:[- ](?:week|month|year))?[- ]old|the\s+baby)\s+is\s+(?:experiencing|becoming|showing|having)\s+/i,
    'The main issue here is '
  )
}

export function removeBabyName(text: string, babyName: string) {
  const childName = babyName.trim()
  if (!childName) {
    return text
  }

  const namePattern = new RegExp(`\\b${escapeRegExp(childName)}\\b`, 'gi')
  return text.replace(namePattern, (match, offset) =>
    offset === 0 ? 'Your baby' : 'your baby'
  )
}
