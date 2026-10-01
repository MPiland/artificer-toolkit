import { recordConcentrationCheckRoll as recordStoredConcentrationCheckRoll } from '@artificer-toolkit/encounter-persistence/concentrationRollPersistence'
import type { EncounterWritePorts } from '@artificer-toolkit/encounter-persistence/ports'
import type { MutationCtx } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireSystem } from '../content/systemDocuments'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { retainUserRoll } from '../rollDocuments'

/** Logs a settled check with the owning transaction and bounded private roll history. */
export async function recordConcentrationCheckRoll(
  ctx: MutationCtx,
  input: Parameters<EncounterWritePorts['recordConcentrationCheckRoll']>[0]
) {
  return recordStoredConcentrationCheckRoll(
    {
      db: createConvexEncounterStore(ctx),
      ports: {
        requireCampaignAuthority: (campaignId, userId) =>
          requireCampaignAuthority(ctx, campaignId, userId),
        requireSystem: (systemId) => requireSystem(ctx, systemId)
      }
    },
    input,
    async (userId, roll, gmCampaignRoll) => {
      const retained = await ctx.db
        .query('userRollHistory')
        .withIndex('by_userId_id', (q) => q.eq('userId', userId).eq('id', roll.id))
        .unique()
      if (!retained) await retainUserRoll(ctx, userId, roll, gmCampaignRoll)
    }
  )
}
