import type { CollectionSchema } from 'deepspace/schema'

const closed = { read: false, create: false, update: false, delete: false } as const

/**
 * Retrieved sources. URL, title, and excerpt are immutable so a client cannot
 * replace them after the search write. Members may change only the working
 * label and whether the source is excluded from synthesis.
 */
export const sourcesSchema: CollectionSchema = {
  name: 'sources',
  columns: [
    { name: 'investigationId', storage: 'text', interpretation: 'plain', required: true, immutable: true, maxLength: 200 },
    { name: 'position', storage: 'number', interpretation: 'plain', required: true, immutable: true },
    { name: 'sourceKey', storage: 'text', interpretation: 'plain', required: true, immutable: true, maxLength: 16 },
    { name: 'title', storage: 'text', interpretation: 'plain', required: true, immutable: true, maxLength: 300 },
    { name: 'url', storage: 'text', interpretation: 'plain', required: true, immutable: true, maxLength: 2000 },
    { name: 'excerpt', storage: 'text', interpretation: 'plain', required: true, immutable: true, maxLength: 1400 },
    { name: 'author', storage: 'text', interpretation: 'plain', immutable: true, maxLength: 180 },
    { name: 'publishedDate', storage: 'text', interpretation: 'plain', immutable: true, maxLength: 40 },
    { name: 'providerId', storage: 'text', interpretation: 'plain', immutable: true, maxLength: 200 },
    {
      name: 'stance',
      storage: 'text',
      interpretation: { kind: 'select', options: ['supporting', 'challenging', 'inconclusive'] },
      required: true,
      maxLength: 20,
    },
    {
      name: 'modelStance',
      storage: 'text',
      interpretation: { kind: 'select', options: ['supporting', 'challenging', 'inconclusive'] },
      required: true,
      maxLength: 20,
    },
    { name: 'reasoning', storage: 'text', interpretation: 'plain', maxLength: 800 },
    {
      name: 'excluded',
      storage: 'text',
      interpretation: { kind: 'select', options: ['yes', 'no'] },
      required: true,
      maxLength: 3,
    },
  ],
  permissions: {
    '*': closed,
    viewer: closed,
    member: {
      read: 'own',
      create: false,
      update: 'own',
      delete: false,
      writableFields: ['stance', 'excluded'],
    },
    admin: {
      read: 'own',
      create: false,
      update: 'own',
      delete: false,
      writableFields: ['stance', 'excluded'],
    },
  },
}
