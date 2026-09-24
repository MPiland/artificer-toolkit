import {
  socialStoredBlockInvalidationSchema,
  type SocialStoredProfile
} from '@artificer-toolkit/schema/projections/socialPersistence'
import type { QueryCtx } from '../_generated/server'

export function orderedSocialPair(
  first: Pick<SocialStoredProfile, 'id' | 'userId'>,
  second: Pick<SocialStoredProfile, 'id' | 'userId'>
) {
  return first.id < second.id
    ? {
        firstProfileId: first.id,
        secondProfileId: second.id,
        firstUserId: first.userId,
        secondUserId: second.userId
      }
    : {
        firstProfileId: second.id,
        secondProfileId: first.id,
        firstUserId: second.userId,
        secondUserId: first.userId
      }
}

export async function readBlockInvalidation(
  ctx: QueryCtx,
  first: Pick<SocialStoredProfile, 'id' | 'userId'>,
  second: Pick<SocialStoredProfile, 'id' | 'userId'>
) {
  const pair = orderedSocialPair(first, second)
  const row = await ctx.db
    .query('socialBlockInvalidations')
    .withIndex('by_firstProfileId_secondProfileId_generation', (q) =>
      q.eq('firstProfileId', pair.firstProfileId).eq('secondProfileId', pair.secondProfileId)
    )
    .order('desc')
    .first()
  if (!row) return { pair, invalidation: null }
  const { _id, _creationTime, committedAt: _committedAt, ...stored } = row
  const invalidation = socialStoredBlockInvalidationSchema.parse(stored)
  if (
    invalidation.firstUserId !== pair.firstUserId ||
    invalidation.secondUserId !== pair.secondUserId
  )
    throw new Error('Social block invalidation is unavailable.')
  return { pair, invalidation: { rowId: _id, ...invalidation } }
}
