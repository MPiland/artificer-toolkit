import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import {
  bindEncounterActorRuleOutputToFacts,
  reconcileEncounterActorRuleOutput
} from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { projectGm } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { MutationCtx } from '../_generated/server'
import { evaluateInitialSceneMovement } from './spatialPreparation'
import { settleSceneMovementSettlements } from './movementSettlements'
import type { readSpatialSceneGeometry } from './spatialGeometry'
import { publishSpatialPending } from './spatialPendingPublication'

/** The caller commits the matching token and clipped fog in this same mutation. */
export async function publishPreparedSpatialPending(
  ctx: MutationCtx,
  request: ReturnType<typeof sceneSpatialPrepareInputSchema.parse>,
  geometry: Awaited<ReturnType<typeof readSpatialSceneGeometry>> | null
) {
  return publishSpatialPending(ctx, request, geometry, {
    evaluateInitial: evaluateInitialSceneMovement,
    settle: settleSceneMovementSettlements,
    project: (nextState, actors, characterStates) => {
      const facts = buildEncounterActorRuleFacts({ actors })
      return projectGm(
        { ...nextState, actors },
        bindEncounterActorRuleOutputToFacts(
          reconcileEncounterActorRuleOutput(
            evaluateInstalledEncounterActors({ gameSystemId: nextState.gameSystemId, facts }),
            facts
          ),
          facts
        ),
        characterStates
      )
    }
  })
}
