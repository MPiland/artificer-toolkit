import { attackRollConsumableGrants } from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { readRunActors } from './documents.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'

type GrantHolderInput = {
  actor: Pick<EncounterRunActorState, 'id' | 'kind' | 'sourceId'>
  encounterId: string
  grants: readonly ActiveRuleEffectRecord[]
}

/** Ends grants an attack roll used up, with the versions the roll was planned against. */
export async function deleteConsumedGrants(
  ctx: EncounterCharacterWriteTransaction,
  { actor, encounterId, grants }: GrantHolderInput
) {
  const store = createActiveRuleEffectStore(ctx)
  const owner = turnEffectOwner(actor, encounterId)
  for (const grant of grants)
    await store.deleteCas({ id: grant.id, owner, expectedVersion: grant.version })
}

/**
 * Ends the one-roll grants these actors hold right now, for an attack roll whose settlement is
 * read at commit (a Legendary Action window), where the room planned no per-grant versions.
 */
export async function deleteHeldAttackRollGrants(
  ctx: EncounterCharacterWriteTransaction,
  input: { state: EncounterRunState; actorIds: ReadonlySet<string> }
) {
  const store = createActiveRuleEffectStore(ctx)
  for (const actor of (await readRunActors(ctx, input.state)).filter(({ id }) =>
    input.actorIds.has(id)
  ))
    await deleteConsumedGrants(ctx, {
      actor,
      encounterId: input.state.id,
      grants: attackRollConsumableGrants(await store.list(turnEffectOwner(actor, input.state.id)))
    })
}

/** Gives back grants an undone attack roll had used up, with the count they had left. */
export async function restoreConsumedGrants(
  ctx: EncounterCharacterWriteTransaction,
  { actor, encounterId, grants }: GrantHolderInput
) {
  const store = createActiveRuleEffectStore(ctx)
  const owner = turnEffectOwner(actor, encounterId)
  for (const grant of grants)
    await store.create({
      id: grant.id,
      owner,
      definition: grant.definition,
      lifecycle: grant.lifecycle
    })
}
