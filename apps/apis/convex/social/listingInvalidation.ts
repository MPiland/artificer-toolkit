import { socialStoredListingInvalidationSchema } from '@artificer-toolkit/schema/projections/socialPersistence'
import type { QueryCtx } from '../_generated/server'

/** Null reads the current generation; a request generation reads its first later invalidation. */
export async function readListingInvalidation(
  ctx: QueryCtx,
  listingId: string,
  generation: number | null
) {
  const query = ctx.db
    .query('socialListingInvalidations')
    .withIndex('by_listingId_generation', (q) =>
      generation === null
        ? q.eq('listingId', listingId)
        : q.eq('listingId', listingId).gt('generation', generation)
    )
  const row = await query.order(generation === null ? 'desc' : 'asc').first()
  if (!row) return null
  const { _id, _creationTime, committedAt, ...stored } = row
  const event = socialStoredListingInvalidationSchema.parse(stored)
  if (generation !== null && event.generation !== generation + 1)
    throw new Error('Social listing invalidation is unavailable.')
  return { ...event, committedAt }
}
