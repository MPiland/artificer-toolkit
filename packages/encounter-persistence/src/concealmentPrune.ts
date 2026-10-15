import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { sceneStoredConcealmentPruneSchema } from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import {
  concealmentLifecycleFor,
  encounterConcealmentOf,
  normalizeObserverActorIds,
  sameObserverActorIds
} from '@artificer-toolkit/rules-runtime/encounterConcealment'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { createActiveRuleEffectStore } from './effectStore.js'
import type { EncounterWriteContext } from './store.js'

type ConcealmentPruneEntry = ReturnType<
  typeof sceneStoredConcealmentPruneSchema.parse
>['entries'][number]

type PruneScope = {
  state: Pick<EncounterRunState, 'id'>
  actors: readonly EncounterRunActorState[]
}

/**
 * Sets one concealment's observers to what `change` makes of the current ones, only while the
 * effect still hides its holder. An ended effect is never re-created; a change that leaves the
 * set as it is writes nothing.
 */
async function changeObservers(
  ctx: EncounterWriteContext,
  scope: PruneScope,
  target: { holderActorId: string; activeEffectId: string },
  change: (current: readonly string[]) => readonly string[]
): Promise<ConcealmentPruneEntry | null> {
  const holder = scope.actors.find((actor) => actor.id === target.holderActorId)
  if (!holder) return null
  const store = createActiveRuleEffectStore(ctx)
  const owner = turnEffectOwner(holder, scope.state.id)
  const effect = await store.findById(owner, target.activeEffectId)
  const concealment = effect ? encounterConcealmentOf([effect]) : null
  if (!effect || !concealment) return null
  const before = [...concealment.observerActorIds]
  const after = normalizeObserverActorIds(change(before))
  if (sameObserverActorIds(after, before)) return null
  await store.updateLifecycleCas({
    id: effect.id,
    owner,
    expectedVersion: effect.version,
    lifecycle: concealmentLifecycleFor(effect, after)
  })
  return {
    activeEffectId: effect.id,
    holderActorId: holder.id,
    beforeObserverActorIds: before,
    afterObserverActorIds: after
  }
}

/**
 * Drops observers from the concealments that came to see their holder (a token move), and returns
 * what changed for the move's receipt.
 */
export async function applyConcealmentPrune(
  ctx: EncounterWriteContext,
  scope: PruneScope & {
    prunes: readonly {
      holderActorId: string
      activeEffectId: string
      observerActorIds: readonly string[]
    }[]
  }
) {
  const entries: ConcealmentPruneEntry[] = []
  for (const prune of scope.prunes) {
    const entry = await changeObservers(ctx, scope, prune, (current) =>
      current.filter((id) => !prune.observerActorIds.includes(id))
    )
    if (entry) entries.push(entry)
  }
  return entries
}

/**
 * Gives back the observers a move's prune dropped, to the concealments that still exist. They
 * rejoin the observers the effect holds now, so a GM's later change is kept.
 */
export async function restoreConcealmentPrune(
  ctx: EncounterWriteContext,
  scope: PruneScope & { entries: readonly ConcealmentPruneEntry[] }
) {
  for (const entry of scope.entries)
    await changeObservers(ctx, scope, entry, (current) => [
      ...current,
      ...entry.beforeObserverActorIds.filter((id) => !entry.afterObserverActorIds.includes(id))
    ])
}
