import { consumableGrants } from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { readRunActors } from './documents.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import type {
  EncounterCharacterWriteTransaction,
  EncounterPersistenceTransaction
} from './ports.js'

/** Deletes grants a roll used up or a holder's state ended, with the versions they were planned against. */
export async function deleteGrants(
  ctx: EncounterPersistenceTransaction,
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
    await deleteGrants(
      ctx,
      consumableGrants(await store.list(turnEffectOwner(actor, input.state.id)), 'ON_ATTACK_ROLL')
    )
}

/**
 * What an action's undo gives back: the grants its rolls used up and the grants an incapacitation
 * it caused ended (D113). Every commit that roots an action builds its receipt through this.
 */
export function receiptConsumedGrants(input: {
  consumedGrants?: readonly ActiveRuleEffectRecord[]
  endedGrants: readonly ActiveRuleEffectRecord[]
}) {
  return [...(input.consumedGrants ?? []), ...input.endedGrants]
}

/**
 * A response committed after its action's root (a Cleaving choice, answering the action's
 * occurrence) can end grants too: the root's receipt takes them, so the action's undo gives them
 * back with everything else.
 */
export async function addEndedGrantsToRoot(
  ctx: EncounterPersistenceTransaction,
  input: {
    campaignId: string
    actionOccurrenceId: string
    endedGrants: readonly ActiveRuleEffectRecord[]
  }
) {
  if (!input.endedGrants.length) return
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
  if (root?.commandType !== 'RESOLVE_ACTION') throw new Error('Stored action root is missing.')
  await ctx.db.patch(root._id, {
    consumedGrants: receiptConsumedGrants({
      consumedGrants: root.consumedGrants,
      endedGrants: input.endedGrants
    })
  })
}

/** Gives back the exact records an undone roll had used up: same ordinal, version and timestamps. */
export async function restoreConsumedGrants(
  ctx: EncounterPersistenceTransaction,
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
