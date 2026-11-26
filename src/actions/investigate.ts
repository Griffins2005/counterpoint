import type { ActionResult } from 'deepspace/worker'
import {
  CHAT_ENDPOINT,
  CLASSIFY_MAX_TOKENS,
  DAILY_LIMITS,
  SEARCH_ENDPOINT,
  STALE_LOCK_MS,
  SYNTHESIZE_MAX_TOKENS,
  type InvestigationStatus,
  type UsageKind,
} from '../lib/evidence/constants'
import { NOT_AVAILABLE, sameOwner } from '../lib/evidence/ownership'
import { CLASSIFICATION_SYSTEM, SYNTHESIS_SYSTEM, classificationUserMessage } from '../lib/evidence/prompts'
import { competingQueries } from '../lib/evidence/queries'
import { chatRequestBody, exaSearchBody } from '../lib/evidence/requests'
import { dedupeSources, parseExaResults, type RetrievedSource } from '../lib/evidence/sources'
import { buildSynthesisInput, withFingerprint, type EvidenceRow } from '../lib/evidence/synthesis'
import { asRecordId, cleanText, parseClaim } from '../lib/evidence/text'
import { asStance, isExcluded, type ClassifyResult, type DeleteResult, type InvestigateResult, type SynthesisResult } from '../lib/evidence/types'
import { applyClassifications, readChatContent, validateSynthesis } from '../lib/evidence/validate'

