import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  checkEmergencyRisk: vi.fn(),
  generateEmbedding: vi.fn(),
  consumeChatQuota: vi.fn(),
  ensureSubscriptionRecord: vi.fn(),
  ensureSleepPlanProfile: vi.fn(),
  streamGeminiResponse: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

vi.mock('@/lib/babies/active-baby', () => ({
  readActiveBabyId: vi.fn().mockResolvedValue(null),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/ai/chat-pipeline', () => ({
  createChatPipeline: vi.fn(() => new ReadableStream()),
}))

vi.mock('@/lib/ai/safety', () => ({
  checkEmergencyRisk: mocks.checkEmergencyRisk,
  getEmergencyRedirectMessage: vi.fn(() => 'Emergency message'),
}))

vi.mock('@/lib/ai/retrieval', () => ({
  generateEmbedding: mocks.generateEmbedding,
  retrieveRelevantChunksWithDiagnostics: vi.fn(() => ({ chunks: [], diagnostics: {} })),
}))

vi.mock('@/lib/billing/usage', () => ({
  consumeChatQuota: mocks.consumeChatQuota,
  releaseChatQuota: vi.fn(),
  buildDailyLimitPayload: vi.fn(() => ({ error: 'Limit reached' })),
  sanitizeTimezone: vi.fn((tz) => tz || 'UTC'),
}))

vi.mock('@/lib/billing/subscriptions', () => ({
  ensureSubscriptionRecord: mocks.ensureSubscriptionRecord,
  hasPremiumAccess: vi.fn(() => true),
}))

vi.mock('@/lib/sleep-plan-profile-init', () => ({
  ensureSleepPlanProfile: mocks.ensureSleepPlanProfile,
}))

vi.mock('@/lib/ai/gemini', () => ({
  streamGeminiResponse: mocks.streamGeminiResponse,
  clampChatMessage: vi.fn((m) => m),
  CHAT_MODEL: 'test-model',
}))

vi.mock('@/lib/ai/chat-plan-persistence', () => ({
  persistAiMemoryAfterChat: vi.fn(),
  saveChatPlanUpdates: vi.fn(() => ({})),
}))

import { POST } from './route'

function request(body: unknown, headers: HeadersInit = {}) {
  return new Request('https://somni.test/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

describe('chat route contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      from: mocks.from,
    })
    
    // Default valid mock setup
    const chainMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: {} }),
      insert: vi.fn().mockResolvedValue({ error: null })
    }
    mocks.from.mockReturnValue(chainMock)
    
    mocks.checkEmergencyRisk.mockReturnValue({ isEmergency: false })
    mocks.generateEmbedding.mockResolvedValue([])
    mocks.ensureSubscriptionRecord.mockResolvedValue({})
    mocks.ensureSleepPlanProfile.mockResolvedValue({ profile: {} })
  })

  it('rejects invalid json', async () => {
    const req = new Request('https://somni.test/api/chat', {
      method: 'POST',
      body: 'invalid json',
    })
    const response = await POST(req)
    expect(response.status).toBe(400)
  })

  it('requires a message', async () => {
    const response = await POST(request({ message: '' }))
    expect(response.status).toBe(400)
  })

  it('rejects a client-controlled evaluation mode header', async () => {
    const response = await POST(
      request({ message: 'hello' }, { 'x-eval-mode': 'true' }),
    )
    expect(response.status).toBe(403)
  })

  it('rejects missing user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    const response = await POST(request({ message: 'hello' }))
    expect(response.status).toBe(401)
  })

  it('rejects missing baby', async () => {
    const chainMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockImplementation(() => {
        return Promise.resolve({ data: null }) // mock missing baby
      }),
      insert: vi.fn().mockResolvedValue({ error: null })
    }
    mocks.from.mockReturnValue(chainMock)

    const response = await POST(request({ message: 'hello' }))
    expect(response.status).toBe(409)
  })
})
