import { v } from 'convex/values'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { internalQuery } from '../lib/queries'
import { requireFixtureAccount } from '../lib/developmentFixtures'

// Exact completed-cohort recovery; returns no data and performs no cleanup writes.
export const assertRemoved = internalQuery({
  args: {
    campaignId: v.string(),
    characterIds: v.array(v.string()),
    userIds: v.array(v.string()),
    systemId: v.string()
  },
  returns: v.null(),
  handler: async (ctx, { campaignId, characterIds, userIds, systemId }) => {
    if (
      characterIds.length !== 2 ||
      new Set(characterIds).size !== 2 ||
      userIds.length !== 3 ||
      new Set(userIds).size !== 3
    )
      throw new Error('Exact two-Character three-account fixture scope required.')
    for (const id of [campaignId, systemId, ...characterIds, ...userIds])
      postgresUuidSchema.parse(id)
    for (const userId of userIds) await requireFixtureAccount(ctx, userId)
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', campaignId))
      .unique()
    if (campaign) throw new Error('Exact fixture Campaign cleanup is incomplete.')
    for (const characterId of characterIds) {
      const [character, draft, route, receipt, assignment] = await Promise.all([
        ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', characterId))
          .unique(),
        ctx.db
          .query('characterDrafts')
          .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
          .unique(),
        ctx.db
          .query('authoredRouteIds')
          .withIndex('by_subjectId', (q) => q.eq('subjectId', characterId))
          .unique(),
        ctx.db
          .query('characterCommandReceipts')
          .withIndex('by_characterId_commandId', (q) => q.eq('characterId', characterId))
          .first(),
        ctx.db
          .query('campaignCharacterAssignments')
          .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
          .first()
      ])
      if (character || draft || route || receipt || assignment)
        throw new Error('Exact fixture Character cleanup is incomplete.')
    }
    for (const userId of userIds) {
      const [root, draft, source, membership, assignment, ownedCampaign, rolls] = await Promise.all(
        [
          ctx.db
            .query('authoredRoots')
            .withIndex('by_ownerUserId', (q) => q.eq('ownerUserId', userId))
            .first(),
          ctx.db
            .query('authoredDrafts')
            .withIndex('by_userId', (q) => q.eq('userId', userId))
            .first(),
          ctx.db
            .query('contentSources')
            .withIndex('by_gameSystemId_kind_ownerUserId', (q) =>
              q.eq('gameSystemId', systemId).eq('kind', 'USER').eq('ownerUserId', userId)
            )
            .first(),
          ctx.db
            .query('campaignMemberships')
            .withIndex('by_userId_status_joinedAt', (q) => q.eq('userId', userId))
            .first(),
          ctx.db
            .query('campaignCharacterAssignments')
            .withIndex('by_campaignId_userId', (q) =>
              q.eq('campaignId', campaignId).eq('userId', userId)
            )
            .first(),
          ctx.db
            .query('campaigns')
            .withIndex('by_ownerUserId_status', (q) => q.eq('ownerUserId', userId))
            .first(),
          ctx.db
            .query('userRollHistory')
            .withIndex('by_userId_createdAt_id', (q) => q.eq('userId', userId))
            .take(21)
        ]
      )
      if (
        root ||
        draft ||
        source ||
        membership ||
        assignment ||
        ownedCampaign ||
        rolls.length > 20 ||
        rolls.some((roll) => roll.characterId !== null && characterIds.includes(roll.characterId))
      )
        throw new Error('Exact fixture account retains product or private Character data.')
    }
    return null
  }
})