interface Envelope<T> {
  recordId: string
  data: T
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface InvestigationRow {
  [key: string]: unknown
  claim: string
  status: string
  statusDetail: string
  synthesis: string
}

interface SourceRow {
  [key: string]: unknown
  investigationId: string
  position: number
  sourceKey: string
  title: string
  url: string
  excerpt: string
  stance: string
  reasoning: string
  excluded: string
}

export interface InvestigationTools {
  create(collection: string, data: Record<string, unknown>, recordId?: string): Promise<ActionResult<{ recordId: string }>>
  update(collection: string, recordId: string, data: Record<string, unknown>): Promise<ActionResult<{ recordId: string }>>
  remove(collection: string, recordId: string): Promise<ActionResult<{ recordId: string }>>
  get<T extends Record<string, unknown>>(collection: string, recordId: string): Promise<ActionResult<{ record: Envelope<T> }>>
  query<T extends Record<string, unknown>>(
    collection: string,
    options?: { where?: Record<string, unknown>; orderBy?: string; orderDir?: 'asc' | 'desc'; limit?: number },
  ): Promise<ActionResult<{ records: Array<Envelope<T>>; count: number }>>
  deleteWhere(collection: string, where: Record<string, unknown>, limit?: number): Promise<ActionResult<{ deleted: number }>>
  integration(endpoint: string, data?: unknown): Promise<ActionResult<unknown>>
}

export interface InvestigationContext {
  userId: string
  params: Record<string, unknown>
  tools: InvestigationTools
  now?: Date
}

function failureText(result: { error: string }): string {
  const code = 'code' in result && typeof result.code === 'string' ? result.code : ''
  if (code === 'insufficient_credits') return 'This could not run because the app is out of credits.'
  if (code === 'rate_limited' || code === 'too_many_requests') {
    return 'The provider is busy. Wait a moment and try this once more.'
  }
  return cleanText(result.error || 'The request failed.', 300)
}

async function reserve(
  tools: InvestigationTools,
  userId: string,
  kind: UsageKind,
  now: Date,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const day = now.toISOString().slice(0, 10)
  const limit = DAILY_LIMITS[kind]
  for (let slot = 1; slot <= limit; slot += 1) {
    const created = await tools.create('usage', { userId, day, kind, slot })
    if (created.success) return { ok: true }
    if (!created.error.includes('Duplicate')) return { ok: false, error: 'Could not record usage for this step.' }
  }
  return { ok: false, error: `Daily limit reached for this step (${limit} per UTC day).` }
}

async function acquireLock(
  tools: InvestigationTools,
  userId: string,
  claimKey: string,
  now: Date,
): Promise<{ ok: true; recordId: string } | { ok: false; error: string }> {
  const startedAt = now.toISOString()
  const created = await tools.create('locks', { userId, claimKey, startedAt })
  if (created.success) return { ok: true, recordId: created.data.recordId }
  if (!created.error.includes('Duplicate')) return { ok: false, error: 'Could not start this step.' }
  const existing = await tools.query<{ [key: string]: unknown; startedAt: string }>('locks', {
    where: { userId, claimKey },
    limit: 5,
  })
  const lock = existing.success ? existing.data.records[0] : undefined
  const age = lock ? now.getTime() - Date.parse(String(lock.data.startedAt)) : Number.NaN
  if (!lock || !Number.isFinite(age) || age < STALE_LOCK_MS) {
    return { ok: false, error: 'This is already running. Wait for it to finish before submitting it again.' }
  }
  const removed = await tools.remove('locks', lock.recordId)
  if (!removed.success) return { ok: false, error: 'This is already running. Wait for it to finish before submitting it again.' }
  const retry = await tools.create('locks', { userId, claimKey, startedAt })
  if (!retry.success) return { ok: false, error: 'This is already running. Wait for it to finish before submitting it again.' }
  return { ok: true, recordId: retry.data.recordId }
}

async function releaseLock(tools: InvestigationTools, recordId: string | null) {
  if (!recordId) return
  try {
    await tools.remove('locks', recordId)
  } catch {
    // A stale lock can be replaced after STALE_LOCK_MS.
  }
}

async function loadOwned(tools: InvestigationTools, recordId: string, userId: string) {
  const got = await tools.get<InvestigationRow>('investigations', recordId)
  if (!got.success || !sameOwner(got.data.record.createdBy, userId)) {
    return { ok: false as const, error: NOT_AVAILABLE }
  }
  return { ok: true as const, record: got.data.record }
}

async function listSources(tools: InvestigationTools, investigationId: string) {
  const listed = await tools.query<SourceRow>('sources', {
    where: { investigationId },
    orderBy: 'position',
    orderDir: 'asc',
    limit: 20,
  })
  if (!listed.success) return listed
  const records = [...listed.data.records].sort((a, b) => Number(a.data.position) - Number(b.data.position))
  return { success: true as const, data: { records, count: records.length } }
}

function toEvidence(records: Array<Envelope<SourceRow>>): EvidenceRow[] {
  return records.flatMap((record) => {
    const sourceKey = typeof record.data.sourceKey === 'string' ? record.data.sourceKey : ''
    if (!sourceKey) return []
    return [
      {
        sourceKey,
        title: typeof record.data.title === 'string' ? record.data.title : '',
        url: typeof record.data.url === 'string' ? record.data.url : '',
        excerpt: typeof record.data.excerpt === 'string' ? record.data.excerpt : '',
        stance: asStance(record.data.stance),
        excluded: isExcluded(record.data.excluded),
      },
    ]
  })
}

async function runClassification(
  tools: InvestigationTools,
  claim: string,
  records: Array<Envelope<SourceRow>>,
) {
  const evidence = toEvidence(records)
  const chat = await tools.integration(
    CHAT_ENDPOINT,
    chatRequestBody(CLASSIFICATION_SYSTEM, classificationUserMessage(claim, evidence), CLASSIFY_MAX_TOKENS),
  )
  if (!chat.success) return { ok: false as const, error: failureText(chat) }
  const content = readChatContent(chat.data)
  if (!content) return { ok: false as const, error: 'The classifier returned a response that could not be read.' }
  const applied = applyClassifications(evidence, content)
  if (!applied.ok) return applied
  for (const record of records) {
    const sourceKey = typeof record.data.sourceKey === 'string' ? record.data.sourceKey : ''
    const next = applied.byKey.get(sourceKey)
    if (!next) continue
    const updated = await tools.update('sources', record.recordId, {
      stance: next.stance,
      modelStance: next.modelStance,
      reasoning: next.reasoning,
    })
    if (!updated.success) return { ok: false as const, error: 'A classification could not be saved.' }
  }
  return { ok: true as const, discarded: applied.discarded }
}

export async function investigateClaim(ctx: InvestigationContext): Promise<ActionResult<InvestigateResult>> {
  const parsed = parseClaim(ctx.params.claim)
  if (!parsed.ok) return { success: false, error: parsed.error }
  if (!sameOwner(ctx.userId, ctx.userId)) return { success: false, error: 'Sign in to investigate a claim.' }
  const now = ctx.now ?? new Date()
  let lockId: string | null = null
  let investigationId: string | null = null
  try {
    const lock = await acquireLock(ctx.tools, ctx.userId, parsed.claimKey, now)
    if (!lock.ok) return { success: false, error: lock.error }
    lockId = lock.recordId
    const usage = await reserve(ctx.tools, ctx.userId, 'investigate', now)
    if (!usage.ok) return { success: false, error: usage.error }

    const queries = competingQueries(parsed.claim)
    const groups: RetrievedSource[][] = []
    const failures: string[] = []
    let succeeded = 0
    for (const query of queries) {
      const result = await ctx.tools.integration(SEARCH_ENDPOINT, exaSearchBody(query))
      if (!result.success) {
        failures.push(failureText(result))
        groups.push([])
        continue
      }
      const sources = parseExaResults(result.data)
      if (!sources.ok) {
        failures.push(sources.error)
        groups.push([])
        continue
      }
      succeeded += 1
      groups.push(sources.sources)
    }
    if (succeeded === 0) {
      return { success: false, error: failures[0] ?? 'Search failed.' }
    }

    const picked = dedupeSources(groups)
    if (picked.length === 0) {
      const note = failures.length
        ? 'No sources came back, and one of the searches failed.'
        : 'No sources came back for this claim. Try a more specific wording.'
      const created = await ctx.tools.create('investigations', {
        claim: parsed.claim,
        status: 'empty',
        statusDetail: note,
        synthesis: '',
      })
      if (!created.success) return { success: false, error: 'The investigation could not be saved.' }
      return {
        success: true,
        data: { investigationId: created.data.recordId, status: 'empty', sourceCount: 0, detail: note },
      }
    }

    const created = await ctx.tools.create('investigations', {
      claim: parsed.claim,
      status: 'partial',
      statusDetail: 'Sources are saved. Classification has not finished.',
      synthesis: '',
    })
    if (!created.success) return { success: false, error: 'The investigation could not be saved.' }
    investigationId = created.data.recordId

    const records: Array<Envelope<SourceRow>> = []
    for (let index = 0; index < picked.length; index += 1) {
      const source = picked[index]
      if (!source) continue
      const saved = await ctx.tools.create('sources', {
        investigationId,
        position: index + 1,
        sourceKey: `s${index + 1}`,
        title: source.title,
        url: source.url,
        excerpt: source.excerpt,
        author: source.author,
        publishedDate: source.publishedDate,
        providerId: source.providerId,
        stance: 'inconclusive',
        modelStance: 'inconclusive',
        reasoning: '',
        excluded: 'no',
      })
      if (!saved.success) {
        const statusDetail =
          records.length > 0
            ? 'Some sources could not be saved. The ones that were saved are on the board.'
            : 'Sources could not be saved.'
        await ctx.tools.update('investigations', investigationId, { status: 'error', statusDetail })
        return {
          success: true,
          data: { investigationId, status: 'error', sourceCount: records.length, detail: statusDetail },
        }
      }
      records.push({
        recordId: saved.data.recordId,
        createdBy: ctx.userId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        data: {
          investigationId,
          position: index + 1,
          sourceKey: `s${index + 1}`,
          title: source.title,
          url: source.url,
          excerpt: source.excerpt,
          stance: 'inconclusive',
          reasoning: '',
          excluded: 'no',
        },
      })
    }

    const classified = await runClassification(ctx.tools, parsed.claim, records)
    const searchNote = failures.length ? ' One search did not return.' : ''
    if (!classified.ok) {
      const statusDetail = cleanText(`${classified.error}${searchNote}`, 500)
      await ctx.tools.update('investigations', investigationId, { status: 'partial', statusDetail })
      return {
        success: true,
        data: { investigationId, status: 'partial', sourceCount: records.length, detail: statusDetail },
      }
    }
    const discardedNote =
      classified.discarded > 0
        ? ` ${classified.discarded} classification${classified.discarded === 1 ? '' : 's'} discarded because ${classified.discarded === 1 ? 'it was' : 'they were'} not grounded in the excerpt.`
        : ''
    const statusDetail = cleanText(`Sources classified.${discardedNote}${searchNote}`, 500)
    const status: InvestigationStatus = 'ready'
    await ctx.tools.update('investigations', investigationId, { status, statusDetail })
    return {
      success: true,
      data: { investigationId, status, sourceCount: records.length, detail: statusDetail },
    }
  } catch {
    if (investigationId) {
      try {
        await ctx.tools.update('investigations', investigationId, {
          status: 'error',
          statusDetail: 'The investigation stopped before it could finish.',
        })
      } catch {
        // The row remains readable with its last saved status.
      }
    }
    return { success: false, error: 'The investigation stopped before it could finish.' }
  } finally {
    await releaseLock(ctx.tools, lockId)
  }
}

export async function classifyInvestigation(ctx: InvestigationContext): Promise<ActionResult<ClassifyResult>> {
  const investigationId = asRecordId(ctx.params.investigationId)
  if (!investigationId) return { success: false, error: NOT_AVAILABLE }
  const now = ctx.now ?? new Date()
  let lockId: string | null = null
  try {
    const lock = await acquireLock(ctx.tools, ctx.userId, `classify:${investigationId}`, now)
    if (!lock.ok) return { success: false, error: lock.error }
    lockId = lock.recordId
    const owned = await loadOwned(ctx.tools, investigationId, ctx.userId)
    if (!owned.ok) return { success: false, error: owned.error }
    const listed = await listSources(ctx.tools, investigationId)
    if (!listed.success) return { success: false, error: 'The sources could not be loaded.' }
    if (listed.data.records.length === 0) {
      return { success: false, error: 'There are no retrieved sources to classify.' }
    }
    const usage = await reserve(ctx.tools, ctx.userId, 'classify', now)
    if (!usage.ok) return { success: false, error: usage.error }
    const classified = await runClassification(ctx.tools, String(owned.record.data.claim ?? ''), listed.data.records)
    if (!classified.ok) {
      await ctx.tools.update('investigations', investigationId, {
        status: 'partial',
        statusDetail: cleanText(classified.error, 500),
      })
      return { success: false, error: classified.error }
    }
    const statusDetail =
      classified.discarded > 0
        ? cleanText(
            `${classified.discarded} classification${classified.discarded === 1 ? '' : 's'} discarded because ${classified.discarded === 1 ? 'it was' : 'they were'} not grounded in the excerpt.`,
            500,
          )
        : 'Sources classified.'
    await ctx.tools.update('investigations', investigationId, { status: 'ready', statusDetail })
    return { success: true, data: { status: 'ready', detail: statusDetail, discarded: classified.discarded } }
  } finally {
    await releaseLock(ctx.tools, lockId)
  }
}

export async function synthesizeInvestigation(ctx: InvestigationContext): Promise<ActionResult<SynthesisResult>> {
  const investigationId = asRecordId(ctx.params.investigationId)
  if (!investigationId) return { success: false, error: NOT_AVAILABLE }
  const now = ctx.now ?? new Date()
  let lockId: string | null = null
  try {
    const lock = await acquireLock(ctx.tools, ctx.userId, `synthesize:${investigationId}`, now)
    if (!lock.ok) return { success: false, error: lock.error }
    lockId = lock.recordId
    const owned = await loadOwned(ctx.tools, investigationId, ctx.userId)
    if (!owned.ok) return { success: false, error: owned.error }
    const listed = await listSources(ctx.tools, investigationId)
    if (!listed.success) return { success: false, error: 'The sources could not be loaded.' }
    const evidence = toEvidence(listed.data.records)
    const input = buildSynthesisInput(String(owned.record.data.claim ?? ''), evidence)
    if (input.included.length === 0) {
      return { success: false, error: 'Include at least one source before writing a synthesis.' }
    }
    const usage = await reserve(ctx.tools, ctx.userId, 'synthesize', now)
    if (!usage.ok) return { success: false, error: usage.error }
    const chat = await ctx.tools.integration(
      CHAT_ENDPOINT,
      chatRequestBody(SYNTHESIS_SYSTEM, input.userMessage, SYNTHESIZE_MAX_TOKENS),
    )
    if (!chat.success) return { success: false, error: failureText(chat) }
    const content = readChatContent(chat.data)
    if (!content) return { success: false, error: 'The synthesis returned a response that could not be read.' }
    const validated = validateSynthesis(content, input.included)
    if (!validated.ok) return { success: false, error: validated.error }
    const serialized = JSON.stringify(withFingerprint(validated.synthesis, input.fingerprint))
    if (serialized.length > 12000) return { success: false, error: 'The synthesis was too long to save.' }
    const updated = await ctx.tools.update('investigations', investigationId, { synthesis: serialized })
    if (!updated.success) return { success: false, error: 'The synthesis could not be saved.' }
    return { success: true, data: { synthesis: withFingerprint(validated.synthesis, input.fingerprint) } }
  } finally {
    await releaseLock(ctx.tools, lockId)
  }
}

export async function deleteInvestigation(ctx: InvestigationContext): Promise<ActionResult<DeleteResult>> {
  const investigationId = asRecordId(ctx.params.investigationId)
  if (!investigationId) return { success: false, error: NOT_AVAILABLE }
  const owned = await loadOwned(ctx.tools, investigationId, ctx.userId)
  if (!owned.ok) return { success: false, error: owned.error }
  for (let page = 0; page < 10; page += 1) {
    const removed = await ctx.tools.deleteWhere('sources', { investigationId }, 100)
    if (!removed.success) return { success: false, error: 'The sources could not be removed.' }
    if (removed.data.deleted < 100) break
    if (page === 9) return { success: false, error: 'The sources could not be removed.' }
  }
  const removed = await ctx.tools.remove('investigations', investigationId)
  if (!removed.success) return { success: false, error: 'The investigation could not be removed.' }
  const claim = typeof owned.record.data.claim === 'string' ? owned.record.data.claim : ''
  const parsedClaim = parseClaim(claim)
  const keys = [parsedClaim.ok ? parsedClaim.claimKey : '', `classify:${investigationId}`, `synthesize:${investigationId}`]
  for (const key of keys) {
    if (!key) continue
    const found = await ctx.tools.query<{ [key: string]: unknown }>('locks', {
      where: { userId: ctx.userId, claimKey: key },
      limit: 5,
    })
    if (!found.success) continue
    for (const lock of found.data.records) {
      if (sameOwner(lock.createdBy, ctx.userId)) await ctx.tools.remove('locks', lock.recordId)
    }
  }
  return { success: true, data: { deleted: true } }
}