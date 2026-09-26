import type { OptionalCombatPassageChoicePendingContextDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { availableEncounterMovementPassageChoice } from '@artificer-toolkit/rules-runtime/encounterMovementPassagePreparation'
import type { MutationCtx } from '../_generated/server'
import { requireSystem } from '../content/systemDocuments'
import { prepareNativeActionEconomy } from './actionEconomy'
import type { MovementTarget } from './movementTargets'

type PassagePreparationInput = {
  state: EncounterRunState
  movement: OptionalCombatPassageChoicePendingContextDto['movement']
  sourceActorId: string
  userId: string
  targets: ReadonlyMap<string, MovementTarget>
}

/** Issues only optional-passage choices that can be prepared from current actor facts. */
export async function availableNativeMovementPassageChoice(
  ctx: MutationCtx,
  input: PassagePreparationInput
): Promise<OptionalCombatPassageChoicePendingContextDto | null> {
  return availableEncounterMovementPassageChoice(
    {
      loadSystem: () => requireSystem(ctx, input.state.gameSystemId),
      prepareEconomy: ({ actor, state, activation, target }) =>
        prepareNativeActionEconomy(ctx, {
          actor,
          state,
          userId: input.userId,
          activation,
          target
        })
    },
    input
  )
}
