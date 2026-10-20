import { listActiveGrantListings } from '@artificer-toolkit/rules-runtime/activeGrantListings'
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
 * The GM ends one grant a Creature or custom actor holds by hand (D99). A Character's grant ends
 * through its Sheet command instead. Only a grant can be named: any other effect is refused. The
 * holder is reconciled like any ended effect's (Aid ending lowers current HP).
 */
export async function endEncounterActorGrant(
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
  const effect = (await store.list(owner)).find(({ id }) => id === effectId)
  if (!effect || listActiveGrantListings([effect]).length === 0)
    throw new Error('Active grant was not found on this actor.')
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
