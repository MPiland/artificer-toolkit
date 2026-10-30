import type { EncounterActorRuleOutput } from '@artificer-toolkit/schema/api/encounterActorRules'
import type { EncounterProjectionCharacterStates } from '@artificer-toolkit/schema/projections/encounterProjectionInput'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  heldConcentration,
  listActiveGrantListings
} from '@artificer-toolkit/rules-runtime/activeGrantListings'
import { listConcealment } from '@artificer-toolkit/rules-runtime/encounterConcealment'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import {
  projectCurrentEncounterGm,
  projectCurrentEncounterGmFacts
} from '@artificer-toolkit/rules-runtime/encounterProjection'
import { readRunProjectionFacts } from './actorProjectionFacts.js'
import { readEncounterCharacterStates } from './characterStates.js'
import { readActorConcentrationEffects } from './concentrationListing.js'
import { listActiveRuleEffects } from './effectStore.js'
import { readEncounterInitiativeRound } from './initiativeStore.js'
import type { EncounterProjectionTransaction } from './ports.js'
import type { EncounterReadContext } from './store.js'

function readCurrentInitiativeRound(ctx: EncounterReadContext, state: EncounterRunState) {
  return state.status === 'ACTIVE'
    ? readEncounterInitiativeRound(ctx, { encounterId: state.id, round: state.round })
    : Promise.resolve(null)
}

/**
 * Lists each actor's active grants, the Concentration it maintains and the concealment it holds on
 * its projection (D99, SPELLS-5.11, D116). A finished Run lists none: its view
 * reads only the Run's own documents (ADR 0035 Amendment 30), and the effects an owner holds then
 * may be later, carried over or unrelated.
 */
async function withActiveGrants<Projection extends { actors: readonly { id: string }[] }>(
  ctx: EncounterReadContext,
  state: EncounterRunState,
  actors: readonly Pick<EncounterRunActorState, 'id' | 'kind' | 'sourceId'>[],
  projection: Projection
) {
  if (state.status === 'COMPLETED')
    return {
      ...projection,
      actors: projection.actors.map((actor) => ({
        ...actor,
        activeGrants: [],
        concentration: null,
        concealment: null
      }))
    }
  const listingsByActorId = new Map(
    await Promise.all(
      actors.map(async (actor) => {
        // The Run's own read of its actors and Characters verified each owner already.
        const effects = await listActiveRuleEffects(ctx, turnEffectOwner(actor, state.id), {
          ownerVerified: true
        })
        const concentrationEffects = await readActorConcentrationEffects(ctx, { state, actor })
        return [
          actor.id,
          {
            activeGrants: listActiveGrantListings(effects),
            concentration: concentrationEffects && heldConcentration(concentrationEffects),
            concealment: listConcealment(effects)
          }
        ] as const
      })
    )
  )
  return {
    ...projection,
    actors: projection.actors.map((actor) => ({
      ...actor,
      activeGrants: listingsByActorId.get(actor.id)?.activeGrants ?? [],
      concentration: listingsByActorId.get(actor.id)?.concentration ?? null,
      concealment: listingsByActorId.get(actor.id)?.concealment ?? null
    }))
  }
}

/** Projects a Run's actors with rules already evaluated for them. */
export async function projectNativeGm(
  ctx: EncounterProjectionTransaction,
  state: EncounterRunState,
  actors: readonly EncounterRunActorState[],
  rules: EncounterActorRuleOutput
) {
  return withActiveGrants(
    ctx,
    state,
    actors,
    projectCurrentEncounterGm({
      state,
      actors,
      rules,
      initiativeRoundState: await readCurrentInitiativeRound(ctx, state),
      characterStates: await readEncounterCharacterStates(ctx, state, actors)
    })
  )
}

/** Projects a Run's stored projection facts with the Character values a reader chose for them. */
export async function projectEncounterFacts(
  ctx: EncounterReadContext,
  state: EncounterRunState,
  facts: Awaited<ReturnType<typeof readRunProjectionFacts>>,
  characterStates: EncounterProjectionCharacterStates
) {
  return withActiveGrants(
    ctx,
    state,
    facts.actors,
    projectCurrentEncounterGmFacts({
      state,
      ...facts,
      initiativeRoundState: await readCurrentInitiativeRound(ctx, state),
      characterStates
    })
  )
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
