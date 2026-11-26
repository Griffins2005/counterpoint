import { MAX_CLAIM_CHARS, MIN_CLAIM_CHARS } from './constants'

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
])

export function cleanText(value: string, max: number): string {
  const cleaned = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
  if (cleaned.length <= max) return cleaned
  return cleaned.slice(0, max).trim()
}

export function compact(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/** Collapse a claim for the in-flight lock. Display text stays in `claim`. */
export function claimKey(claim: string): string {
  return compact(claim).toLowerCase()
}

export function parseClaim(
  input: unknown,
): { ok: true; claim: string; claimKey: string } | { ok: false; error: string } {
  if (typeof input !== 'string') {
    return { ok: false, error: 'Enter a claim to investigate.' }
  }
  const claim = cleanText(input, MAX_CLAIM_CHARS + 1)
  if (claim.length > MAX_CLAIM_CHARS) {
    return { ok: false, error: `Keep the claim to ${MAX_CLAIM_CHARS} characters.` }
  }
  if (claim.length < MIN_CLAIM_CHARS) {
    return { ok: false, error: `Write a claim of at least ${MIN_CLAIM_CHARS} characters.` }
  }
  return { ok: true, claim, claimKey: claimKey(claim) }
}

/**
 * Canonical form used only to compare URLs. The stored link stays the URL
 * the search endpoint returned.
 */
export function normalizeUrl(input: string): string | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const params = new URLSearchParams(url.search)
  for (const key of [...params.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) params.delete(key)
  }
  const entries = [...params.entries()].sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]))
  const search = entries.length ? `?${new URLSearchParams(entries).toString()}` : ''
  const path = url.pathname.replace(/\/+$/, '') || '/'
  return `${url.protocol}//${host}${path}${search}`
}

export function siteLabel(input: string): string {
  try {
    return new URL(input).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function fenceData(value: string): string {
  return value.replace(/<\/?\s*(source|claim|system|instructions)\b/gi, '[removed-tag]')
}

export function asRecordId(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const id = input.trim()
  if (!id || id.length > 200) return null
  return id
}
