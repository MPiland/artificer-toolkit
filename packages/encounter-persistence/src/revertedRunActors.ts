import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { withdrawConsequenceRollOffers } from '@artificer-toolkit/rules-runtime/encounterConsequenceRolls'
import { replaceRunActor } from './documents.js'
import type { EncounterWriteContext } from './store.js'

/**
 * Writes the actors an undo restores, without the consequence roll offers the undone command made
 * (ATTACK-15), and returns them. `nextActors` pairs with `actors` by index; unchanged actors are
 * not written.
 */
export async function persistRevertedRunActors(
  ctx: EncounterWriteContext,
  input: {
    actors: readonly EncounterRunActorState[]
    nextActors: readonly EncounterRunActorState[]
    revertedCommandId: string
    updatedAt: string
  }
): Promise<EncounterRunActorState[]> {
  const nextActors = withdrawConsequenceRollOffers(
    input.nextActors,
    input.revertedCommandId,
    input.updatedAt
  )
  for (const [index, actor] of input.actors.entries()) {
    const next = nextActors[index]!
    if (next !== actor) await replaceRunActor(ctx, actor, next)
  }
  return nextActors
}
