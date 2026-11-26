import { z } from 'zod/v4'
import { EXCERPT_CHARS, MAX_SOURCES } from './constants'
import { cleanText, normalizeUrl } from './text'

const exaResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  publishedDate: z.union([z.string(), z.null()]),
  author: z.union([z.string(), z.null()]),
  id: z.string(),
  text: z.unknown().optional(),
  highlights: z.unknown().optional(),
  summary: z.unknown().optional(),
})

const exaResponseSchema = z.object({
  results: z.array(exaResultSchema),
})

export interface RetrievedSource {
  title: string
  url: string
  excerpt: string
  author: string
  publishedDate: string
  providerId: string
  normalizedUrl: string
}

function excerptFrom(result: z.infer<typeof exaResultSchema>): string {
  if (typeof result.text === 'string' && result.text.trim()) return result.text
  if (Array.isArray(result.highlights)) {
    const lines = result.highlights.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    if (lines.length) return lines.join(' ')
  }
  if (typeof result.summary === 'string' && result.summary.trim()) return result.summary
  return ''
}

/**
 * Read one `exa/search` body. The output schema requires `results`, and each
 * item requires title, url, publishedDate, author, and id. Items without a
 * usable http(s) URL or a retrieved excerpt are dropped — nothing is filled in.
 */
export function parseExaResults(
  data: unknown,
): { ok: true; sources: RetrievedSource[] } | { ok: false; error: string } {
  const parsed = exaResponseSchema.safeParse(data)
  if (!parsed.success) {
    return { ok: false, error: 'Search returned a response that did not match the expected source list.' }
  }
  const sources: RetrievedSource[] = []
  for (const result of parsed.data.results) {
    const normalizedUrl = normalizeUrl(result.url)
    if (!normalizedUrl) continue
    if (result.url.trim().length > 2000) continue
    const excerpt = cleanText(stripTags(excerptFrom(result)), EXCERPT_CHARS)
    if (!excerpt) continue
    const title = cleanText(stripTags(result.title), 300) || siteHost(result.url)
    sources.push({
      title,
      url: result.url.trim(),
      excerpt,
      author: result.author ? cleanText(result.author, 180) : '',
      publishedDate: result.publishedDate ? cleanText(result.publishedDate, 40) : '',
      providerId: cleanText(result.id, 200),
      normalizedUrl,
    })
  }
  return { ok: true, sources }
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ')
}

function siteHost(input: string): string {
  try {
    return new URL(input).hostname.replace(/^www\./, '')
  } catch {
    return 'Untitled source'
  }
}

/**
 * Drop repeated URLs (tracking params and trailing slashes ignored), then
 * take turns across the query buckets so one phrasing cannot fill the board.
 */
export function dedupeSources(groups: RetrievedSource[][], max = MAX_SOURCES): RetrievedSource[] {
  const seen = new Set<string>()
  const buckets = groups.map((group) => {
    const kept: RetrievedSource[] = []
    for (const source of group) {
      if (seen.has(source.normalizedUrl)) continue
      seen.add(source.normalizedUrl)
      kept.push(source)
    }
    return kept
  })
  const picked: RetrievedSource[] = []
  let added = true
  while (picked.length < max && added) {
    added = false
    for (const bucket of buckets) {
      const next = bucket.shift()
      if (!next) continue
      picked.push(next)
      added = true
      if (picked.length >= max) break
    }
  }
  return picked
}
