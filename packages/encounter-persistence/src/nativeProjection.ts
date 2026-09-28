import type { EncounterActorRuleOutput } from '@artificer-toolkit/schema/api/encounterActorRules'
import type { EncounterProjectionCharacterStates } from '@artificer-toolkit/schema/projections/encounterProjectionInput'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { projectCurrentEncounterGm } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { readEncounterCharacterStates } from './characterStates.js'
import { readRunActors } from './documents.js'
import { readEncounterInitiativeRound } from './initiativeStore.js'
import type { EncounterReadTransaction } from './ports.js'

async function projectRun(
  ctx: EncounterReadTransaction,
  state: EncounterRunState,
  actors: readonly EncounterRunActorState[],
  rules: EncounterActorRuleOutput,
  characterStates: EncounterProjectionCharacterStates
) {
  const initiativeRoundState =
    state.status === 'ACTIVE'
      ? await readEncounterInitiativeRound(ctx, { encounterId: state.id, round: state.round })
      : null
  return projectCurrentEncounterGm({ state, actors, rules, initiativeRoundState, characterStates })
}

/** Projects a Run's actors with rules already evaluated for them. */
export async function projectNativeGm(
  ctx: EncounterReadTransaction,
  state: EncounterRunState,
  actors: readonly EncounterRunActorState[],
  rules: EncounterActorRuleOutput
) {
  return projectRun(
    ctx,
    state,
    actors,
    rules,
    await readEncounterCharacterStates(ctx, state, actors)
  )
}

/** Projects a Run's stored actors with the Character values a reader chose for them. */
export async function projectEncounterActors(
  ctx: EncounterReadTransaction,
  state: EncounterRunState,
  actors: readonly EncounterRunActorState[],
  characterStates: EncounterProjectionCharacterStates
) {
  const facts = buildEncounterActorRuleFacts({ actors })
  const rules = reconcileEncounterActorRuleOutput(
    evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
    facts
  )
  return projectRun(ctx, state, actors, rules, characterStates)
}

/**
 * The Run's GM projection, built from its stored state, actors, initiative round and Characters (ADR
 * 0035 Amendment 12). The Run stores no projection; readers and command results build it here.
 */
export async function readEncounterGmProjection(
  ctx: EncounterReadTransaction,
  state: EncounterRunState
) {
  const actors = await readRunActors(ctx, state)
  return projectEncounterActors(
    ctx,
    state,
    actors,
    await readEncounterCharacterStates(ctx, state, actors)
  )
}
