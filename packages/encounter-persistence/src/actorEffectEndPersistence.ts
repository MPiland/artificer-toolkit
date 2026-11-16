import { isEndableByHand } from '@artificer-toolkit/rules-runtime/activeGrantListings'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { readRunActors } from './documents.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import { reconcileNativeMaintenanceOwners } from './maintenanceOwnerPersistence.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'

/**
 * The GM ends one active effect a Creature or custom actor holds by hand (D99), under the rule a
 * Character's Sheet end follows (`isEndableByHand`): any effect but one a Concentration
 * maintains. A Character's ends through its Sheet command instead. The store's end path settles the
 * holder (a removal from play ends), and the holder is reconciled like any ended effect's (Aid ending
 * lowers current HP).
 */
export async function endEncounterActorEffect(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: EncounterRunState
    actor: Exclude<EncounterRunActorState, { kind: 'CHARACTER' }>
    effectId: string
    occurredAt: string
  }
) {
  const { state, actor, effectId } = input
  const store = createActiveRuleEffectStore(ctx)
  const owner = turnEffectOwner(actor, state.id)
  const effect = await store.findById(owner, effectId)
  if (!effect) throw new Error('Active effect was not found on this actor.')
  if (!isEndableByHand(effect))
    throw new Error('End the Concentration that holds this effect instead.')
  await store.deleteCas({
    id: effect.id,
    owner,
    expectedVersion: effect.version,
    removal: 'ENDED'
  })
  await reconcileNativeMaintenanceOwners(ctx, {
    encounterId: state.id,
    maintenance: { removed: [effect], characterVersions: [] },
    actors: await readRunActors(ctx, state),
    occurredAt: input.occurredAt
  })
}
