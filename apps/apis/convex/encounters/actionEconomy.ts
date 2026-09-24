import {
  prepareEncounterActionEconomy,
  stageEncounterActionEconomyRefreshes
} from '@artificer-toolkit/rules-runtime/encounterActionEconomy'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { TurnActionEconomyRefreshDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnResources'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { readDefinitionRoot } from '../content/definitionStore'
import { loadMovementTargets, type MovementTarget } from './movementTargets'

/** Plans System-owned allowance recovery without writing before the turn settles. */
export async function stageNativeActionEconomyRefreshes(
  ctx: MutationCtx,
  input: { actor: EncounterRunActorState; state: EncounterRunState; userId: string }
): Promise<{
  refreshes: TurnActionEconomyRefreshDto[]
  refreshedActor: EncounterRunActorState | null
}> {
  return stageEncounterActionEconomyRefreshes({
    actor: input.actor,
    state: input.state,
    definitions: {
      requireCurrent: async (definitionId) => {
        const root = await readDefinitionRoot(ctx, definitionId, input.userId)
        if (!root?.current)
          throw new Error('Encounter action-economy refresh definition is unavailable or stale.')
        return root.current
      }
    }
  })
}

export async function prepareNativeActionEconomy(
  ctx: QueryCtx,
  input: {
    actor: EncounterRunActorState
    state: EncounterRunState
    userId: string
    activation: { code: string; amount: number }
    target?: MovementTarget
  }
) {
  return prepareEncounterActionEconomy({
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
      requireCurrent: async (definitionId) => {
        const root = await readDefinitionRoot(ctx, definitionId, input.userId)
        if (!root?.current) throw new Error('Action-economy capability is unavailable.')
        return root.current
      }
    }
  })
}
