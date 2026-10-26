import {
  featureChargeUsed,
  withFeatureChargeUsed
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'

import { createActiveRuleEffectStore } from './effectStore.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import { revertUnavailable } from './targetMechanicsInverse.js'

/**
 * Undoes the GM's creature rest for one creature: each recovered charge is spent again, only while
 * it is still at the zero the rest left it, and each standing effect the rest turned back on that the
 * creature still holds is removed (SPELLS-31.2).
 */
export async function revertCreatureRestActor(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    encounterId: string
    actor: EncounterRunActorState
    resets: readonly { key: string; beforeUsed: number }[]
    armedEffectIds: readonly string[]
  }
): Promise<EncounterRunActorState> {
  const { actor } = input
  const owner = turnEffectOwner(actor, input.encounterId)
  const store = createActiveRuleEffectStore(ctx)
  for (const id of input.armedEffectIds) {
    const effect = await store.findById(owner, id)
    if (effect)
      await store.deleteCas({ id, owner, expectedVersion: effect.version, removal: 'REMOVED' })
  }
  let resources: unknown = actor.resources
  for (const { key, beforeUsed } of input.resets) {
    if (featureChargeUsed({ resources }, key) !== 0)
      revertUnavailable(
        `${actor.label}'s feature charges changed after this rest; adjust manually.`
      )
    resources = withFeatureChargeUsed({ resources }, key, beforeUsed)
  }
  return encounterRunActorStateSchema.parse({ ...actor, resources })
}
