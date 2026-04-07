import 'server-only'

const MEMORY_MODEL =
  process.env.GEMINI_MEMORY_MODEL || process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash'

type MemoryInput = {
  babyName: string
  existingMemory: string | null
  latestUserMessage: string
  latestAssistantMessage: string
}

function extractGeminiText(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return ''
  }

  const candidates = (payload as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return ''
  }

  const firstCandidate = candidates[0] as { content?: { parts?: Array<{ text?: string }> } }
  const parts = firstCandidate?.content?.parts
  if (!Array.isArray(parts)) {
    return ''
  }

  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .filter((text) => text.length > 0)
    .join('')
}

function buildMemoryPrompt(input: MemoryInput) {
  return `
You maintain a compact master profile for one baby named ${input.babyName}.

Task:
1. Read the existing memory.
2. Read the latest parent/coach exchange.
3. Update memory only if the new exchange adds or changes durable baby facts.

Durable facts include:
- developmental milestones (for example rolling)
- sleep patterns that repeat
- ongoing routines or preferences
- stable constraints or parent goals

Do not store:
- one-off coaching advice
- filler language or empathy lines
- internal reasoning

Output rules:
- If there is no meaningful memory update, output exactly: NO_UPDATE
- Otherwise output the full updated memory as concise bullet points.
- Use "-" bullets only.
- Keep it short (max 10 bullets).
- Replace outdated facts instead of duplicating them.

Existing memory:
${input.existingMemory?.trim() || '<none>'}

Latest parent message:
${input.latestUserMessage}

Latest coach message:
${input.latestAssistantMessage}
`.trim()
}

export async function extractUpdatedAiMemory(input: MemoryInput) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY for memory extraction')
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MEMORY_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: buildMemoryPrompt(input) }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 400,
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini memory extraction failed (${response.status}): ${errorText}`)
  }

  const payload = (await response.json()) as unknown
  const output = extractGeminiText(payload).trim()

  if (!output || output === 'NO_UPDATE') {
    return null
  }

  const existing = input.existingMemory?.trim() || ''
  if (output === existing) {
    return null
  }

  return output
}
