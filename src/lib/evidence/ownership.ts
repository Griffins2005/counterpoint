/** True when the caller is the record's creator. Anonymous ids never own a row. */
export function sameOwner(createdBy: unknown, userId: unknown): boolean {
  return (
    typeof createdBy === 'string' &&
    typeof userId === 'string' &&
    createdBy.length > 0 &&
    userId.length > 0 &&
    !userId.startsWith('anon-') &&
    createdBy === userId
  )
}

export const NOT_AVAILABLE = 'That investigation is not available.'
