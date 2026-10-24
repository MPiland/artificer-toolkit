import { incomingDamageGrantRecords } from '@artificer-toolkit/rules-runtime/encounterEndedEffectRelease'
import { discoverEncounterEventHooks } from '@artificer-toolkit/rules-runtime/events/encounterEventHooks'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { EncounterIdleTurnMark } from '@artificer-toolkit/rules-runtime/encounterActorState'
import type {
  ActiveRuleEffectRecord,
  EncounterMaintainedEffectStateRecord
} from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { ApplyEncounterForcedMovements } from './actionCommitRecords.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import type { EncounterPersistenceTransaction } from './ports.js'
import type { EncounterWriteContext } from './store.js'

/** Deletes grants a roll used up or a holder's state ended, with the versions they were planned against. */
export async function deleteGrants(
  ctx: EncounterWriteContext,
  grants: readonly ActiveRuleEffectRecord[]
) {
  const store = createActiveRuleEffectStore(ctx)
  for (const grant of grants)
    await store.deleteCas({
      id: grant.id,
      owner: grant.owner,
      expectedVersion: grant.version,
      removal: 'ENDED'
    })
}

/**
 * Creates the timed grants a holder's passive features owe the damage a spatial root dealt it, after
 * the effects that damage ended are deleted. Returns the records, which planning built the same way.
 */
export async function createIncomingDamageGrants(
  ctx: EncounterWriteContext,
  input: {
    grants: Parameters<typeof incomingDamageGrantRecords>[0]['grants']
    owner: ActiveRuleEffectRecord['owner']
    occurredAt: string
  }
) {
  const store = createActiveRuleEffectStore(ctx)
  const records = incomingDamageGrantRecords({
    ...input,
    current: input.grants.length ? await store.list(input.owner) : []
  })
  for (const record of records) {
    const created = await store.create({
      id: record.id,
      owner: record.owner,
      definition: record.definition,
      lifecycle: record.lifecycle,
      occurredAt: input.occurredAt
    })
    if (checksumCanonicalJson(created) !== checksumCanonicalJson(record))
      throw new Error('Created damage grant changed before settlement.')
  }
  return records
}

/**
 * Spends one use of each effect that counts its uses (attack decoys). The receipt keeps the record
 * as it was, so an undo gives the use back.
 */
export async function spendEffectUses(
  ctx: EncounterWriteContext,
  effects: readonly ActiveRuleEffectRecord[]
) {
  const store = createActiveRuleEffectStore(ctx)
  for (const effect of effects) {
    const remainingUses = effect.lifecycle.remainingUses
    if (remainingUses === undefined) throw new Error('The effect does not count uses.')
    await store.updateLifecycleCas({
      id: effect.id,
      owner: effect.owner,
      expectedVersion: effect.version,
      lifecycle: { ...effect.lifecycle, remainingUses: remainingUses - 1 }
    })
  }
}

/**
 * Ends effects an event used up, and the Concentration they alone sustained. The states come back
 * exactly as they were so an undoable root can give them back before the effects.
 */
export async function endEffects(
  ctx: EncounterWriteContext,
  effects: readonly ActiveRuleEffectRecord[]
): Promise<EncounterMaintainedEffectStateRecord[]> {
  await deleteGrants(ctx, effects)
  const store = createActiveRuleEffectStore(ctx)
  const ended: EncounterMaintainedEffectStateRecord[] = []
  const stateIds = new Map<string, string>()
  for (const { maintainedEffectStateId, sourceEncounterId, owner } of effects) {
    // A Character-held effect names its Run in `sourceEncounterId`; an actor-held one is owned by the Run.
    const encounterId = owner.kind === 'ENCOUNTER_ACTOR' ? owner.encounterId : sourceEncounterId
    if (maintainedEffectStateId !== null && encounterId !== null)
      stateIds.set(maintainedEffectStateId, encounterId)
  }
  for (const [stateId, encounterId] of [...stateIds].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    const state = await store.findMaintainedStateById({ encounterId, stateId })
    if (
      !state ||
      state.descriptor.emptyDependentPolicy !== 'TERMINATE_WHEN_EMPTY' ||
      (await store.hasDependents({ encounterId, stateId }))
    )
      continue
    await store.deleteMaintainedStateCas({
      id: state.id,
      encounterId,
      ownerActorId: state.ownerActorId,
      expectedVersion: state.version,
      removal: 'ENDED'
    })
    ended.push(state)
  }
  return ended
}

