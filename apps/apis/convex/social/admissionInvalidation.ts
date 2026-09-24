import { socialStoredBlockInvalidationSchema } from '@artificer-toolkit/schema/projections/socialPersistence'
import type { QueryCtx } from '../_generated/server'
import { readListingInvalidation } from './listingInvalidation'
import { readProfileInvalidation } from './profileInvalidation'

/** The caller supplies the pre-transition owner when closing or transferring a listing. */
export async function readAdmissionInvalidation(
  ctx: QueryCtx,
  ownerUserId: string,
  participant: { profileId: string } | { userId: string },
  requestGeneration: number,
  listing: { id: string; generation: number },
  profileGenerations: { ownerProfileGeneration?: number; participantProfileGeneration?: number }
) {
  // Event identity survives account/profile deletion; the earliest later generation owns history.
  const rows = await Promise.all(
    'profileId' in participant
      ? [
          ctx.db
            .query('socialBlockInvalidations')
            .withIndex('by_firstProfileId_secondUserId_generation', (q) =>
              q
                .eq('firstProfileId', participant.profileId)
                .eq('secondUserId', ownerUserId)
                .gt('generation', requestGeneration)
            )
            .first(),
          ctx.db
            .query('socialBlockInvalidations')
            .withIndex('by_secondProfileId_firstUserId_generation', (q) =>
              q
                .eq('secondProfileId', participant.profileId)
                .eq('firstUserId', ownerUserId)
                .gt('generation', requestGeneration)
            )
            .first()
        ]
      : [
          ctx.db
            .query('socialBlockInvalidations')
            .withIndex('by_firstUserId_secondUserId_generation', (q) =>
              q
                .eq('firstUserId', participant.userId)
                .eq('secondUserId', ownerUserId)
                .gt('generation', requestGeneration)
            )
            .first(),
          ctx.db
            .query('socialBlockInvalidations')
            .withIndex('by_firstUserId_secondUserId_generation', (q) =>
              q
                .eq('firstUserId', ownerUserId)
                .eq('secondUserId', participant.userId)
                .gt('generation', requestGeneration)
            )
            .first()
        ]
  )
  const present = rows.filter((row) => row !== null)
  if (present.length > 1) throw new Error('Social block invalidation is unavailable.')
  const row = present[0]
  const [listingEvent, ownerEvent, participantEvent] = await Promise.all([
    readListingInvalidation(ctx, listing.id, listing.generation),
    readProfileInvalidation(
      ctx,
      { userId: ownerUserId },
      profileGenerations.ownerProfileGeneration ?? 0
    ),
    readProfileInvalidation(ctx, participant, profileGenerations.participantProfileGeneration ?? 0)
  ])
  const event = row
    ? socialStoredBlockInvalidationSchema.parse({
        firstProfileId: row.firstProfileId,
        secondProfileId: row.secondProfileId,
        firstUserId: row.firstUserId,
        secondUserId: row.secondUserId,
        generation: row.generation,
        invalidatedAt: row.invalidatedAt
      })
    : null
  if (event && event.generation !== requestGeneration + 1)
    throw new Error('Social block invalidation is unavailable.')
  const events = [
    event ? { ...event, committedAt: row?.committedAt, kind: 'BLOCK' as const } : null,
    listingEvent ? { ...listingEvent, kind: 'LISTING' as const } : null,
    ownerEvent ? { ...ownerEvent, kind: 'PROFILE' as const } : null,
    participantEvent ? { ...participantEvent, kind: 'PROFILE' as const } : null
  ].filter((candidate) => candidate !== null)
  // Stable order breaks same-commit ties; legacy blocks precede committed events, then placeholders.
  events.sort((a, b) => {
    if (a.committedAt === b.committedAt) return 0
    if (a.committedAt === undefined) return -1
    if (b.committedAt === undefined) return 1
    if (typeof a.committedAt !== 'bigint') return typeof b.committedAt === 'bigint' ? 1 : 0
    if (typeof b.committedAt !== 'bigint') return -1
    return a.committedAt < b.committedAt ? -1 : 1
  })
  return events[0] ?? null
}

type AdmissionInvalidation = NonNullable<Awaited<ReturnType<typeof readAdmissionInvalidation>>>

export function applicationInvalidationPatch(version: number, event: AdmissionInvalidation) {
  return {
    ...(event.kind === 'BLOCK'
      ? { status: 'BLOCKED' as const, blockedAt: event.invalidatedAt }
      : { status: 'EXPIRED' as const, expiredAt: event.invalidatedAt }),
    updatedAt: event.invalidatedAt,
    version: version + 1
  }
}

export function invitationInvalidationPatch(version: number, event: AdmissionInvalidation) {
  return {
    ...(event.kind === 'BLOCK'
      ? { status: 'REVOKED' as const, revokedAt: event.invalidatedAt }
      : { status: 'EXPIRED' as const, expiredAt: event.invalidatedAt }),
    updatedAt: event.invalidatedAt,
    version: version + 1
  }
}
