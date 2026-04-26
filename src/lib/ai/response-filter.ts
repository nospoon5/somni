export function filterResponse(text: string): string {
  if (!text) {
    return text
  }

  const withoutLeadingOh = text.replace(/^(\s*)oh,\s*/i, '$1')
  const firstLetterIndex = withoutLeadingOh.search(/[A-Za-z]/)

  if (firstLetterIndex === -1) {
    return withoutLeadingOh
  }

  const firstLetter = withoutLeadingOh.charAt(firstLetterIndex)
  const capitalizedLetter = firstLetter.toUpperCase()

  if (firstLetter === capitalizedLetter) {
    return withoutLeadingOh
  }

  return (
    withoutLeadingOh.slice(0, firstLetterIndex) +
    capitalizedLetter +
    withoutLeadingOh.slice(firstLetterIndex + 1)
  )
}
