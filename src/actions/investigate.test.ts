import { describe, expect, it } from 'vitest'
import type { InvestigationContext, InvestigationTools } from './investigate'
import { classifyInvestigation, deleteInvestigation, investigateClaim, synthesizeInvestigation } from './investigate'
import { CHAT_ENDPOINT, SEARCH_ENDPOINT } from '../lib/evidence/constants'
import { claimKey, normalizeUrl } from '../lib/evidence/text'

interface Stored {
  collection: string
  recordId: string
  createdBy: string
  data: Record<string, unknown>
}

function envelope(row: Stored) {
  return {
    recordId: row.recordId,
    createdBy: row.createdBy,
    createdAt: '2026-11-26T00:00:00.000Z',
    updatedAt: '2026-11-26T00:00:00.000Z',
    data: row.data,
  }
}

function toolsFor(userId: string, integration: InvestigationTools['integration'], usageRows = 0) {
  const rows: Stored[] = []
  for (let slot = 1; slot <= usageRows; slot += 1) {
    rows.push({
      collection: 'usage',
      recordId: `seed_${slot}`,
      createdBy: userId,
      data: { userId, day: '2026-11-26', kind: 'investigate', slot },
    })
  }
  let n = 0
  const removed: string[] = []
  const tools = {
    async create(collection: string, data: Record<string, unknown>) {
      if (collection === 'locks') {
        const taken = rows.some(
          (row) => row.collection === 'locks' && row.data.userId === data.userId && row.data.claimKey === data.claimKey,
        )
        if (taken) return { success: false as const, error: 'Duplicate: a record with this key already exists' }
      }
      if (collection === 'usage') {
        const taken = rows.some(
          (row) =>
            row.collection === 'usage' &&
            row.data.userId === data.userId &&
            row.data.day === data.day &&
            row.data.kind === data.kind &&
            row.data.slot === data.slot,
        )
        if (taken) return { success: false as const, error: 'Duplicate: a record with this key already exists' }
      }
      n += 1
      const row = { collection, recordId: `${collection}_${n}`, createdBy: userId, data }
      rows.push(row)
      return { success: true as const, data: { recordId: row.recordId } }
    },
    async update(collection: string, recordId: string, data: Record<string, unknown>) {
      const row = rows.find((item) => item.collection === collection && item.recordId === recordId)
      if (!row) return { success: false as const, error: 'missing' }
      row.data = { ...row.data, ...data }
      return { success: true as const, data: { recordId } }
    },
    async remove(collection: string, recordId: string) {
      const index = rows.findIndex((row) => row.collection === collection && row.recordId === recordId)
      if (index >= 0) rows.splice(index, 1)
      removed.push(recordId)
      return { success: true as const, data: { recordId } }
    },
    async get(collection: string, recordId: string) {
      const row = rows.find((item) => item.collection === collection && item.recordId === recordId)
      if (!row) return { success: false as const, error: 'missing' }
      return { success: true as const, data: { record: envelope(row) } }
    },
    async query(collection: string, options?: { where?: Record<string, unknown> }) {
      const where = options?.where ?? {}
      const records = rows
        .filter((row) => row.collection === collection)
        .filter((row) => Object.entries(where).every(([key, value]) => row.data[key] === value))
        .map(envelope)
      return { success: true as const, data: { records, count: records.length } }
    },
    async deleteWhere(collection: string, where: Record<string, unknown>) {
      const before = rows.length
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        const row = rows[index]
        if (!row || row.collection !== collection) continue
        const matches = Object.entries(where).every(([key, value]) => row.data[key] === value)
        if (matches) rows.splice(index, 1)
      }
      return { success: true, data: { deleted: before - rows.length } }
    },
    integration,
  }
  return { tools: tools as InvestigationTools, rows, removed }
}

function hit(url: string, excerpt: string) {
  return { title: 'Retrieved title', url, publishedDate: null, author: null, id: url, text: excerpt }
}

