const SOUNDS_LIKE_PATTERN = /\bsounds\s+like\b/i
const STREAM_SAFE_TAIL_LENGTH = 48

export function filterResponse(text: string): string {
  if (!text) {
    return text
  }

  const withoutLeadingOh = text.replace(/^(\s*)oh,\s*/i, '$1')
  const withoutSoundsLike = withoutLeadingOh
    .replace(/^(\s*)it\s+sounds\s+like\s+/i, '$1')
    .replace(/\bthat\s+sounds\s+like\b/gi, 'that points to')
    .replace(/\bthis\s+sounds\s+like\b/gi, 'this points to')
    .replace(/\bsounds\s+like\b/gi, 'points to')

  const firstLetterIndex = withoutSoundsLike.search(/[A-Za-z]/)

  if (firstLetterIndex === -1) {
    return withoutSoundsLike
  }

  const firstLetter = withoutSoundsLike.charAt(firstLetterIndex)
  const capitalizedLetter = firstLetter.toUpperCase()

  if (firstLetter === capitalizedLetter) {
    return withoutSoundsLike
  }

  return (
    withoutSoundsLike.slice(0, firstLetterIndex) +
    capitalizedLetter +
    withoutSoundsLike.slice(firstLetterIndex + 1)
  )
}

export function containsForbiddenResponsePhrase(text: string) {
  return SOUNDS_LIKE_PATTERN.test(text)
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
