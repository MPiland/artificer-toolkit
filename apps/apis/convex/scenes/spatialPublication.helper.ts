import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import {
  bindEncounterActorRuleOutputToFacts,
  reconcileEncounterActorRuleOutput
} from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { projectGm } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type { MutationCtx } from '../_generated/server'
import { commitPreparedSpatialTerminal } from './spatialCommit.helper'
import { publishSpatialTerminal } from './spatialTerminalPublication'

/** The parent must publish the prepared Scene/token/fog changes in this same mutation. */
export async function publishPreparedSpatialTerminal(
  ctx: MutationCtx,
  saveId: string,
  geometry: Parameters<typeof commitPreparedSpatialTerminal>[2],
  request?: Parameters<typeof commitPreparedSpatialTerminal>[3]
) {
  return publishSpatialTerminal(ctx, saveId, geometry, request, {
    settle: commitPreparedSpatialTerminal,
    project: (nextState, actors) => {
      const facts = buildEncounterActorRuleFacts({ actors })
      const output = reconcileEncounterActorRuleOutput(
        evaluateInstalledEncounterActors({ gameSystemId: nextState.gameSystemId, facts }),
        facts
      )
      return projectGm({ ...nextState, actors }, bindEncounterActorRuleOutputToFacts(output, facts))
    }
  })
}
