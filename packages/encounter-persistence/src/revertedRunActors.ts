import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { withdrawConsequenceRollOffers } from '@artificer-toolkit/rules-runtime/encounterConsequenceRolls'
import { settleCreatureConditionMaximum } from './conditionMaximumSettlement.js'
import { replaceRunActor } from './documents.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'

/**
 * Writes the actors an undo restores, without the consequence roll offers the undone command made
 * (ATTACK-15), and returns them. `nextActors` pairs with `actors` by index; unchanged actors are
 * not written.
 */
export async function persistRevertedRunActors(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    actors: readonly EncounterRunActorState[]
    nextActors: readonly EncounterRunActorState[]
    revertedCommandId: string
    updatedAt: string
    /** The Campaign owner and Game System that read the restored conditions' definitions. */
    ownerUserId: string
    gameSystemId: string
  }
): Promise<EncounterRunActorState[]> {
  const withdrawn = withdrawConsequenceRollOffers(
    input.nextActors,
    input.revertedCommandId,
    input.updatedAt
  )
  const nextActors: EncounterRunActorState[] = []
  for (const [index, actor] of input.actors.entries()) {
    const next = await settleCreatureConditionMaximum(ctx, {
      before: actor,
      actor: withdrawn[index]!,
      ownerUserId: input.ownerUserId,
      gameSystemId: input.gameSystemId
    })
    nextActors.push(next)
    if (next !== actor) await replaceRunActor(ctx, actor, next)
  }
  return nextActors
}
