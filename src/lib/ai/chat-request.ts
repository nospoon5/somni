const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: string) {
  return UUID_PATTERN.test(value)
}

export type ChatRequestBody = {
  babyId?: unknown
  evalHistory?: unknown
  message?: unknown
  conversationId?: unknown
}

export type EvalHistoryMessage = {
  role: 'user' | 'assistant'
  content: string
}

export function readChatMessage(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export function readBabyId(value: unknown) {
  const babyId = typeof value === 'string' ? value.trim() : ''
  return isUuid(babyId) ? babyId : null
}

export function readEvalHistory(value: unknown): EvalHistoryMessage[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .slice(-8)
    .flatMap((entry): EvalHistoryMessage[] => {
      if (!entry || typeof entry !== 'object') {
        return []
      }

      const role = (entry as { role?: unknown }).role
      const content = (entry as { content?: unknown }).content
      if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') {
        return []
      }

      const trimmedContent = content.trim().slice(0, 8_000)
      return trimmedContent ? [{ role, content: trimmedContent }] : []
    })
}

export function resolveConversationId(value: unknown) {
  const requestedConversationId = typeof value === 'string' ? value.trim() : ''
  return isUuid(requestedConversationId) ? requestedConversationId : crypto.randomUUID()
}
