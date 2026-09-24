import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import {
  bindEncounterActorRuleOutputToFacts,
  reconcileEncounterActorRuleOutput
} from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { projectGm } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { MutationCtx } from '../_generated/server'
import { commitPreparedMovementResponse } from './movementResolutionCommit.helper'
import type { Geometry } from './movementResolutionDocuments'
import { publishMovementResponse } from './movementResolutionPublication'

/** Publishes one response receipt, occurrence update, Run update, and the caller's Scene writes atomically. */
export async function publishPreparedMovementResponse(
  ctx: MutationCtx,
  request: ReturnType<typeof sceneSpatialPrepareInputSchema.parse>,
  geometry: Geometry | null
) {
  return publishMovementResponse(ctx, request, geometry, {
    commit: commitPreparedMovementResponse,
    project: (state, actors) => {
      const facts = buildEncounterActorRuleFacts({ actors })
      return projectGm(
        { ...state, actors },
        bindEncounterActorRuleOutputToFacts(
          reconcileEncounterActorRuleOutput(
            evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
            facts
          ),
          facts
        )
      )
    }
  })
}
