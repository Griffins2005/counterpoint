import { cleanText } from './text'

const MAX_QUERY = 500

/**
 * Three bounded queries: the claim, a pass aimed at agreement, and a pass
 * aimed at disagreement. Callers cap how many hits each query may return.
 */
export function competingQueries(claim: string): [string, string, string] {
  const focus = cleanText(claim, 280)
  return [
    cleanText(focus, MAX_QUERY),
    cleanText(`evidence and research that supports this claim: ${focus}`, MAX_QUERY),
    cleanText(`evidence and research that challenges or contradicts this claim: ${focus}`, MAX_QUERY),
  ]
}
