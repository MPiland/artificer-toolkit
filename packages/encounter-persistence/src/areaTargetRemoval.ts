import {
  encounterCommandResultDtoSchema,
  removeAreaTargetInputDtoSchema
} from '@artificer-toolkit/schema/api/encounters'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { removeEncounterAreaTarget } from '@artificer-toolkit/rules-runtime/encounterAreaPending'
import { areaActionPendingContext } from './actionAreaPending.js'
import { rejectDomain } from './domainRejections.js'
import { changedFields, readRunState } from './documents.js'
import { readEncounterGmProjection } from './nativeProjection.js'
import { readPendingRunDecision } from './pendingReads.js'
import { readPendingSnapshot, writePendingSnapshot } from './pendingSnapshots.js'
import type { EncounterPersistenceTransaction } from './ports.js'

/**
 * The GM takes one creature out of a pending area before its saves are rolled. The area stays
 * pending: the Encounter does not move, the occurrence's version does, so a save answer or removal
 * composed against the earlier caught set is stale. A creature already removed is a retry, answered
 * with the area as it now stands.
 */
export async function removeAreaActionTarget(ctx: EncounterPersistenceTransaction, args: unknown) {
  const { userId } = await ctx.ports.requireIdentity()
  const parsed = removeAreaTargetInputDtoSchema.parse(args)
  const input = {
    ...parsed,
    encounterId: parsed.encounterId.toLowerCase(),
    occurrenceId: parsed.occurrenceId.toLowerCase(),
    actorId: parsed.actorId.toLowerCase()
  }
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!run) throw new Error('Encounter is unavailable.')
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(run.campaignId, userId)
  if (membership.role !== 'OWNER') rejectDomain('GM_ONLY')
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  const occurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', input.occurrenceId))
    .unique()
  if (!occurrence || occurrence.campaignId !== campaign.id || occurrence.encounterId !== run.id)
    throw new Error('Rule occurrence is unavailable.')
  if (occurrence.state !== 'PENDING') rejectDomain('DECISION_NOT_PENDING')
  const snapshot = await readPendingSnapshot(ctx, occurrence)
  const context = snapshot && areaActionPendingContext(snapshot)
  if (!snapshot || !context) rejectDomain('DECISION_NOT_PENDING')

  const settled = async () => {
    const pending = await readPendingRunDecision(ctx, run, campaign, membership)
    if (!pending) throw new Error('Stored Encounter occurrence state is invalid.')
    return encounterCommandResultDtoSchema.parse({
      projection: await readEncounterGmProjection(ctx, readRunState(run)),
      roll: null,
      occurrence: {
        occurrenceId: pending.occurrenceId,
        occurrenceVersion: pending.occurrenceVersion,
        status: 'PENDING',
        pending
      }
    })
  }
  if (
    run.version !== input.expectedVersion ||
    occurrence.version !== input.expectedOccurrenceVersion ||
    context.caughtChecksum !== input.expectedCaughtChecksum
  )
    rejectDomain('VERSION_STALE')
  // Replay by state, after the fence: a current-version removal of an already removed creature.
  if (context.removedActorIds.includes(input.actorId)) return settled()
  const removal = removeEncounterAreaTarget(context, input.actorId)
  if (removal.kind !== 'REMOVED')
    rejectDomain(
      'TARGET_UNAVAILABLE',
      removal.kind === 'ANSWERED'
        ? 'That creature has already rolled its save.'
        : "That creature isn't caught by this area."
    )
  // Removing the creature the area still waits on would leave nothing to answer, so nothing to commit it.
  if (
    removal.targets.every(
      (target) =>
        target.testedJson !== undefined &&
        (target.legendaryResistance === undefined ||
          target.legendaryResistance.decision !== undefined)
    )
  )
    rejectDomain(
      'TARGET_UNAVAILABLE',
      'The area waits on no other creature, so it cannot resolve without this one.'
    )

  const { _id, _creationTime, ...stored } = occurrence
  const next = {
    ...stored,
    version: occurrence.version + 1,
    pendingSnapshotChecksum: await writePendingSnapshot(
      ctx,
      occurrence,
      serverRuleExecutionPendingSnapshotDtoSchema.parse({
        ...snapshot,
        applicationContext: {
          ...context,
          targets: removal.targets,
          removedActorIds: removal.removedActorIds,
          caughtChecksum: removal.caughtChecksum
        }
      })
    ),
    updatedAt: new Date().toISOString()
  }
  await ctx.db.patch(
    _id,
    changedFields(occurrence, encounterStoredRuleOccurrenceSchema.parse(next))
  )
  return settled()
}
