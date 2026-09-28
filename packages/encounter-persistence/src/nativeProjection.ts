import type { EncounterActorRuleOutput } from '@artificer-toolkit/schema/api/encounterActorRules'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { projectCurrentEncounterGm } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { readEncounterCharacterStates } from './characterStates.js'
import { createEncounterInitiativeStore } from './initiativeStore.js'
import type { EncounterWriteTransaction } from './ports.js'

export async function projectNativeGm(
  ctx: EncounterWriteTransaction,
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
  return projectCurrentEncounterGm({
    state,
    actors,
    rules,
    initiativeRoundState,
    characterStates: await readEncounterCharacterStates(ctx, state, actors)
  })
}
