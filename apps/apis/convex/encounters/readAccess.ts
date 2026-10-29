import { canMemberReadRun } from '@artificer-toolkit/encounter-persistence/sessionReads'
import type { QueryCtx } from '../_generated/server'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireIdentity } from '../lib/identity'
import { encounterReadTransaction } from './encounterReadPorts'

/**
 * The one gate for reading an Encounter by ID (D87): the caller's Campaign authority over the Run,
 * refused as `unavailable` when a player may not read it. An unrevealed Run is indistinguishable
 * from a missing one.
 */
export async function readMemberEncounter(ctx: QueryCtx, encounterId: string) {
  const { userId } = await requireIdentity(ctx)
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', encounterId))
    .unique()
  if (!run) throw new Error('Encounter is unavailable.')
  const authority = await requireCampaignAuthority(ctx, run.campaignId, userId)
  if (
    !(await canMemberReadRun(
      encounterReadTransaction(ctx),
      run,
      authority.campaign,
      authority.membership
    ))
  )
    throw new Error('Encounter is unavailable.')
  return { run, userId, ...authority }
}
