import { loadNativeActionRelationshipFacts } from './actionRelationshipFacts'
import { loadNativeEncounterActionSource } from './actionSources'
import { readRunActor, readRunActors, readRunState } from './documents'
import { loadMovementTargets, type MovementTarget } from './movementTargets'
import { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import type { EncounterWieldConflictAcceptance } from '@artificer-toolkit/rules-runtime/encounterWieldConflict'
import type { QueryCtx } from '../_generated/server'

type EncounterState = ReturnType<typeof readRunState>
type EncounterActor = Awaited<ReturnType<typeof readRunActor>>
type EncounterActors = Readonly<Awaited<ReturnType<typeof readRunActors>>>

/** Loads current source, target, and resource facts without choosing a caller policy or publishing. */
export async function prepareNativeEncounterActionMechanics(
  ctx: QueryCtx,
  input: {
    state: EncounterState
    actor: EncounterActor
    target: EncounterActor
    actors: EncounterActors
    actionId: string
    wieldConflictAcceptance: EncounterWieldConflictAcceptance
    overridable: boolean
    campaignOwnerUserId: string
    movementTargets?: ReadonlyMap<string, MovementTarget>
  }
) {
  const { state, actor, target } = input
  const movementTargets =
    input.movementTargets ??
    (await loadMovementTargets(ctx, {
      encounterId: state.id,
      expectedEncounterVersion: state.version,
      targetActorIds: [...new Set([actor.id, target.id])],
      includeReactionSources: true
    }))
  return prepareEncounterActionMechanics({
    state,
    actor,
    target,
    actors: input.actors,
    actionId: input.actionId,
    wieldConflictAcceptance: input.wieldConflictAcceptance,
    overridable: input.overridable,
    movementTargets,
    loadSource: (sourceInput) => loadNativeEncounterActionSource(ctx, sourceInput),
    loadRelationshipFacts: (factsInput) => loadNativeActionRelationshipFacts(ctx, factsInput)
  })
}
