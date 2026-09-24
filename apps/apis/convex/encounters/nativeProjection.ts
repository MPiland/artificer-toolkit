import type { EncounterActorRuleOutput } from '@artificer-toolkit/schema/api/encounterActorRules'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { projectCurrentEncounterGm } from '@artificer-toolkit/rules-runtime/encounterProjection'
import type { MutationCtx } from '../_generated/server'
import { createEncounterInitiativeStore } from './initiativeStore'

export async function projectNativeGm(
  ctx: MutationCtx,
  state: EncounterRunState,
  actors: readonly EncounterRunActorState[],
  rules: EncounterActorRuleOutput
) {
  const initiativeRoundState =
    state.status === 'ACTIVE'
      ? await createEncounterInitiativeStore(ctx).lockInitiativeRound({
          encounterId: state.id,
          round: state.round
        })
      : null
  return projectCurrentEncounterGm({ state, actors, rules, initiativeRoundState })
}
