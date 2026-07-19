import { describe, expect, it } from 'vitest'
import type { RetrievalDiagnostics } from './retrieval'
import { buildRetrievalLogPayload } from './chat-sources'

const diagnostics: RetrievalDiagnostics = {
  queryPreview: 'My baby has a sensitive sleep question.',
  ageBand: '4-6 months',
  methodology: 'balanced',
  strategy: 'rpc',
  limit: 5,
  candidateCount: 0,
  selectedCount: 0,
  intents: [],
  candidates: [],
}

describe('retrieval log privacy', () => {
  it('omits the parent message preview from normal operational logs', () => {
    const payload = buildRetrievalLogPayload(diagnostics, 'conversation-1')

    expect(payload).not.toHaveProperty('queryPreview')
    expect(JSON.stringify(payload)).not.toContain(diagnostics.queryPreview)
  })

  it('includes fixture query text only for explicitly authorised evaluation logs', () => {
    const payload = buildRetrievalLogPayload(diagnostics, 'conversation-1', {
      includeQueryPreview: true,
    })

    expect(payload).toHaveProperty('queryPreview', diagnostics.queryPreview)
  })
})
