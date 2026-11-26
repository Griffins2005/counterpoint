import { z } from 'zod/v4'
import {
  DISCARDED_CITE,
  DISCARDED_QUOTE,
  DISCARDED_URL,
  MISSING_REASONING,
  STANCES,
  type Stance,
} from './constants'
import { compact, normalizeUrl } from './text'

const classificationItemSchema = z.object({
  id: z.string(),
  stance: z.enum(STANCES),
  reasoning: z.string().min(1).max(1200),
})

const classificationSchema = z.object({
  classifications: z.array(z.unknown()).max(24),
})

const synthesisSchema = z.object({
  summary: z.string().min(1).max(2000),
  supporting: z.array(z.unknown()).max(6).optional(),
  challenging: z.array(z.unknown()).max(6).optional(),
  unresolved: z.array(z.unknown()).max(6).optional(),
})

export interface SynthesisBody {
  summary: string
  supporting: string[]
  challenging: string[]
  unresolved: string[]
}

export interface StoredSynthesis extends SynthesisBody {
  fingerprint: string
}

export const storedSynthesisSchema = z.object({
  summary: z.string().min(1).max(2000),
  supporting: z.array(z.string().max(500)).max(6),
  challenging: z.array(z.string().max(500)).max(6),
  unresolved: z.array(z.string().max(500)).max(6),
  fingerprint: z.string().min(1).max(4000),
})

export interface ClassifiedSource {
  stance: Stance
  modelStance: Stance
  reasoning: string
}

interface GroundedSource {
  sourceKey: string
  url: string
  excerpt: string
}

const QUOTE_RE = /"([^"\n]{20,400})"|“([^”\n]{20,400})”/g
const URL_RE = /https?:\/\/[^\s<>"')\]]+/gi
const CITE_RE = /\[(s\d+)\]/g

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const body = (fenced?.[1] ?? trimmed).trim()
  try {
    return JSON.parse(body)
  } catch {
    const start = body.indexOf('{')
    const end = body.lastIndexOf('}')
    if (start === -1 || end <= start) return null
    try {
      return JSON.parse(body.slice(start, end + 1))
    } catch {
      return null
    }
  }
}

/**
 * `openai/chat-completion` publishes no output schema. The server-actions
 * reference says a successful call yields `result.data.choices`. This endpoint
 * is the Chat Completions API. Assistant text is `message.content`, either a
 * string or an array of text parts. Any other shape is rejected.
 */
const textPartSchema = z.object({
  type: z.string().optional(),
  text: z.string(),
})

const chatSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.union([z.string(), z.array(textPartSchema).min(1)]),
        }),
      }),
    )
    .min(1),
})

export function readChatContent(data: unknown): string | null {
  const parsed = chatSchema.safeParse(data)
  if (!parsed.success) return null
  const content = parsed.data.choices[0]?.message.content
  if (typeof content === 'string') {
    const trimmed = content.trim()
    return trimmed ? trimmed : null
  }
  if (content.some((part) => part.type !== undefined && part.type !== 'text')) return null
  const joined = content.map((part) => part.text).join('').trim()
  return joined ? joined : null
}

function quotedSpans(text: string): string[] {
  const spans: string[] = []
  for (const match of text.matchAll(QUOTE_RE)) {
    const span = match[1] ?? match[2]
    if (span) spans.push(span)
  }
  return spans
}

function urlsIn(text: string): string[] {
  return [...text.matchAll(URL_RE)].map((match) => match[0].replace(/[.,;:]+$/, ''))
}

function quotesAreGrounded(text: string, excerpt: string): boolean {
  const haystack = compact(excerpt)
  return quotedSpans(text).every((span) => haystack.includes(compact(span)))
}

function urlsAreAllowed(text: string, allowed: string[]): boolean {
  const allowedKeys = new Set(allowed.map((url) => normalizeUrl(url)).filter((url): url is string => !!url))
  for (const found of urlsIn(text)) {
    const key = normalizeUrl(found)
    if (!key || !allowedKeys.has(key)) return false
  }
  return true
}

