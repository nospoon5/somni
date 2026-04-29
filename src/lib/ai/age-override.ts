export type QuestionStatedAge = {
  quantity: number
  unit: 'week' | 'month' | 'year'
  label: string
  adjectiveLabel: string
  normalizedDays: number
  ageBand: string
}

const EXPLICIT_AGE_PATTERNS = [
  /\b(\d{1,2})\s*[- ]?(week|weeks|month|months|year|years)\s*[- ]?old\b/i,
  /\b(\d{1,2})\s*(mo|m\s*\/\s*o)\b/i,
]

const AGE_REFERENCE_PATTERNS = [
  ...EXPLICIT_AGE_PATTERNS,
  /\b(\d{1,2})\s*[- ]?(week|weeks|month|months|year|years)\b/i,
]

function pluralize(quantity: number, unit: string) {
  return `${quantity} ${unit}${quantity === 1 ? '' : 's'}`
}

function normalizeUnit(unit: string): QuestionStatedAge['unit'] {
  const lowered = unit.toLowerCase().replace(/\s/g, '')

  if (lowered === 'mo' || lowered === 'm/o' || lowered.startsWith('month')) {
    return 'month'
  }

  if (lowered.startsWith('year')) {
    return 'year'
  }

  return 'week'
}

function ageToDays(quantity: number, unit: QuestionStatedAge['unit']) {
  if (unit === 'week') {
    return quantity * 7
  }

  if (unit === 'month') {
    return Math.round(quantity * 30.4375)
  }

  return Math.round(quantity * 365.25)
}

function getAgeBandFromDays(days: number) {
  const months = days / 30.4375

  if (months < 4) {
    return '0-3 months'
  }

  if (months < 7) {
    return '4-6 months'
  }

  if (months < 13) {
    return '6-12 months'
  }

  return '12 months+'
}

function buildQuestionStatedAge(quantity: number, unit: QuestionStatedAge['unit']) {
  const normalizedDays = ageToDays(quantity, unit)

  return {
    quantity,
    unit,
    label: pluralize(quantity, unit),
    adjectiveLabel: `${quantity}-${unit}-old`,
    normalizedDays,
    ageBand: getAgeBandFromDays(normalizedDays),
  }
}

function parseAgeMatch(match: RegExpMatchArray): QuestionStatedAge | null {
  const quantityText = match[1]
  const unitText = match[2]

  if (!quantityText || !unitText) {
    return null
  }

  const quantity = Number.parseInt(quantityText, 10)
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null
  }

  return buildQuestionStatedAge(quantity, normalizeUnit(unitText))
}

export function parseQuestionStatedAge(message: string): QuestionStatedAge | null {
  const text = message.trim()

  if (!text) {
    return null
  }

  if (/\bnewborn\b/i.test(text)) {
    return buildQuestionStatedAge(2, 'week')
  }

  for (const pattern of EXPLICIT_AGE_PATTERNS) {
    const match = text.match(pattern)
    const parsed = match ? parseAgeMatch(match) : null

    if (parsed) {
      return parsed
    }
  }

  return null
}

function getAgeReferenceMatches(text: string) {
  const matches: Array<{ age: QuestionStatedAge; start: number; end: number }> = []

  if (/\bnewborn\b/i.test(text)) {
    const match = text.match(/\bnewborn\b/i)
    if (match?.index !== undefined) {
      const age = buildQuestionStatedAge(2, 'week')
      matches.push({ age, start: match.index, end: match.index + match[0].length })
    }
  }

  for (const pattern of AGE_REFERENCE_PATTERNS) {
    const globalPattern = new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`)

    for (const match of text.matchAll(globalPattern)) {
      const parsed = parseAgeMatch(match)
      if (!parsed || match.index === undefined) {
        continue
      }

      matches.push({
        age: parsed,
        start: match.index,
        end: match.index + match[0].length,
      })
    }
  }

  return matches
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .filter((match, index, sortedMatches) => {
      const previous = sortedMatches[index - 1]
      return !previous || match.start >= previous.end
    })
}

function isCutoffOrRangeReference(text: string, start: number, end: number) {
  const before = text.slice(Math.max(0, start - 36), start).toLowerCase()
  const after = text.slice(end, Math.min(text.length, end + 36)).toLowerCase()
  const window = `${before}AGE${after}`

  return (
    /\d\s*-\s*$/.test(before) ||
    /(?:under|until|before|after|from|by|over|at least|younger than|older than|less than|more than)\s+AGE/.test(
      window
    ) ||
    /(?:wait until|closer to|once (?:they|he|she|your baby) (?:is|are)|safe after)\s+AGE/.test(
      window
    )
  )
}

function isConflictingAge(reference: QuestionStatedAge, statedAge: QuestionStatedAge) {
  return Math.abs(reference.normalizedDays - statedAge.normalizedDays) > 16
}

export function containsConflictingQuestionAge(
  responseText: string,
  questionStatedAge: QuestionStatedAge | null
) {
  if (!questionStatedAge) {
    return false
  }

  return getAgeReferenceMatches(responseText).some(
    (match) =>
      isConflictingAge(match.age, questionStatedAge) &&
      !isCutoffOrRangeReference(responseText, match.start, match.end)
  )
}

export function rewriteConflictingQuestionAge(
  responseText: string,
  questionStatedAge: QuestionStatedAge | null
) {
  if (!questionStatedAge) {
    return responseText
  }

  let rewritten = responseText
  const matches = getAgeReferenceMatches(responseText)
    .filter(
      (match) =>
        isConflictingAge(match.age, questionStatedAge) &&
        !isCutoffOrRangeReference(responseText, match.start, match.end)
    )
    .sort((a, b) => b.start - a.start)

  for (const match of matches) {
    const original = rewritten.slice(match.start, match.end)
    const replacement = /\bold\b/i.test(original)
      ? questionStatedAge.adjectiveLabel
      : questionStatedAge.label

    rewritten =
      rewritten.slice(0, match.start) + replacement + rewritten.slice(match.end)
  }

  return rewritten
}
