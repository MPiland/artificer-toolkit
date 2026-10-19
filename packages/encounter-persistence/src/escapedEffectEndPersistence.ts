import type { LiveSessionMovementSettlement } from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { encounterEscapeEndedConditionIds } from '@artificer-toolkit/rules-runtime/encounterEscapeCheck'
import { heldUntilLeavingZoneId } from '@artificer-toolkit/rules-runtime/encounterSpatialHeldCondition'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
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
export async function persistLiveMovementAreaDeparture(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: { id: string }
    actors: EncounterRunActorState[]
    step: Extract<LiveSessionMovementSettlement, { kind: 'AREA_DEPARTURE' }>
    occurredAt: string
  }
) {
  const { state, step } = input
  const holder = input.actors.find((actor) => actor.id === step.departure.holderActorId)
  if (!holder) throw new Error('Movement area departure holder is unavailable.')
  const owner = turnEffectOwner(holder, state.id)
  const held = (await createActiveRuleEffectStore(ctx).list(owner)).find(
    (effect) => heldUntilLeavingZoneId(effect) === step.departure.zoneEffectId
  )
  if (!held || checksumCanonicalJson(held) !== checksumCanonicalJson(step.endedEffect))
    throw new Error('Movement area departure differs from its holder effect.')
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
    throw new Error('Movement area departure differs from its plan.')
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
