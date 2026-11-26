/** Paid catalog endpoints. Schemas checked with `deepspace integrations info`. */
export const SEARCH_ENDPOINT = 'exa/search'
export const CHAT_ENDPOINT = 'openai/chat-completion'

/**
 * Fast model in the installed SDK catalog (`gpt-6-luna`).
 * The chat endpoint's input schema accepts any model string and defaults to
 * `gpt-6-sol`; this one is the catalog's fast OpenAI option.
 */
export const CHAT_MODEL = 'gpt-6-luna'

/** Browser proxy names that must not bill the owner outside a server action. */
export const SERVER_ONLY_INTEGRATIONS = ['exa', 'openai'] as const

export function isServerOnlyIntegration(name: string): boolean {
  return (SERVER_ONLY_INTEGRATIONS as readonly string[]).includes(name)
}

export const RESULTS_PER_QUERY = 4
export const MAX_SOURCES = 8
export const EXCERPT_CHARS = 1100
export const REQUEST_TEXT_CHARS = 1400
export const MIN_CLAIM_CHARS = 12
export const MAX_CLAIM_CHARS = 400
export const CLASSIFY_MAX_TOKENS = 1800
export const SYNTHESIZE_MAX_TOKENS = 1400
export const STALE_LOCK_MS = 8 * 60 * 1000

export const DAILY_LIMITS = {
  investigate: 8,
  classify: 8,
  synthesize: 16,
} as const

export type UsageKind = keyof typeof DAILY_LIMITS

export const STANCES = ['supporting', 'challenging', 'inconclusive'] as const
export type Stance = (typeof STANCES)[number]

export const INVESTIGATION_STATUSES = ['ready', 'empty', 'partial', 'error'] as const
export type InvestigationStatus = (typeof INVESTIGATION_STATUSES)[number]

export const MISSING_REASONING = 'No verified classification was returned for this source.'
export const DISCARDED_QUOTE =
  'The model response for this source was discarded because it quoted text that was not in the retrieved excerpt.'
export const DISCARDED_URL =
  'The model response for this source was discarded because it introduced a link that was not retrieved.'
export const DISCARDED_CITE =
  'The model response for this source was discarded because it cited a source that was not retrieved.'
