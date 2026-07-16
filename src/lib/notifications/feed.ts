export function formatNotificationTime(createdAt: string, now = new Date()) {
  const date = new Date(createdAt)
  const elapsedMinutes = Math.floor((now.getTime() - date.getTime()) / 60_000)
  if (elapsedMinutes < 1) return 'Just now'
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`
  if (elapsedMinutes < 1_440) return `${Math.floor(elapsedMinutes / 60)}h ago`
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}
