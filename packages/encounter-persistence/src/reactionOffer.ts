import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/api/encounters'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import type { ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { encounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import {
  reactionOfferCommandId,
  reactionOfferOccurrenceId
} from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import { isDepartedCharacterActor, readZeroHitPointActorIds } from './characterStates.js'
import { changedFields, readRunActors, readRunState } from './documents.js'
import { readPendingSnapshot, writePendingSnapshot } from './pendingSnapshots.js'
import type { EncounterDocument, EncounterReadContext, EncounterWriteContext } from './store.js'

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
 * Projects the offer to the reactor's controllers and to no one else. Whether the reactor may react
 * is the authored trigger's question, answered when the attack was planned, so what the viewer sees
 * of the attacker hides nothing here. It carries no `answerBy`: the offer waits for its reactor, and
 * the GM voids it for a player who is away.
 */
export function projectReactionOfferPending(
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  snapshot: ServerRuleExecutionPendingSnapshotDto,
  controlledActorIds: ReadonlySet<string>
): PendingEncounterRuleOccurrenceSummaryDto | null {
  const pending = readReactionOfferPending(occurrence, snapshot)
  if (!pending) return null
  const { context } = pending
  if (!controlledActorIds.has(context.reactorActorId)) return null
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
 * Stores a reaction offer its attack planned (D219) as `QUEUED`, in the attack's own commit. The
 * offer is the one derived from the attack's command and the reactor, so an attack offers a reactor
 * once, and it names the occurrence that command settled. It waits for `raiseQueuedReactionOffer`.
 */
export async function queueReactionOffer(
  ctx: EncounterWriteContext,
  state: EncounterRunState,
  snapshot: ServerRuleExecutionPendingSnapshotDto,
  now: string
) {
  const context = snapshot.applicationContext
  if (
    snapshot.snapshotKind !== 'AGGREGATE_CHOICE' ||
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
  await ctx.db.insert(
    'encounterRuleOccurrences',
    encounterStoredRuleOccurrenceSchema.parse({
      id: snapshot.occurrenceId,
      campaignId: state.campaignId,
      encounterId: state.id,
      rootCommandId: reactionOfferCommandId(snapshot.occurrenceId),
      state: 'QUEUED',
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

/** The Run's queued offers, the earliest attack first and its reactors in actor-id order. */
async function readQueuedReactionOffers(ctx: EncounterReadContext, encounterId: string) {
  const queued = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (q) =>
      q.eq('encounterId', encounterId).eq('state', 'QUEUED')
    )
    .take(MAX_ENCOUNTER_ACTORS)
  const offers = await Promise.all(
    queued.map(async (occurrence) => {
      const context = (await readPendingSnapshot(ctx, occurrence))?.applicationContext
      if (context?.kind !== 'ENCOUNTER_REACTION_OFFER')
        throw new Error('Stored Encounter reaction offer queue is invalid.')
      return { occurrence, context }
    })
  )
  return offers.sort(
    (left, right) =>
      left.occurrence.createdAt.localeCompare(right.occurrence.createdAt) ||
      left.context.reactorActorId.localeCompare(right.context.reactorActorId)
  )
}

async function settleQueuedReactionOffer(
  ctx: EncounterWriteContext,
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  next: { state: 'PENDING'; expectedEncounterVersion: number } | { state: 'VOIDED' },
  now: string
) {
  const { _id, _creationTime, ...stored } = occurrence
  const settled = encounterStoredRuleOccurrenceSchema.parse({
    ...stored,
    ...next,
    // Raising is no answer: the offer's first answer is still its version 0.
    ...(next.state === 'VOIDED'
      ? {
          version: occurrence.version + 1,
          pendingSnapshotChecksum: await writePendingSnapshot(ctx, occurrence, null),
          completedAt: now
        }
      : {}),
    updatedAt: now
  })
  await ctx.db.patch(_id, changedFields(occurrence, settled))
}

/**
 * Raises the Run's next queued reaction offer (D219) as its pending decision, pinned to the Run as it
 * stands, and reports whether one was raised. Nothing is raised while the Run waits on a decision.
 * The attack's planner already checked the trigger; here only committed state is read, and an offer
 * is voided when its reactor or attacker has left the Run, the reactor has departed or is at 0 hit
 * points, or the reactor has used its reaction since the attack. Anything staler is refused by the
 * chosen reaction's own prepare.
 */
export async function raiseQueuedReactionOffer(
  ctx: EncounterWriteContext & Parameters<typeof readZeroHitPointActorIds>[0],
  encounterId: string,
  now: string
): Promise<boolean> {
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', encounterId))
    .unique()
  if (!run || run.status !== 'ACTIVE') return false
  const state = readRunState(run)
  const pending = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (q) => q.eq('encounterId', state.id).eq('state', 'PENDING'))
    .first()
  if (pending) return false
  const offers = await readQueuedReactionOffers(ctx, state.id)
  if (offers.length === 0) return false
  const actors = new Map((await readRunActors(ctx, state)).map((actor) => [actor.id, actor]))
  for (const { occurrence, context } of offers) {
    const reactor = actors.get(context.reactorActorId)
    const live =
      reactor !== undefined &&
      actors.has(context.attackerActorId) &&
      encounterRuleUsageUsed(reactor, context.reactionAllowance.definitionId) <=
        context.reactionAllowance.beforeUsed &&
      !(await readZeroHitPointActorIds(ctx, [reactor])).has(reactor.id) &&
      !(
        reactor.kind === 'CHARACTER' &&
        (await isDepartedCharacterActor(ctx, state.campaignId, reactor))
      )
    await settleQueuedReactionOffer(
      ctx,
      occurrence,
      live ? { state: 'PENDING', expectedEncounterVersion: state.version } : { state: 'VOIDED' },
      now
    )
    if (live) return true
  }
  return false
}

/** Voids the queued offers of attacks an undo takes back: an undone attack offers no reaction. */
export async function voidQueuedReactionOffers(
  ctx: EncounterWriteContext,
  encounterId: string,
  parentCommandIds: ReadonlySet<string>,
  now: string
) {
  for (const { occurrence, context } of await readQueuedReactionOffers(ctx, encounterId))
    if (parentCommandIds.has(context.parentCommandId))
      await settleQueuedReactionOffer(ctx, occurrence, { state: 'VOIDED' }, now)
}
