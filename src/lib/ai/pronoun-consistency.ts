export type LatestPronounPreference = 'masculine' | 'feminine' | null

const MASCULINE_PATTERN = /\b(?:he|him|his)\b/i
const FEMININE_PATTERN = /\b(?:she|her|hers)\b/i

export function inferLatestPronounPreference(message: string): LatestPronounPreference {
  const hasMasculine = MASCULINE_PATTERN.test(message)
  const hasFeminine = FEMININE_PATTERN.test(message)

  if (hasMasculine === hasFeminine) {
    return null
  }

  return hasMasculine ? 'masculine' : 'feminine'
}

export function containsConflictingPronouns(
  response: string,
  preference: LatestPronounPreference
) {
  if (preference === 'masculine') {
    return FEMININE_PATTERN.test(response)
  }

  if (preference === 'feminine') {
    return MASCULINE_PATTERN.test(response)
  }

  return false
}

export function getPronounRewriteInstruction(preference: LatestPronounPreference) {
  return preference === 'masculine'
    ? 'Use he, him, and his consistently.'
    : 'Use she, her, and hers consistently.'
}
