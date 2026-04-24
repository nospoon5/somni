export const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash'

const CHAT_PLAN_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'update_daily_plan',
        description:
          "Save or revise today's dashboard target plan for the current baby. Use this only for same-day rescue changes or a concrete plan for today, not for ongoing baseline learning.",
        parameters: {
          type: 'object',
          properties: {
            sleep_targets: {
              type: 'array',
              description:
                'Only include sleep targets that should be created or changed. Omit this field to leave sleep targets unchanged. Use an empty array only if the sleep plan should be cleared.',
              items: {
                type: 'object',
                properties: {
                  label: {
                    type: 'string',
                    description:
                      'Short target label such as Morning nap, Lunch nap, Afternoon nap, Bedtime, Overnight resettle.',
                  },
                  target_time: {
                    type: 'string',
                    description:
                      "Preferred target time in a parent-friendly format such as 3pm, 3:15 pm, or 15:00.",
                  },
                  window: {
                    type: 'string',
                    description: 'Optional timing window such as 2:45-3:15pm or after lunch.',
                  },
                  notes: {
                    type: 'string',
                    description: 'Optional short note explaining the target or cue to watch for.',
                  },
                },
                required: ['label'],
              },
            },
            feed_targets: {
              type: 'array',
              description:
                'Only include feed targets that should be created or changed. Omit this field to leave feed targets unchanged. Use an empty array only if the feed plan should be cleared.',
              items: {
                type: 'object',
                properties: {
                  label: {
                    type: 'string',
                    description:
                      'Short feed label such as Morning feed, Top-up feed, Bedtime feed, Dream feed.',
                  },
                  target_time: {
                    type: 'string',
                    description:
                      "Preferred target time in a parent-friendly format such as 7am, 10:30 am, or 22:00.",
                  },
                  notes: {
                    type: 'string',
                    description: 'Optional short note explaining the feed target or change.',
                  },
                },
                required: ['label'],
              },
            },
            notes: {
              type: 'string',
              description: "Optional short note that explains today's shift in plan for caregivers.",
            },
          },
        },
      },
      {
        name: 'update_sleep_plan_profile',
        description:
          'Update the durable learned sleep profile for the current baby. Use this only when the parent clearly describes an ongoing or repeating pattern that should carry across days.',
        parameters: {
          type: 'object',
          properties: {
            usual_wake_time: {
              type: 'string',
              description:
                'New typical morning wake time in a parent-friendly format such as 6am, 6:15 am, or 06:15.',
            },
            target_bedtime: {
              type: 'string',
              description:
                'New usual bedtime anchor in a parent-friendly format such as 7pm, 7:15 pm, or 19:15.',
            },
            target_nap_count: {
              type: 'integer',
              description:
                'New realistic nap count most days. Only use this when the parent clearly describes a stable pattern.',
            },
            day_structure: {
              type: 'string',
              description: 'Day structure value: mostly_home_flexible, daycare, or work_constrained.',
            },
            schedule_preference: {
              type: 'string',
              description:
                'Schedule preference value: more_flexible, mix_of_cues_and_anchors, or more_clock_based.',
            },
            first_nap_not_before: {
              type: 'string',
              description:
                'Optional durable constraint for the first nap, such as 9:30am, when the parent clearly says naps cannot happen earlier on an ongoing basis.',
            },
          },
        },
      },
    ],
  },
]

const UPDATE_DAILY_PLAN_TOOL_CONFIG = {
  functionCallingConfig: {
    mode: 'AUTO',
  },
}

export type GeminiFunctionCall = {
  id: string | undefined
  name: string
  args: Record<string, unknown>
}

export type GeminiStreamResult = {
  text: string
  functionCalls: GeminiFunctionCall[]
}

type GeminiContentsItem = {
  role: string
  parts: Array<Record<string, unknown>>
}

export function clampChatMessage(value: string) {
  return value.trim().slice(0, 4000)
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

function extractGeminiFunctionCalls(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return []
  }

  const candidates = (payload as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return []
  }

  const firstCandidate = candidates[0] as {
    content?: {
      parts?: Array<{
        functionCall?: {
          id?: unknown
          name?: unknown
          args?: unknown
        }
      }>
    }
  }

  const parts = firstCandidate?.content?.parts
  if (!Array.isArray(parts)) {
    return []
  }

  return parts
    .map((part) => {
      const call = part?.functionCall
      if (!call || typeof call.name !== 'string') {
        return null
      }

      return {
        id: typeof call.id === 'string' ? call.id : undefined,
        name: call.name,
        args:
          call.args && typeof call.args === 'object' && !Array.isArray(call.args) ? call.args : {},
      }
    })
    .filter((call): call is GeminiFunctionCall => call !== null)
}

export async function streamGeminiResponse(
  contents: GeminiContentsItem[],
  isEvalMode: boolean,
  onToken: (token: string) => void
) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY for chat')
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${CHAT_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        tools: isEvalMode ? undefined : CHAT_PLAN_TOOLS,
        toolConfig: isEvalMode ? undefined : UPDATE_DAILY_PLAN_TOOL_CONFIG,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 800,
          // This chat flow needs a complete parent-facing answer more than hidden
          // reasoning tokens. Gemini 2.5 Flash can spend output budget on thinking,
          // which was truncating replies mid-sentence in production.
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini stream failed (${response.status}): ${errorText}`)
  }

  if (!response.body) {
    throw new Error('Gemini stream did not return a response body')
  }

  const decoder = new TextDecoder()
  const reader = response.body.getReader()
  let buffer = ''
  let fullText = ''
  const functionCalls: GeminiFunctionCall[] = []
  const seenFunctionCalls = new Set<string>()

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) {
        continue
      }

      const dataPayload = trimmed.slice(5).trim()
      if (!dataPayload || dataPayload === '[DONE]') {
        continue
      }

      try {
        const parsed = JSON.parse(dataPayload)
        const token = extractGeminiText(parsed)
        const parsedFunctionCalls = extractGeminiFunctionCalls(parsed)

        if (token) {
          fullText += token
          onToken(token)
        }

        for (const functionCall of parsedFunctionCalls) {
          const key = `${functionCall.id ?? 'no-id'}::${functionCall.name}::${JSON.stringify(functionCall.args)}`
          if (seenFunctionCalls.has(key)) {
            continue
          }

          seenFunctionCalls.add(key)
          functionCalls.push(functionCall)
        }
      } catch (error) {
        console.error('JSON PARSE FAILED', (error as Error).message, dataPayload.substring(0, 100))
        // Ignore malformed chunks and continue streaming the rest.
      }
    }
  }

  // Ensure any final data left in buffer is processed if it has not been printed
  if (buffer.trim()) {
    console.error('WARNING: FINAL BUFFER NOT EMPTY', buffer)
  }

  console.log(`Gemini Stream Completed internally. Extracted ${fullText.length} characters.`)

  return {
    text: fullText.trim(),
    functionCalls,
  } satisfies GeminiStreamResult
}