/** Gives back the exact maintained states an undone action had ended. */
export async function restoreEndedMaintainedStates(
  ctx: EncounterWriteContext,
  states: readonly EncounterMaintainedEffectStateRecord[]
) {
  const store = createActiveRuleEffectStore(ctx)
  for (const state of states) await store.restoreMaintainedState(state)
}

/**
 * Ends the owner's grants that last until hit points are regained, for a change that raised its
 * hit points (a heal, a death save, a Sheet or GM edit). The records come back so an undoable root
 * can give them back on a GM undo.
 */
export async function endGrantsOnHitPointsRegained(
  ctx: EncounterWriteContext,
  owner: ActiveRuleEffectRecord['owner']
) {
  const { ended } = discoverEncounterEventHooks({
    effects: await createActiveRuleEffectStore(ctx).list(owner),
    events: [{ kind: 'HIT_POINTS_REGAINED' }]
  })
  await deleteGrants(ctx, ended)
  return ended
}

/**
 * What an action's undo gives back: the grants its rolls used up and the effects it ended, such as
 * the grants an incapacitation it caused ended (D113) or the concealments a Hide replaced and a
 * Search emptied. Every commit that roots an action builds its receipt through this.
 */
export function receiptConsumedGrants(input: {
  consumedGrants?: readonly ActiveRuleEffectRecord[]
  endedGrants: readonly ActiveRuleEffectRecord[]
}) {
  return [...(input.consumedGrants ?? []), ...input.endedGrants]
}

/**
 * A response committed after its action's root (a Cleaving choice, answering the action's
 * occurrence) can end grants, change idle-turn marks and land forced movements too: the root's
 * receipt takes them, so the action's undo gives them back with everything else. A mark the root
 * already changed keeps the value it held before the action.
 */
export async function addResponseChangesToRoot(
  ctx: EncounterPersistenceTransaction,
  input: {
    campaignId: string
    actionOccurrenceId: string
    endedGrants: readonly ActiveRuleEffectRecord[]
    idleTurnMarkChanges?: readonly { actorId: string; before: EncounterIdleTurnMark | null }[]
    forcedMovements?: Pick<Awaited<ReturnType<ApplyEncounterForcedMovements>>, 'moves' | 'landings'>
  }
) {
  const markChanges = input.idleTurnMarkChanges ?? []
  const moves = input.forcedMovements?.moves ?? []
  const landings = input.forcedMovements?.landings ?? []
  if (!input.endedGrants.length && !markChanges.length && !moves.length) return
  const occurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', input.actionOccurrenceId))
    .unique()
  if (!occurrence) throw new Error('Stored action occurrence is missing.')
  const root = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', input.campaignId).eq('commandId', occurrence.rootCommandId)
    )
    .unique()
  // An Escape's check ends only grants (a d20 window's held die); its receipt keeps them for undo.
  if (root?.commandType === 'ESCAPE' && !markChanges.length && !moves.length) {
    await ctx.db.patch(root._id, {
      receipt: {
        ...root.receipt,
        consumedGrants: receiptConsumedGrants({
          consumedGrants: root.receipt.consumedGrants,
          endedGrants: input.endedGrants
        })
      }
    })
    return
  }
  if (root?.commandType !== 'RESOLVE_ACTION') throw new Error('Stored action root is missing.')
  await ctx.db.patch(root._id, {
    consumedGrants: receiptConsumedGrants({
      consumedGrants: root.consumedGrants,
      endedGrants: input.endedGrants
    }),
    idleTurnMarkChanges: [
      ...root.idleTurnMarkChanges,
      ...markChanges.filter(
        ({ actorId }) => !root.idleTurnMarkChanges.some((change) => change.actorId === actorId)
      )
    ],
    forcedMovements: [...root.forcedMovements, ...moves],
    forcedMovementLandings: [...root.forcedMovementLandings, ...landings]
  })
}

/** Gives back the exact records an undone roll had used up: same ordinal, version and timestamps. */
export async function restoreConsumedGrants(
  ctx: EncounterWriteContext,
  grants: readonly ActiveRuleEffectRecord[]
) {
  const store = createActiveRuleEffectStore(ctx)
  for (const grant of grants) {
    // A spent use leaves its effect in place: give the use back instead of re-creating the record.
    const current = await store.findById(grant.owner, grant.id)
    if (current) {
      await store.updateLifecycleCas({
        id: grant.id,
        owner: grant.owner,
        expectedVersion: current.version,
        lifecycle: grant.lifecycle
      })
      continue
    }
    await store.create({
      id: grant.id,
      owner: grant.owner,
      definition: grant.definition,
      lifecycle: grant.lifecycle,
      maintainedEffectStateId: grant.maintainedEffectStateId,
      restoredFrom: grant
    })
  }
}
