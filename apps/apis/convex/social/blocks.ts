import { v } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  socialBlockDtoSchema,
  socialBlockInputSchema,
  type SocialBlockDto
} from '@artificer-toolkit/schema/api/socialHub'
import {
  socialStoredBlockSchema,
  socialStoredBlockInvalidationSchema,
  socialStoredProfileSchema
} from '@artificer-toolkit/schema/projections/socialPersistence'
import {
  socialBlockStatusSchema,
  type SocialBlockStatus
} from '@artificer-toolkit/schema/api/socialBlockLists'
import { query, type QueryCtx } from '../_generated/server'
import { mutation } from '../lib/mutations'
import { presentSocialProfile, requireSocialViewer } from './visibility'
import { consumeSocialRateLimit } from '../lib/rateLimits'
import { readBlockInvalidation } from './blockInvalidation'
import { makeFunctionReference } from 'convex/server'

const cleanupBlocks = makeFunctionReference<
  'mutation',
  {
    firstProfileId: string
    secondProfileId: string
    firstUserId: string
    secondUserId: string
    generation: number
    invalidatedAt: string
    phase: 'APPLICATION_FIRST'
    cursor: null
  },
  null
>('social/blockCleanup:run')

async function readProfileByPublicId(ctx: QueryCtx, id: string) {
  const row = await ctx.db
    .query('socialProfiles')
    .withIndex('by_publicId', (q) => q.eq('id', id.toLowerCase()))
    .unique()
  if (!row) return null
  const { _id, _creationTime, ...stored } = row
  return socialStoredProfileSchema.parse(stored)
}

export const getStatus = query({
  args: zodToConvexFields(socialBlockInputSchema.shape),
  returns: zodToConvex(socialBlockStatusSchema),
  handler: async (ctx, args): Promise<SocialBlockStatus> => {
    const actor = await requireSocialViewer(ctx)
    const { profilePublicId } = socialBlockInputSchema.parse(args)
    const target = await readProfileByPublicId(ctx, profilePublicId)
    if (!target) return { blocked: false }
    const row = await ctx.db
      .query('socialBlocks')
      .withIndex('by_blockerProfileId_blockedProfileId', (q) =>
        q.eq('blockerProfileId', actor.id).eq('blockedProfileId', target.id)
      )
      .unique()
    return { blocked: row !== null }
  }
})

export const create = mutation({
  args: zodToConvexFields(socialBlockInputSchema.shape),
  returns: zodToConvex(socialBlockDtoSchema),
  handler: async (ctx, args): Promise<SocialBlockDto> => {
    const input = socialBlockInputSchema.parse(args)
    const actor = await requireSocialViewer(ctx)
    const target = await readProfileByPublicId(ctx, input.profilePublicId)
    if (!target || target.status !== 'ACTIVE' || target.id === actor.id)
      throw new Error('Social profile not found.')
    const existing = await ctx.db
      .query('socialBlocks')
      .withIndex('by_blockerProfileId_blockedProfileId', (q) =>
        q.eq('blockerProfileId', actor.id).eq('blockedProfileId', target.id)
      )
      .unique()
    const reverse = await ctx.db
      .query('socialBlocks')
      .withIndex('by_blockerProfileId_blockedProfileId', (q) =>
        q.eq('blockerProfileId', target.id).eq('blockedProfileId', actor.id)
      )
      .unique()
    if (reverse) throw new Error('Social profile not found.')
    if (existing) throw new Error('This Social profile is already blocked.')
    await consumeSocialRateLimit(ctx, actor.userId, 'BLOCK')
    const now = new Date().toISOString()
    const { pair, invalidation } = await readBlockInvalidation(ctx, actor, target)
    const generation = (invalidation?.generation ?? 0) + 1
    const nextInvalidation = { ...pair, generation, invalidatedAt: now }
    await ctx.db.insert('socialBlockInvalidations', {
      ...nextInvalidation,
      committedAt: ctx.db.vars.commitTs
    })
    await ctx.db.insert(
      'socialBlocks',
      socialStoredBlockSchema.parse({
        blockerProfileId: actor.id,
        blockedProfileId: target.id,
        createdAt: now,
        invalidationGeneration: generation
      })
    )
    await ctx.scheduler.runAfter(0, cleanupBlocks, {
      firstProfileId: pair.firstProfileId,
      secondProfileId: pair.secondProfileId,
      firstUserId: pair.firstUserId,
      secondUserId: pair.secondUserId,
      generation,
      invalidatedAt: now,
      phase: 'APPLICATION_FIRST',
      cursor: null
    })
    return socialBlockDtoSchema.parse({
      profile: await presentSocialProfile(ctx, target),
      createdAt: now
    })
  }
})

export const remove = mutation({
  args: zodToConvexFields(socialBlockInputSchema.shape),
  returns: v.null(),
  handler: async (ctx, args) => {
    const input = socialBlockInputSchema.parse(args)
    const actor = await requireSocialViewer(ctx)
    const block = await ctx.db
      .query('socialBlocks')
      .withIndex('by_blockerProfileId_blockedProfileId', (q) =>
        q
          .eq('blockerProfileId', actor.id)
          .eq('blockedProfileId', input.profilePublicId.toLowerCase())
      )
      .unique()
    if (!block) throw new Error('Social block not found.')
    await consumeSocialRateLimit(ctx, actor.userId, 'BLOCK')
    const target = await readProfileByPublicId(ctx, block.blockedProfileId)
    if (block.invalidationGeneration === undefined) {
      if (target) {
        const now = new Date().toISOString()
        const { pair, invalidation } = await readBlockInvalidation(ctx, actor, target)
        const generation = (invalidation?.generation ?? 0) + 1
        const nextInvalidation = { ...pair, generation, invalidatedAt: now }
        await ctx.db.insert('socialBlockInvalidations', {
          ...nextInvalidation,
          committedAt: ctx.db.vars.commitTs
        })
        await ctx.scheduler.runAfter(0, cleanupBlocks, {
          firstProfileId: pair.firstProfileId,
          secondProfileId: pair.secondProfileId,
          firstUserId: pair.firstUserId,
          secondUserId: pair.secondUserId,
          generation,
          invalidatedAt: now,
          phase: 'APPLICATION_FIRST',
          cursor: null
        })
      }
    } else {
      const [firstProfileId, secondProfileId] = [actor.id, block.blockedProfileId].sort()
      const row = await ctx.db
        .query('socialBlockInvalidations')
        .withIndex('by_firstProfileId_secondProfileId_generation', (q) =>
          q
            .eq('firstProfileId', firstProfileId!)
            .eq('secondProfileId', secondProfileId!)
            .eq('generation', block.invalidationGeneration!)
        )
        .unique()
      if (!row) throw new Error('Social block invalidation is unavailable.')
      const { _id, _creationTime, committedAt: _committedAt, ...stored } = row
      const invalidation = socialStoredBlockInvalidationSchema.parse(stored)
      const actorUserId =
        actor.id === firstProfileId ? invalidation.firstUserId : invalidation.secondUserId
      const targetUserId =
        actor.id === firstProfileId ? invalidation.secondUserId : invalidation.firstUserId
      if (actorUserId !== actor.userId || (target && target.userId !== targetUserId))
        throw new Error('Social block invalidation is unavailable.')
    }
    await ctx.db.delete(block._id)
    return null
  }
})
