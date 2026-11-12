import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/api/encounters'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type {
  ServerAggregateChoicePendingSnapshotDto,
  ServerRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import {
  reactionOfferCommandId,
  reactionOfferOccurrenceId
} from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import { writePendingSnapshot } from './pendingSnapshots.js'
import type { EncounterDocument, EncounterWriteContext } from './store.js'

/** `snapshot` is the occurrence's `readPendingSnapshot`. */
export function readReactionOfferPending(
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  snapshot: ServerRuleExecutionPendingSnapshotDto | null
) {
  if (occurrence.state !== 'PENDING' || snapshot === null) return null
  if (
    snapshot.snapshotKind !== 'AGGREGATE_CHOICE' ||
    snapshot.applicationContext.kind !== 'ENCOUNTER_REACTION_OFFER' ||
    snapshot.occurrenceId !== occurrence.id ||
    occurrence.rootCommandId !== reactionOfferCommandId(occurrence.id)
  )
    throw new Error('Stored Encounter reaction offer pending snapshot mismatch.')
  return { snapshot, context: snapshot.applicationContext }
}

/**
 * Projects the offer only to the reactor's controllers, and to a player only against an attacker
 * they can see. It carries no `answerBy`: the offer waits for its reactor, and the GM voids it for a
 * player who is away.
 */
export function projectReactionOfferPending(
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  snapshot: ServerRuleExecutionPendingSnapshotDto,
  viewer: {
    isOwner: boolean
    controlledActorIds: ReadonlySet<string>
    visibleActorIds: ReadonlySet<string>
  }
): PendingEncounterRuleOccurrenceSummaryDto | null {
  const pending = readReactionOfferPending(occurrence, snapshot)
  if (!pending) return null
  const { context } = pending
  if (
    !viewer.controlledActorIds.has(context.reactorActorId) ||
    !(viewer.isOwner || viewer.visibleActorIds.has(context.attackerActorId))
  )
    return null
  return {
    kind: 'REACTION_OFFER',
    occurrenceId: occurrence.id,
    occurrenceVersion: occurrence.version,
    encounterVersion: occurrence.expectedEncounterVersion,
    reactorActorId: context.reactorActorId,
    attackerActorId: context.attackerActorId,
    options: context.options,
    allowedResponses: ['DECLINE', 'OPTION']
  }
}

/**
 * Raises the reaction offer of a committed attack (D219) as the Run's pending decision, pinned to
 * the Run as it stands. The offer is the one derived from the attack's command and the reactor, so an
 * attack offers a reactor once; it names the occurrence that command settled; and it is raised only
 * while the Run waits on nothing else.
 */
export async function insertReactionOffer(
  ctx: EncounterWriteContext,
  state: EncounterRunState,
  snapshot: ServerAggregateChoicePendingSnapshotDto,
  now: string
) {
  const context = snapshot.applicationContext
  if (
    context.kind !== 'ENCOUNTER_REACTION_OFFER' ||
    snapshot.occurrenceId !==
      reactionOfferOccurrenceId(context.parentCommandId, context.reactorActorId)
  )
    throw new Error('Reaction offer scope mismatch.')
  const existing = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', snapshot.occurrenceId))
    .unique()
  if (existing) throw new Error('The attack already offered this reaction.')
  const parent = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_campaignId_rootCommandId', (q) =>
      q.eq('campaignId', state.campaignId).eq('rootCommandId', context.parentCommandId)
    )
    .unique()
  if (
    parent?.id !== context.parentOccurrenceId ||
    parent.encounterId !== state.id ||
    parent.state !== 'COMPLETED'
  )
    throw new Error('A reaction offer answers a committed attack.')
  const [pending] = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (q) => q.eq('encounterId', state.id).eq('state', 'PENDING'))
    .take(1)
  if (pending) throw new Error('The Encounter already has a pending decision.')
  await ctx.db.insert(
    'encounterRuleOccurrences',
    encounterStoredRuleOccurrenceSchema.parse({
      id: snapshot.occurrenceId,
      campaignId: state.campaignId,
      encounterId: state.id,
      rootCommandId: reactionOfferCommandId(snapshot.occurrenceId),
      state: 'PENDING',
      version: 0,
      expectedEncounterVersion: state.version,
      pendingSnapshotChecksum: await writePendingSnapshot(
        ctx,
        { id: snapshot.occurrenceId, encounterId: state.id },
        snapshot
      ),
      completedAt: null,
      createdAt: now,
      updatedAt: now
    })
  )
}
