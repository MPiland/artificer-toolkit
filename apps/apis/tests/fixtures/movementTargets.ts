import { loadMovementTargets } from '@artificer-toolkit/encounter-persistence/movementTargetReads'
import { readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import type { QueryCtx } from '../../convex/_generated/server'
import { requireCampaignAuthority } from '../../convex/campaigns/authority'
import { encounterTurnReadTransaction } from '../../convex/encounters/turnReadPorts'
import { requireIdentity } from '../../convex/lib/identity'

/** The signed-in caller's movement targets for a Run at its expected version, as a read sees them. */
export async function readMovementTargets(
  ctx: QueryCtx,
  input: {
    encounterId: string
    expectedEncounterVersion: number
    targetActorIds: readonly string[]
    includeReactionSources?: boolean
  }
) {
  const { userId } = await requireIdentity(ctx)
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!run) throw new Error('Encounter Run was not found.')
  const state = readRunState(run)
  const { campaign } = await requireCampaignAuthority(ctx, state.campaignId, userId)
  if (state.version !== input.expectedEncounterVersion) rejectDomain('VERSION_STALE')
  return loadMovementTargets(encounterTurnReadTransaction(ctx), {
    state,
    campaign,
    targetActorIds: input.targetActorIds,
    includeReactionSources: input.includeReactionSources
  })
}
