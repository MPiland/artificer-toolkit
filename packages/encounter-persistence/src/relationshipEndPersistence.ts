import { encounterEscapeEndedConditionIds } from '@artificer-toolkit/rules-runtime/encounterEscapeCheck'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { createActiveRuleEffectStore } from './effectStore.js'
import { reconcileNativeMaintenanceOwners } from './maintenanceOwnerPersistence.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'

/**
 * Ends one actor-relationship effect its holder escaped: deletes the exact effect row and strips
 * the conditions only it held from the holder, sharing the Character's single stream-version
 * increment. Returns null when the holder no longer holds the effect.
 */
export async function endEncounterRelationshipEffect(
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
  await store.deleteCas({ id: effect.id, owner, expectedVersion: effect.version })
  const actors = await reconcileNativeMaintenanceOwners(ctx, {
    encounterId: input.encounterId,
    maintenance: { removed: [effect], characterVersions },
    actors: input.actors,
    occurredAt: input.occurredAt
  })
  return { actors, endedConditionIds }
}