describe('investigateClaim', () => {
  it('persists a deduped set and does not let one query fill the board', async () => {
    const calls: Array<{ endpoint: string; body: unknown }> = []
    const { tools, rows, removed } = toolsFor('user_a', async (endpoint, body) => {
      calls.push({ endpoint, body })
      if (endpoint === SEARCH_ENDPOINT) {
        const query = String((body as { query?: string }).query ?? '')
        if (query.startsWith('evidence and research that supports')) {
          return {
            success: true,
            data: {
              results: [
                hit('https://example.com/a', 'Supporting excerpt from the second query.'),
                hit('https://example.com/d', 'Fourth source excerpt from the support query.'),
              ],
            },
          }
        }
        if (query.startsWith('evidence and research that challenges')) {
          return { success: true, data: { results: [hit('https://example.com/e', 'Challenge excerpt from the third query.')] } }
        }
        return {
          success: true,
          data: {
            results: [
              hit('https://Example.com/a/?utm_source=news', 'First excerpt for the overlapping page.'),
              hit('https://example.com/b', 'Second excerpt from the claim query.'),
            ],
          },
        }
      }
      return {
        success: true,
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  classifications: ['s1', 's2', 's3', 's4'].map((id) => ({
                    id,
                    stance: 'inconclusive',
                    reasoning: 'The excerpt does not settle the claim.',
                  })),
                }),
              },
            },
          ],
        },
      }
    })
    const result = await investigateClaim({
      userId: 'user_a',
      params: { claim: 'A four-day week keeps output steady.' },
      tools,
      now: new Date('2026-11-26T12:00:00.000Z'),
    })
    expect(result.success).toBe(true)
    const sources = rows.filter((row) => row.collection === 'sources')
    const urls = sources.map((row) => String(row.data.url))
    expect(urls.map((url) => normalizeUrl(url))).toEqual([
      'https://example.com/a',
      'https://example.com/d',
      'https://example.com/e',
      'https://example.com/b',
    ])
    expect(urls).toContain('https://Example.com/a/?utm_source=news')
    expect(calls.filter((call) => call.endpoint === SEARCH_ENDPOINT)).toHaveLength(3)
    expect(calls.filter((call) => call.endpoint === CHAT_ENDPOINT)).toHaveLength(1)
    const searchBody = calls.find((call) => call.endpoint === SEARCH_ENDPOINT)?.body as { numResults: number }
    expect(searchBody.numResults).toBe(4)
    expect(removed.some((id) => id.startsWith('locks_'))).toBe(true)
  })

  it('saves an empty investigation without calling the model', async () => {
    const calls: string[] = []
    const { tools, rows } = toolsFor('user_a', async (endpoint) => {
      calls.push(endpoint)
      return { success: true, data: { results: [] } }
    })
    const result = await investigateClaim({
      userId: 'user_a',
      params: { claim: 'A four-day week keeps output steady.' },
      tools,
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.status).toBe('empty')
    expect(calls).not.toContain(CHAT_ENDPOINT)
    expect(rows.filter((row) => row.collection === 'sources')).toHaveLength(0)
    expect(rows.find((row) => row.collection === 'investigations')?.data.status).toBe('empty')
  })

  it('does not save a record when every search fails', async () => {
    const { tools, rows } = toolsFor('user_a', async () => ({ success: false, error: 'Search is unavailable.' }))
    const result = await investigateClaim({
      userId: 'user_a',
      params: { claim: 'A four-day week keeps output steady.' },
      tools,
    })
    expect(result).toMatchObject({ success: false, error: 'Search is unavailable.' })
    expect(rows.some((row) => row.collection === 'investigations')).toBe(false)
  })

  it('stops before search when the daily limit is reached', async () => {
    let integrations = 0
    const { tools } = toolsFor(
      'user_a',
      async () => {
        integrations += 1
        return { success: false, error: 'should not run' }
      },
      8,
    )
    const result = await investigateClaim({
      userId: 'user_a',
      params: { claim: 'A four-day week keeps output steady.' },
      tools,
      now: new Date('2026-11-26T12:00:00.000Z'),
    })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toMatch(/Daily limit/)
    expect(integrations).toBe(0)
  })

  it('keeps the saved sources when a later source cannot be written', async () => {
    let sourceWrites = 0
    let chats = 0
    const { tools, rows } = toolsFor('user_a', async (endpoint) => {
      if (endpoint === CHAT_ENDPOINT) chats += 1
      if (endpoint === SEARCH_ENDPOINT) {
        return {
          success: true,
          data: {
            results: [
              hit('https://example.com/a', 'First excerpt long enough to keep.'),
              hit('https://example.com/b', 'Second excerpt long enough to keep.'),
            ],
          },
        }
      }
      return { success: false, error: 'should not run' }
    })
    const wrapped: InvestigationContext['tools'] = {
      ...tools,
      create: async (collection, data, recordId) => {
        if (collection === 'sources') {
          sourceWrites += 1
          if (sourceWrites === 2) return { success: false, error: 'write failed' }
        }
        return tools.create(collection, data, recordId)
      },
    }
    const result = await investigateClaim({
      userId: 'user_a',
      params: { claim: 'A four-day week keeps output steady.' },
      tools: wrapped,
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.status).toBe('error')
    expect(result.data.sourceCount).toBe(1)
    expect(rows.filter((row) => row.collection === 'sources')).toHaveLength(1)
    expect(rows.find((row) => row.collection === 'investigations')?.data.status).toBe('error')
    expect(chats).toBe(0)
  })

  it('rejects a short claim before any tool call', async () => {
    let creates = 0
    const { tools } = toolsFor('user_a', async () => ({ success: false, error: 'no' }))
    const wrapped: InvestigationContext['tools'] = {
      ...tools,
      create: async (...args) => {
        creates += 1
        return tools.create(...args)
      },
    }
    const result = await investigateClaim({ userId: 'user_a', params: { claim: 'short' }, tools: wrapped })
    expect(result.success).toBe(false)
    expect(creates).toBe(0)
  })

  it('does not let the request body choose the owner', async () => {
    const { tools, rows } = toolsFor('user_a', async () => ({ success: true, data: { results: [] } }))
    const result = await investigateClaim({
      userId: 'user_a',
      params: { claim: 'A four-day week keeps output steady.', userId: 'user_b' },
      tools,
    })
    expect(result.success).toBe(true)
    const investigation = rows.find((row) => row.collection === 'investigations')
    const usage = rows.find((row) => row.collection === 'usage')
    expect(investigation?.createdBy).toBe('user_a')
    expect(investigation?.data.userId).toBeUndefined()
    expect(usage?.data.userId).toBe('user_a')
  })

  it('refuses a second run of the same claim while one is in progress', async () => {
    let integrations = 0
    const claim = 'A four-day week keeps output steady.'
    const { tools, rows } = toolsFor('user_a', async () => {
      integrations += 1
      return { success: false, error: 'should not run' }
    })
    rows.push({
      collection: 'locks',
      recordId: 'locks_existing',
      createdBy: 'user_a',
      data: { userId: 'user_a', claimKey: claimKey(claim), startedAt: new Date().toISOString() },
    })
    const result = await investigateClaim({ userId: 'user_a', params: { claim }, tools })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toMatch(/already running/)
    expect(integrations).toBe(0)
  })

  it('stops a rate-limited search without saving an investigation', async () => {
    const { tools, rows } = toolsFor('user_a', async () => ({
      success: false,
      error: 'Too many requests.',
      code: 'rate_limited',
    }))
    const result = await investigateClaim({
      userId: 'user_a',
      params: { claim: 'A four-day week keeps output steady.' },
      tools,
    })
    expect(result).toMatchObject({
      success: false,
      error: 'The provider is busy. Wait a moment and try this once more.',
    })
    expect(rows.some((row) => row.collection === 'investigations')).toBe(false)
  })
})

