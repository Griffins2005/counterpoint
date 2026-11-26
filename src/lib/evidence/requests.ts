import {
  CHAT_MODEL,
  REQUEST_TEXT_CHARS,
  RESULTS_PER_QUERY,
} from './constants'

/** Body for `exa/search`. Field names match `integrations info exa/search`. */
export function exaSearchBody(query: string) {
  return {
    query,
    numResults: RESULTS_PER_QUERY,
    type: 'auto' as const,
    contents: {
      text: { maxCharacters: REQUEST_TEXT_CHARS },
    },
  }
}

/** Body for `openai/chat-completion`. Field names match the published input schema. */
export function chatRequestBody(system: string, user: string, maxTokens: number) {
  return {
    model: CHAT_MODEL,
    max_tokens: maxTokens,
    temperature: 0,
    messages: [
      { role: 'system' as const, content: system },
      { role: 'user' as const, content: user },
    ],
  }
}
