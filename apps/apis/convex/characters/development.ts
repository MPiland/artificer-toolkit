import { v } from 'convex/values'
import { internalMutation } from '../lib/mutations'
import { requireFixtureAccount } from '../lib/developmentFixtures'
import { syncAccountUsage } from '../lib/accountUsage'
import { releaseAsset } from '../media/assets'

// This is not personal Character/account deletion. It only retires isolated test data.
export const removePersonalFixtureCharacter = internalMutation({
  args: { userId: v.string(), characterId: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId, characterId }) => {
    await requireFixtureAccount(ctx, userId)
    const [character, draft, route, membership, campaign, assignment] = await Promise.all([
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
        .query('campaignMemberships')
        .withIndex('by_userId_status_joinedAt', (q) => q.eq('userId', userId))
        .first(),
      ctx.db
        .query('campaigns')
        .withIndex('by_ownerUserId_status', (q) => q.eq('ownerUserId', userId))
        .first(),
      ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
        .first()
    ])
    // Retained LEFT membership also rejects: no Campaign history/custody lifecycle is attempted.
    if (membership || campaign || assignment)
      throw new Error('Campaign-linked fixture cleanup is not supported.')
    if (
      (character && character.userId !== userId) ||
      (draft && draft.userId !== userId) ||
      (route && (route.subjectKind !== 'CHARACTER' || route.ownerUserId !== userId)) ||
      ((character || draft) && !route) ||
      (character && draft && character.systemId !== draft.systemId)
    )
      throw new Error('Fixture Character ownership or route mismatch.')
    const [receipts, rolls] = await Promise.all([
      ctx.db
        .query('characterCommandReceipts')
        .withIndex('by_characterId_commandId', (q) => q.eq('characterId', characterId))
        .take(101),
      ctx.db
        .query('userRollHistory')
        .withIndex('by_userId_createdAt_id', (q) => q.eq('userId', userId))
        .take(21)
    ])
    // ponytail: isolated proofs use <=100 commands and the normal 20-roll private retention.
    // Larger fixtures need paginated cleanup before raising either complete-or-fail bound.
    if (
      receipts.length > 100 ||
      rolls.length > 20 ||
      receipts.some((receipt) => receipt.actorId !== userId)
    )
      throw new Error('Fixture private-history bounds or ownership mismatch.')
    for (const receipt of receipts) await ctx.db.delete(receipt._id)
    for (const roll of rolls) if (roll.characterId === characterId) await ctx.db.delete(roll._id)
    if (character?.portraitAssetId) {
      const portraitAssetId = character.portraitAssetId
      const portrait = await ctx.db
        .query('mediaAssets')
        .withIndex('by_publicId', (q) => q.eq('id', portraitAssetId))
        .unique()
      if (!portrait || portrait.ownerUserId !== userId)
        throw new Error('Fixture Character portrait ownership mismatch.')
      await releaseAsset(ctx, portrait.id)
    }
    if (draft) await ctx.db.delete(draft._id)
    if (character) await ctx.db.delete(character._id)
    if (route) await ctx.db.delete(route._id)
    await syncAccountUsage(ctx, 'personalCharacters', characterId)
    return null
  }
})
