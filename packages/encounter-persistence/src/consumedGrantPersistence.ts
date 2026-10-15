import {
  consumableGrants,
  grantsEndedBy
} from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { readRunActors } from './documents.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import type { EncounterWriteContext } from './store.js'

/** Ends grants a roll used up, with the versions the roll was planned against. */
export async function deleteConsumedGrants(
  ctx: EncounterWriteContext,
  grants: readonly ActiveRuleEffectRecord[]
) {
  const store = createActiveRuleEffectStore(ctx)
  for (const grant of grants)
    await store.deleteCas({ id: grant.id, owner: grant.owner, expectedVersion: grant.version })
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
    await deleteConsumedGrants(
      ctx,
      consumableGrants(await store.list(turnEffectOwner(actor, input.state.id)), 'ON_ATTACK_ROLL')
    )
}

/**
 * Ends the owner's grants that last until hit points are regained, for a heal that restored at
 * least 1 hit point. The records come back so the heal's root can give them back on a GM undo.
 */
export async function endGrantsOnHitPointsRegained(
  ctx: EncounterWriteContext,
  owner: ActiveRuleEffectRecord['owner']
) {
  const ended = grantsEndedBy(
    await createActiveRuleEffectStore(ctx).list(owner),
    'ON_HIT_POINTS_REGAINED'
  )
  await deleteConsumedGrants(ctx, ended)
  return ended
}

/** Gives back the exact records an undone roll had used up: same ordinal, version and timestamps. */
export async function restoreConsumedGrants(
  ctx: EncounterWriteContext,
  grants: readonly ActiveRuleEffectRecord[]
) {
  const store = createActiveRuleEffectStore(ctx)
  for (const grant of grants)
    await store.create({
      id: grant.id,
      owner: grant.owner,
      definition: grant.definition,
      lifecycle: grant.lifecycle,
      maintainedEffectStateId: grant.maintainedEffectStateId,
      restoredFrom: grant
    })
}
