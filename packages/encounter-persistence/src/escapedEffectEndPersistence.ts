import type { LiveSessionMovementSettlement } from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { encounterEscapeEndedConditionIds } from '@artificer-toolkit/rules-runtime/encounterEscapeCheck'
import { endsOnLeavingZone } from '@artificer-toolkit/rules-runtime/encounterSpatialHeldCondition'
import { movementDamageEndedEffects } from '@artificer-toolkit/rules-runtime/encounterSpatialDamageEnds'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { createActiveRuleEffectStore } from './effectStore.js'
import { reconcileNativeMaintenanceOwners } from './maintenanceOwnerPersistence.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'

/**
 * Ends the effect its holder escaped or left the area of (a relationship or a zone-held condition): deletes the exact effect row and strips
 * the conditions only it held from the holder, sharing the Character's single stream-version
 * increment. Returns null when the holder no longer holds the effect.
 */
export async function endEncounterEscapedEffect(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    encounterId: string
    actors: EncounterRunActorState[]
    holderActorId: string
    activeEffectId: string
    occurredAt: string
  }
) {
  const holder = input.actors.find((actor) => actor.id === input.holderActorId)
  if (!holder) throw new Error('The escaping actor is unavailable.')
  const owner = turnEffectOwner(holder, input.encounterId)
  const store = createActiveRuleEffectStore(ctx)
  const held = await store.list(owner)
  const effect = held.find((entry) => entry.id === input.activeEffectId)
  if (!effect) return null
  const endedConditionIds = encounterEscapeEndedConditionIds(held, effect.id)
  const characterVersions: { characterId: string; beforeStreamVersion: number }[] = []
  if (owner.kind === 'CHARACTER') {
    const row = await ctx.ports.readCharacterRow(owner.characterId)
    if (!row || row.status !== 'ACTIVE') throw new Error('The escaping Character is unavailable.')
    characterVersions.push({
      characterId: owner.characterId,
      beforeStreamVersion: row.play.streamVersion
    })
  }
  await store.deleteCas({
    id: effect.id,
    owner,
    expectedVersion: effect.version,
    removal: 'ENDED'
  })
  const actors = await reconcileNativeMaintenanceOwners(ctx, {
    encounterId: input.encounterId,
    maintenance: { removed: [effect], characterVersions },
    actors: input.actors,
    occurredAt: input.occurredAt
  })
  return { actors, endedConditionIds }
}

/**
 * Settles a mover leaving a zone that held a condition on it until it did (D146): re-derives the
 * zone's holder effect from the holder's current rows, requires the room's plan to match it, and
 * ends it like an escape. Returns the actors and the holder Character's stream transition.
 */
export function persistLiveMovementAreaDeparture(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: { id: string }
    actors: EncounterRunActorState[]
    step: Extract<LiveSessionMovementSettlement, { kind: 'AREA_DEPARTURE' }>
    occurredAt: string
  }
) {
  return persistLiveMovementHeldEffectEnd(ctx, {
    ...input,
    holderActorId: input.step.departure.holderActorId,
    find: (held) =>
      held.find((effect) => endsOnLeavingZone(effect, input.step.departure.zoneEffectId))
  })
}

/**
 * Settles a mover moving voluntarily while holding an effect that lasts until it moves: re-derives
 * the effect from the holder's current rows and ends it like an escape.
 */
export function persistLiveMovementMoveEnd(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: { id: string }
    actors: EncounterRunActorState[]
    step: Extract<LiveSessionMovementSettlement, { kind: 'MOVE_END' }>
    occurredAt: string
  }
) {
  return persistLiveMovementHeldEffectEnd(ctx, {
    ...input,
    holderActorId: input.step.moveEnd.holderActorId,
    find: (held) => held.find((effect) => effect.id === input.step.moveEnd.effectId)
  })
}

/**
 * Settles an effect a move's zone damage ended on its holder: re-derives what that damage ends from
 * the holder's current rows and the move's applied contacts, requires the step's effect to be among
 * them, and ends it like an escape.
 */
export function persistLiveMovementDamageEnd(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: { id: string; currentActorId: string | null }
    actors: EncounterRunActorState[]
    step: Extract<LiveSessionMovementSettlement, { kind: 'DAMAGE_END' }>
    /** Every contact the move applied. */
    executions: Parameters<typeof movementDamageEndedEffects>[0]['executions']
    occurrenceId: string
    occurredAt: string
  }
) {
  const { holderActorId, effectId } = input.step.damageEnd
  return persistLiveMovementHeldEffectEnd(ctx, {
    ...input,
    holderActorId,
    find: (held) =>
      movementDamageEndedEffects({
        holderActorId,
        held,
        executions: input.executions,
        occurrenceId: input.occurrenceId,
        turnActorId: input.state.currentActorId,
        dispositions: new Map(input.actors.map(({ id, disposition }) => [id, disposition]))
      }).find((effect) => effect.id === effectId)
  })
}

async function persistLiveMovementHeldEffectEnd(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: { id: string }
    actors: EncounterRunActorState[]
    step: Extract<
      LiveSessionMovementSettlement,
      { kind: 'AREA_DEPARTURE' | 'MOVE_END' | 'DAMAGE_END' }
    >
    holderActorId: string
    /** The effect the step ends, among the holder's current rows. */
    find: (held: readonly ActiveRuleEffectRecord[]) => ActiveRuleEffectRecord | undefined
    occurredAt: string
  }
) {
  const { state, step } = input
  const holder = input.actors.find((actor) => actor.id === input.holderActorId)
  if (!holder) throw new Error('Movement release holder is unavailable.')
  const owner = turnEffectOwner(holder, state.id)
  const held = input.find(await createActiveRuleEffectStore(ctx).list(owner))
  if (!held || checksumCanonicalJson(held) !== checksumCanonicalJson(step.endedEffect))
    throw new Error('Movement release differs from its holder effect.')
  const streamVersion = async () =>
    owner.kind === 'CHARACTER'
      ? ((await ctx.ports.readCharacterRow(owner.characterId))?.play.streamVersion ?? null)
      : null
  const beforeStreamVersion = await streamVersion()
  const ended = await endEncounterEscapedEffect(ctx, {
    encounterId: state.id,
    actors: input.actors,
    holderActorId: holder.id,
    activeEffectId: held.id,
    occurredAt: input.occurredAt
  })
  if (
    !ended ||
    checksumCanonicalJson(ended.endedConditionIds) !==
      checksumCanonicalJson(step.removedConditionIds)
  )
    throw new Error('Movement release differs from its plan.')
  const afterStreamVersion = await streamVersion()
  return {
    actors: ended.actors,
    characterTransitions:
      owner.kind === 'CHARACTER' &&
      beforeStreamVersion !== null &&
      afterStreamVersion !== null &&
      afterStreamVersion !== beforeStreamVersion
        ? [{ characterId: owner.characterId, beforeStreamVersion, afterStreamVersion }]
        : []
  }
}
