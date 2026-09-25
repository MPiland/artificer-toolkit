import {
  evaluateEncounterActionEconomy,
  prepareEncounterActionEconomy
} from '@artificer-toolkit/rules-runtime/encounterActionEconomy'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { QueryCtx } from '../_generated/server'
import { readDefinitionRoot } from '../content/definitionStore'
import { loadMovementTargets, type MovementTarget } from './movementTargets'

type NativeActionEconomyInput = {
  actor: EncounterRunActorState
  state: EncounterRunState
  userId: string
  activation: { code: string; amount: number }
  target?: MovementTarget
}

function economyInput(ctx: QueryCtx, input: NativeActionEconomyInput) {
  return {
    actor: input.actor,
    state: input.state,
    activation: input.activation,
    target: input.target,
    loadTarget: async () =>
      (
        await loadMovementTargets(ctx, {
          encounterId: input.state.id,
          expectedEncounterVersion: input.state.version,
          targetActorIds: [input.actor.id]
        })
      ).get(input.actor.id),
    definitions: {
      requireCurrent: async (definitionId: string) => {
        const root = await readDefinitionRoot(ctx, definitionId, input.userId)
        if (!root?.current) throw new Error('Action-economy capability is unavailable.')
        return root.current
      }
    }
  }
}

/** Refuses an unavailable allowance (movement and Disarm have no override). */
export async function prepareNativeActionEconomy(ctx: QueryCtx, input: NativeActionEconomyInput) {
  return prepareEncounterActionEconomy(economyInput(ctx, input))
}

/** Reports an unavailable allowance as overridable for Assisted RESOLVE_ACTION. */
export async function evaluateNativeActionEconomy(ctx: QueryCtx, input: NativeActionEconomyInput) {
  return evaluateEncounterActionEconomy(economyInput(ctx, input))
}
