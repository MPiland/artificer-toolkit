import {
  encounterCommandResultDtoSchema,
  encounterGmProjectionDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounterData'
import { projectPlayerEncounterProjection } from '@artificer-toolkit/rules-runtime/encounterPlayerProjection'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { readPendingRunDecision } from './pendingReads.js'
import { replayEncounterCommandResult } from './replayReceipts.js'
import { readEncounterHealthViewer } from './healthViewer.js'
import type { EncounterDocument } from './store.js'
import type { EncounterReadTransaction } from './ports.js'

/**
 * The one presentation of an Encounter command result or replay (ADR 0034 decision 1). The GM gets
 * the GM projection. Everyone else gets the player projection, which omits hidden actors, GM notes,
 * stat blocks and resources, and shows health only at each actor's display level. Either way the pending decision is the one `pendingReads` shows
 * that member, with its roll-mode reasons. Call it after the command's writes: the pending decision is
 * read from the current Run.
 */
export async function presentEncounterResultForMember(
  ctx: EncounterReadTransaction,
  input: {
    campaign: EncounterDocument<'campaigns'>
    membership: EncounterDocument<'campaignMemberships'>
    result: EncounterCommandResultDto
  }
): Promise<EncounterCommandResultDto> {
  const { campaign, membership, result } = input
  const projection = encounterGmProjectionDtoSchema.parse(result.projection)
  let pending = null
  if (result.occurrence?.pending) {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', projection.id))
      .unique()
    if (!row || row.campaignId !== campaign.id) throw new Error('Encounter is unavailable.')
    const current = await readPendingRunDecision(ctx, row, campaign, membership)
    // A replay of a decision that has since moved on keeps the GM's recorded summary.
    pending =
      current?.occurrenceId === result.occurrence.occurrenceId &&
      current.occurrenceVersion === result.occurrence.occurrenceVersion
        ? current
        : membership.role === 'OWNER'
          ? result.occurrence.pending
          : null
  }
  return encounterCommandResultDtoSchema.parse({
    ...result,
    projection:
      membership.role === 'OWNER'
        ? projection
        : projectPlayerEncounterProjection(
            projection,
            await readEncounterHealthViewer(ctx, projection, membership.userId)
          ),
    occurrence: result.occurrence && { ...result.occurrence, pending }
  })
}

/** A stored command's exact replay, presented for the member who retried it. */
export async function presentStoredCommandReplay(
  ctx: EncounterReadTransaction,
  input: {
    state: EncounterRunState
    campaign: EncounterDocument<'campaigns'>
    membership: EncounterDocument<'campaignMemberships'>
    stored: Parameters<typeof replayEncounterCommandResult>[2]
  }
): Promise<EncounterCommandResultDto> {
  const { state, campaign, membership, stored } = input
  return presentEncounterResultForMember(ctx, {
    campaign,
    membership,
    result: await replayEncounterCommandResult(ctx, state, stored)
  })
}
