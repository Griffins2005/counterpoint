import type { CollectionSchema } from 'deepspace/schema'

const closed = { read: false, create: false, update: false, delete: false } as const

/**
 * One investigation per claim run. Clients can read and delete only their own
 * rows. Creates and synthesis writes happen in server actions, which check
 * `createdBy` again because actions bypass collection RBAC.
 */
export const investigationsSchema: CollectionSchema = {
  name: 'investigations',
  columns: [
    { name: 'claim', storage: 'text', interpretation: 'plain', required: true, immutable: true, maxLength: 400 },
    {
      name: 'status',
      storage: 'text',
      interpretation: { kind: 'select', options: ['ready', 'empty', 'partial', 'error'] },
      required: true,
      maxLength: 20,
    },
    { name: 'statusDetail', storage: 'text', interpretation: 'plain', maxLength: 500 },
    { name: 'synthesis', storage: 'text', interpretation: 'plain', maxLength: 12000 },
  ],
  permissions: {
    '*': closed,
    viewer: closed,
    member: { read: 'own', create: false, update: false, delete: false },
    admin: { read: 'own', create: false, update: false, delete: false },
  },
}