describe('synthesizeInvestigation ownership', () => {
  it('does not call the model for someone else\'s investigation', async () => {
    let integrations = 0
    let queries = 0
    const { tools } = toolsFor('user_a', async () => {
      integrations += 1
      return { success: true, data: {} }
    })
    const ownedBySomeoneElse = {
      ...tools,
      get: async () => ({
        success: true,
        data: {
          record: envelope({
            collection: 'investigations',
            recordId: 'inv_other',
            createdBy: 'user_b',
            data: { claim: 'A four-day week keeps output steady.', status: 'ready', statusDetail: '', synthesis: '' },
          }),
        },
      }),
      query: async (...args: Parameters<InvestigationTools['query']>) => {
        queries += 1
        return tools.query(...args)
      },
    } as InvestigationTools
    const result = await synthesizeInvestigation({
      userId: 'user_a',
      params: { investigationId: 'inv_other' },
      tools: ownedBySomeoneElse,
    })
    expect(result.success).toBe(false)
    expect(integrations).toBe(0)
    expect(queries).toBe(0)
  })

  it('sends only included excerpts to the model', async () => {
    let userMessage = ''
    const { tools, rows } = toolsFor('user_a', async (_endpoint, body) => {
      const messages = (body as { messages: Array<{ content: string }> }).messages
      userMessage = messages[1]?.content ?? ''
      return {
        success: true,
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: 'The included card bears on the claim [s1].',
                  supporting: ['Point from the included card [s1].'],
                  challenging: [],
                  unresolved: [],
                }),
              },
            },
          ],
        },
      }
    })
    rows.push({
      collection: 'investigations',
      recordId: 'inv_1',
      createdBy: 'user_a',
      data: { claim: 'A four-day week keeps output steady.', status: 'ready', statusDetail: '', synthesis: '' },
    })
    rows.push(
      {
        collection: 'sources',
        recordId: 'src_1',
        createdBy: 'user_a',
        data: {
          investigationId: 'inv_1',
          position: 1,
          sourceKey: 's1',
          title: 'Included',
          url: 'https://example.com/in',
          excerpt: 'INCLUDED-SENTENCE-BLUE-HERON',
          stance: 'supporting',
          excluded: 'no',
        },
      },
      {
        collection: 'sources',
        recordId: 'src_2',
        createdBy: 'user_a',
        data: {
          investigationId: 'inv_1',
          position: 2,
          sourceKey: 's2',
          title: 'Excluded',
          url: 'https://example.com/out',
          excerpt: 'EXCLUDED-SENTENCE-ORANGE-ZEBRA',
          stance: 'challenging',
          excluded: 'yes',
        },
      },
    )
    const result = await synthesizeInvestigation({
      userId: 'user_a',
      params: { investigationId: 'inv_1' },
      tools,
    })
    expect(result.success).toBe(true)
    expect(userMessage).toContain('INCLUDED-SENTENCE-BLUE-HERON')
    expect(userMessage).not.toContain('EXCLUDED-SENTENCE-ORANGE-ZEBRA')
    expect(rows.find((row) => row.recordId === 'inv_1')?.data.synthesis).toMatch(/included card/)
  })

  it('does not classify or delete someone else\'s investigation', async () => {
    let integrations = 0
    let deletes = 0
    const { tools } = toolsFor('user_a', async () => {
      integrations += 1
      return { success: true, data: {} }
    })
    const foreign = {
      ...tools,
      get: async () => ({
        success: true,
        data: {
          record: envelope({
            collection: 'investigations',
            recordId: 'inv_other',
            createdBy: 'user_b',
            data: { claim: 'A four-day week keeps output steady.', status: 'ready', statusDetail: '', synthesis: '' },
          }),
        },
      }),
      deleteWhere: async () => {
        deletes += 1
        return { success: true, data: { deleted: 1 } }
      },
    } as InvestigationTools
    const classified = await classifyInvestigation({
      userId: 'user_a',
      params: { investigationId: 'inv_other' },
      tools: foreign,
    })
    const removed = await deleteInvestigation({
      userId: 'user_a',
      params: { investigationId: 'inv_other' },
      tools: foreign,
    })
    expect(classified.success).toBe(false)
    expect(removed.success).toBe(false)
    expect(integrations).toBe(0)
    expect(deletes).toBe(0)
  })
})
