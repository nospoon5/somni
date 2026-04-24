const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: string) {
  return UUID_PATTERN.test(value)
}

export type ChatRequestBody = {
  message?: unknown
  conversationId?: unknown
}

export function readChatMessage(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export function resolveConversationId(value: unknown) {
  const requestedConversationId = typeof value === 'string' ? value.trim() : ''
  return isUuid(requestedConversationId) ? requestedConversationId : crypto.randomUUID()
}
