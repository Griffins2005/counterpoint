import type { CollectionSchema } from 'deepspace/schema'

const closed = { read: false, create: false, update: false, delete: false } as const

/**
 * One row per paid action. `slot` is 1..daily limit, unique with the user, UTC day, and kind,
 * so two requests cannot both pass a count check and exceed the cap. Clients cannot write or
 * delete these, so the cap cannot be reset from the browser.
 */
export const usageSchema: CollectionSchema = {
  name: 'usage',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true, userBound: true, immutable: true, maxLength: 200 },
    { name: 'day', storage: 'text', interpretation: 'plain', required: true, immutable: true, maxLength: 10 },
    { name: 'kind', storage: 'text', interpretation: 'plain', required: true, immutable: true, maxLength: 32 },
    { name: 'slot', storage: 'number', interpretation: 'plain', required: true, immutable: true },
  ],
  uniqueOn: ['userId', 'day', 'kind', 'slot'],
  ownerField: 'userId',
  permissions: {
    '*': closed,
    viewer: closed,
    member: closed,
    admin: { read: 'own', create: false, update: false, delete: false },
  },
}

/** Stops a second submission of the same claim or the same follow-up action while one is running. */
export const locksSchema: CollectionSchema = {
  name: 'locks',
  columns: [
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true, userBound: true, immutable: true, maxLength: 200 },
    { name: 'claimKey', storage: 'text', interpretation: 'plain', required: true, immutable: true, maxLength: 400 },
    { name: 'startedAt', storage: 'text', interpretation: 'plain', required: true, maxLength: 40 },
  ],
  uniqueOn: ['userId', 'claimKey'],
  ownerField: 'userId',
  permissions: {
    '*': closed,
    viewer: closed,
    member: closed,
    admin: { read: 'own', create: false, update: false, delete: false },
  },
}
