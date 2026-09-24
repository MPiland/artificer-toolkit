import type {
  OptionalCombatPassageChoicePendingContextDto,
  ServerOptionalCombatContestPendingApplicationContextDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  availableEncounterMovementPassageChoice,
  prepareEncounterMovementPassageContest
} from '@artificer-toolkit/rules-runtime/encounterMovementPassagePreparation'
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

/** Creates one sealed contest from an issued passage option without changing Encounter state. */
export async function prepareNativeMovementPassageContest(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    choice: OptionalCombatPassageChoicePendingContextDto
    optionId: string
    userId: string
    targets: ReadonlyMap<string, MovementTarget>
  }
): Promise<ServerOptionalCombatContestPendingApplicationContextDto> {
  return prepareEncounterMovementPassageContest(
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
