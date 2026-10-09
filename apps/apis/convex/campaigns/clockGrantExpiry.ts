import { v } from 'convex/values'
import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { expiredCarriedOverGrants } from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import { executeCharacterSheetCommand } from '../characters/sheetCommands'
import { loadCharacterSheet } from '../characters/sheetPreparation'
import { encounterWriteTransaction } from '../encounters/encounterPorts'
import { readFightingCharacters } from '../liveSessions/characterHolds'
import { requireIdentity } from '../lib/identity'
import { internalMutation } from '../lib/mutations'
import { requireCampaignAuthority } from './authority'

/**
 * D99: when the Campaign clock reaches a carried-over grant's expiry, the Campaign owner's pass
 * ends it. A fighting Character keeps it: the live room owns that Character's play state, and
 * the grant is checked again on the next advance after the Run completes.
 */
export const endExpired = internalMutation({
  args: { campaignId: v.string(), actorUserId: v.string(), clockMinute: v.number() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const { userId } = await requireIdentity(ctx)
    if (userId !== args.actorUserId) throw new Error('Campaign not found.')
    const { campaign, membership } = await requireCampaignAuthority(ctx, args.campaignId, userId)
    if (membership.role !== 'OWNER') rejectDomain('CAMPAIGN_NOT_FOUND')
    if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
    const fighting = new Set(
      (
        await readFightingCharacters(
          ctx,
          args.campaignId,
          await ctx.db
            .query('encounterRuns')
            .withIndex('by_campaignId_status', (q) =>
              q.eq('campaignId', args.campaignId).eq('status', 'ACTIVE')
            )
            .collect()
        )
      ).map((entry) => entry.characterId)
    )
    const store = createActiveRuleEffectStore(encounterWriteTransaction(ctx))
    const assignments = await ctx.db
      .query('campaignCharacterAssignments')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', args.campaignId))
      .collect()
    assignments.sort((left, right) => left.characterId.localeCompare(right.characterId))
    for (const { characterId } of assignments) {
      if (fighting.has(characterId)) continue
      const expired = expiredCarriedOverGrants(
        await store.list({ kind: 'CHARACTER', characterId }),
        args.clockMinute
      )
      if (expired.length === 0) continue
      const current = await loadCharacterSheet(ctx, userId, characterId, args.campaignId)
      if (!current) throw new Error('Assigned Character not found.')
      let expectedVersion = current.active.play.streamVersion
      for (const effect of expired) {
        const result = await executeCharacterSheetCommand(
          ctx,
          userId,
          {
            id: characterId,
            command: {
              type: 'END_ACTIVE_EFFECT',
              commandId: crypto.randomUUID(),
              expectedVersion,
              effectId: effect.id
            }
          },
          args.campaignId
        )
        expectedVersion = result.streamVersion
      }
    }
    return null
  }
})