function citesAreAllowed(text: string, allowed: Set<string>): boolean {
  for (const match of text.matchAll(CITE_RE)) {
    if (!allowed.has(match[1] ?? '')) return false
  }
  return true
}

export function applyClassifications(
  sources: GroundedSource[],
  modelText: string,
): { ok: true; byKey: Map<string, ClassifiedSource>; discarded: number } | { ok: false; error: string } {
  const json = extractJsonObject(modelText)
  const parsed = classificationSchema.safeParse(json)
  if (!parsed.success) {
    return { ok: false, error: 'The classifier did not return a readable assessment.' }
  }
  const incoming = new Map<string, { stance: Stance; reasoning: string }>()
  for (const raw of parsed.data.classifications) {
    const item = classificationItemSchema.safeParse(raw)
    if (!item.success || incoming.has(item.data.id)) continue
    incoming.set(item.data.id, { stance: item.data.stance, reasoning: item.data.reasoning.trim() })
  }
  const byKey = new Map<string, ClassifiedSource>()
  const knownIds = new Set(sources.map((source) => source.sourceKey))
  let discarded = 0
  for (const source of sources) {
    const item = incoming.get(source.sourceKey)
    if (!item) {
      byKey.set(source.sourceKey, {
        stance: 'inconclusive',
        modelStance: 'inconclusive',
        reasoning: MISSING_REASONING,
      })
      continue
    }
    if (!quotesAreGrounded(item.reasoning, source.excerpt)) {
      discarded += 1
      byKey.set(source.sourceKey, {
        stance: 'inconclusive',
        modelStance: 'inconclusive',
        reasoning: DISCARDED_QUOTE,
      })
      continue
    }
    if (!urlsAreAllowed(item.reasoning, [source.url])) {
      discarded += 1
      byKey.set(source.sourceKey, {
        stance: 'inconclusive',
        modelStance: 'inconclusive',
        reasoning: DISCARDED_URL,
      })
      continue
    }
    if (!citesAreAllowed(item.reasoning, knownIds)) {
      discarded += 1
      byKey.set(source.sourceKey, {
        stance: 'inconclusive',
        modelStance: 'inconclusive',
        reasoning: DISCARDED_CITE,
      })
      continue
    }
    byKey.set(source.sourceKey, {
      stance: item.stance,
      modelStance: item.stance,
      reasoning: item.reasoning.slice(0, 800),
    })
  }
  return { ok: true, byKey, discarded }
}

export function validateSynthesis(
  modelText: string,
  included: GroundedSource[],
): { ok: true; synthesis: SynthesisBody } | { ok: false; error: string } {
  const json = extractJsonObject(modelText)
  const parsed = synthesisSchema.safeParse(json)
  if (!parsed.success) {
    return { ok: false, error: 'The synthesis was not in a readable shape.' }
  }
  const urls = included.map((source) => source.url)
  const excerpts = included.map((source) => source.excerpt).join('\n')
  const ids = new Set(included.map((source) => source.sourceKey))
  const summary = parsed.data.summary.trim()
  if (!quotesAreGrounded(summary, excerpts) || !urlsAreAllowed(summary, urls) || !citesAreAllowed(summary, ids)) {
    return { ok: false, error: 'The synthesis was discarded because it was not grounded in the included sources.' }
  }
  const lines = (value: unknown[] | undefined) =>
    (value ?? []).flatMap((item) => {
      if (typeof item !== 'string') return []
      const line = item.trim()
      if (!line || line.length > 500) return []
      if (!quotesAreGrounded(line, excerpts) || !urlsAreAllowed(line, urls) || !citesAreAllowed(line, ids)) return []
      return [line]
    })
  return {
    ok: true,
    synthesis: {
      summary,
      supporting: lines(parsed.data.supporting),
      challenging: lines(parsed.data.challenging),
      unresolved: lines(parsed.data.unresolved),
    },
  }
}
