export function formatResetTime(resetAt: string, timezone: string) {
  try {
    return new Intl.DateTimeFormat('en-AU', {
      timeZone: timezone,
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(resetAt))
  } catch {
    return 'midnight'
  }
}

export function formatText(text: string) {
  if (!text) {
    return text
  }

  const parts = text.split('**')
  return parts.map((part, index) =>
    index % 2 === 1 ? <strong key={index}>{part}</strong> : <span key={index}>{part}</span>
  )
}
