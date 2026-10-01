import type { EncounterActorRuleOutput } from '@artificer-toolkit/schema/api/encounterActorRules'
import type { EncounterProjectionCharacterStates } from '@artificer-toolkit/schema/projections/encounterProjectionInput'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  projectCurrentEncounterGm,
  projectCurrentEncounterGmFacts
} from '@artificer-toolkit/rules-runtime/encounterProjection'
import { readRunProjectionFacts } from './actorProjectionFacts.js'
import { readEncounterCharacterStates } from './characterStates.js'
import { readEncounterInitiativeRound } from './initiativeStore.js'
import type { EncounterProjectionTransaction } from './ports.js'
import type { EncounterReadContext } from './store.js'

function readCurrentInitiativeRound(ctx: EncounterReadContext, state: EncounterRunState) {
  return state.status === 'ACTIVE'
    ? readEncounterInitiativeRound(ctx, { encounterId: state.id, round: state.round })
    : Promise.resolve(null)
}

/** Projects a Run's actors with rules already evaluated for them. */
export async function projectNativeGm(
  ctx: EncounterProjectionTransaction,
  state: EncounterRunState,
  actors: readonly EncounterRunActorState[],
  rules: EncounterActorRuleOutput
) {
  return projectCurrentEncounterGm({
    state,
    actors,
    rules,
    initiativeRoundState: await readCurrentInitiativeRound(ctx, state),
    characterStates: await readEncounterCharacterStates(ctx, state, actors)
  })
}

/** Projects a Run's stored projection facts with the Character values a reader chose for them. */
export async function projectEncounterFacts(
  ctx: EncounterReadContext,
  state: EncounterRunState,
  facts: Awaited<ReturnType<typeof readRunProjectionFacts>>,
  characterStates: EncounterProjectionCharacterStates
) {
  return projectCurrentEncounterGmFacts({
    state,
    ...facts,
    initiativeRoundState: await readCurrentInitiativeRound(ctx, state),
    characterStates
  })
}

/**
 * The Run's GM projection, built from its stored state, its actors' projection facts, the current
 * initiative round and each Character (ADR 0035 Amendment 12). The Run stores no projection; readers
 * and command results build it here without reading the actor documents.
 */
export async function readEncounterGmProjection(
  ctx: EncounterProjectionTransaction,
  state: EncounterRunState
) {
  const facts = await readRunProjectionFacts(ctx, state)
  return projectEncounterFacts(
    ctx,
    state,
    facts,
    await readEncounterCharacterStates(ctx, state, facts.actors)
  )
}
