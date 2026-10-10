import {
  encounterCommandResultDtoSchema,
  removeAreaTargetInputDtoSchema
} from '@artificer-toolkit/schema/api/encounters'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import {
  encounterAreaSettled,
  removeEncounterAreaTargetFromSnapshot
} from '@artificer-toolkit/rules-runtime/encounterAreaPending'
import { readNativeEncounterActionAdmission } from './actionAdmission.js'
import { areaActionPendingContext, readNativeAreaActionPending } from './actionAreaPending.js'
import { rejectDomain } from './domainRejections.js'
import { changedFields, readRunState } from './documents.js'
import { readEncounterGmProjection } from './nativeProjection.js'
import { readPendingRunDecision } from './pendingReads.js'
import { readPendingSnapshot, writePendingSnapshot } from './pendingSnapshots.js'
import type { EncounterPersistenceTransaction, EncounterReadTransaction } from './ports.js'

/**
 * Admits the GM's removal of one creature from a pending area, behind the same fences a removal
 * always has: the GM, an active Campaign, the pending area, and the Encounter, occurrence and caught
 * set the GM composed it against.
 */
export async function readAreaRemovalAdmission(
  ctx: EncounterReadTransaction,
  args: unknown,
  userId: string
) {
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
  if (!snapshot || snapshot.snapshotKind !== 'AGGREGATE_CHOICE' || !context)
    rejectDomain('DECISION_NOT_PENDING')
  if (
    run.version !== input.expectedVersion ||
    occurrence.version !== input.expectedOccurrenceVersion ||
    context.caughtChecksum !== input.expectedCaughtChecksum
  )
    rejectDomain('VERSION_STALE')
  return { input, run, campaign, membership, occurrence, snapshot, context }
}

/**
 * Admits the removal that settles its area, and with it the area's own root command, resumed: the
 * commit it triggers is the one the last creature's answer would have made.
 */
export async function readAreaRemovalCommitAdmission(
  ctx: EncounterReadTransaction,
  args: unknown,
  userId: string
) {
  const removal = await readAreaRemovalAdmission(ctx, args, userId)
  const { command } = await readNativeAreaActionPending(ctx, removal.occurrence)
  const admission = await readNativeEncounterActionAdmission(ctx, command, userId, {
    occurrence: removal.occurrence,
    initiatorUserId: removal.context.initiatorUserId
  })
  return { removal, admission }
}

/**
 * The area as the removal leaves it, which only a removal that is not a retry and names a creature
 * the area still waits on can produce. Nothing is written.
 */
export function applyAreaRemoval(
  admitted: Pick<Awaited<ReturnType<typeof readAreaRemovalAdmission>>, 'input' | 'snapshot'>
) {
  const removal = removeEncounterAreaTargetFromSnapshot(admitted.snapshot, admitted.input.actorId)
  if (removal.kind !== 'REMOVED')
    rejectDomain(
      'TARGET_UNAVAILABLE',
      removal.kind === 'ANSWERED'
        ? 'That creature has already rolled its save.'
        : "That creature isn't caught by this area."
    )
  return removal.snapshot
}

/**
 * The GM takes one creature out of a pending area before its saves are rolled. While the area still
 * waits on another creature it stays pending: the Encounter does not move, the occurrence's version
 * does, so a save answer or removal composed against the earlier caught set is stale. A creature
 * already removed is a retry, answered with the area as it now stands. A removal that leaves nothing
 * to wait on writes nothing and returns null: the caller commits the area with it, as the last
 * answer would have.
 */
export async function removeAreaActionTarget(ctx: EncounterPersistenceTransaction, args: unknown) {
  const { userId } = await ctx.ports.requireIdentity()
  const admitted = await readAreaRemovalAdmission(ctx, args, userId)
  const { input, run, campaign, membership, occurrence, context } = admitted

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
  // Replay by state, after the fence: a current-version removal of an already removed creature.
  if (context.removedActorIds.includes(input.actorId)) return settled()
  const removed = applyAreaRemoval(admitted)
  if (encounterAreaSettled(removed)) return null

  const { _id, _creationTime, ...stored } = occurrence
  const next = {
    ...stored,
    version: occurrence.version + 1,
    pendingSnapshotChecksum: await writePendingSnapshot(ctx, occurrence, removed),
    updatedAt: new Date().toISOString()
  }
  await ctx.db.patch(
    _id,
    changedFields(occurrence, encounterStoredRuleOccurrenceSchema.parse(next))
  )
  return settled()
}
