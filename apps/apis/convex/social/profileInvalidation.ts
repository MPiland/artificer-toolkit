import {
  socialStoredProfileInvalidationSchema,
  type SocialStoredListing
} from '@artificer-toolkit/schema/projections/socialPersistence'
import type { QueryCtx } from '../_generated/server'

export async function readProfileInvalidation(
  ctx: QueryCtx,
  identity: { profileId: string } | { userId: string },
  generation: number | null
) {
  const query = ctx.db.query('socialProfileInvalidations')
  const indexed =
    'profileId' in identity
      ? query.withIndex('by_profileId_generation', (q) =>
          generation === null
            ? q.eq('profileId', identity.profileId)
            : q.eq('profileId', identity.profileId).gt('generation', generation)
        )
      : query.withIndex('by_userId_generation', (q) =>
          generation === null
            ? q.eq('userId', identity.userId)
            : q.eq('userId', identity.userId).gt('generation', generation)
        )
  const row = await indexed.order(generation === null ? 'desc' : 'asc').first()
  if (!row) return null
  const { _id, _creationTime, committedAt, ...stored } = row
  const event = socialStoredProfileInvalidationSchema.parse(stored)
  if (generation !== null && event.generation !== generation + 1)
    throw new Error('Social profile invalidation is unavailable.')
  return { ...event, committedAt }
}

/** Read-time closure survives restoration before physical cleanup; edits retain the latest generation. */
export async function resolveListingSuspension(ctx: QueryCtx, listing: SocialStoredListing) {
  const generation = listing.ownerProfileGeneration ?? 0
  const latest = await readProfileInvalidation(ctx, { userId: listing.ownerUserId }, null)
  if (!latest || latest.generation <= generation) return listing
  const first =
    latest.generation === generation + 1
      ? latest
      : await readProfileInvalidation(ctx, { userId: listing.ownerUserId }, generation)
  if (!first) throw new Error('Social profile invalidation is unavailable.')
  return {
    ...listing,
    ownerProfileGeneration: latest.generation,
    ...(listing.status === 'CLOSED'
      ? {}
      : {
          status: 'CLOSED' as const,
          version: listing.version + 1,
          updatedAt: first.invalidatedAt
        })
  }
}
