import type {
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { EncounterPerceptionRoller } from '@artificer-toolkit/rules-runtime/encounterAttackPerception'
import type { MovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import { loadEncounterFlankingFacts } from '@artificer-toolkit/rules-runtime/encounterPositionalContributors'
import type { CurrentReusableDefinitionSource } from '@artificer-toolkit/rules-runtime/ruleCapabilityStateService'
import type { SceneGrid } from '@artificer-toolkit/shared/vtt'
import { captureActionSceneTokens } from './nativeAttackEnemyProximity.js'
import { readNativeLiveCover } from './nativeLiveCover.js'
import {
  readNativeLiveAttackPerception,
  readNativeLiveObserversSeeing,
  readNativeLiveSourcesSeen
} from './nativeAttackPerception.js'

/**
 * The perception, cover and Flanking loaders an action's mechanics read from the live Scene it locked
 * (none apply to an action without Scene positions). Each creature's sight is read as the
 * attack's own is, and a creature already loaded for the action is not loaded again.
 */
export function nativeLiveAttackSceneLoaders(input: {
  state: EncounterRunState
  system: SystemAuthoredDto
  actors: readonly EncounterRunActorState[]
  movementTargets: ReadonlyMap<string, MovementTarget>
  loadTarget: (actor: EncounterRunActorState) => Promise<MovementTarget>
  definitions: CurrentReusableDefinitionSource
  sceneContext: { sceneId: string; sceneVersion: number; grid: SceneGrid } | null
  capture: (request: LiveSessionEncounterRulesRequest) => Promise<LiveSessionEncounterRulesResponse>
}) {
  const { state, system, actors, definitions, sceneContext, capture } = input
  const loadTarget = async (actor: EncounterRunActorState) =>
    input.movementTargets.get(actor.id) ?? input.loadTarget(actor)
  return {
    loadAttackPerception: (facts: {
      sourceFacts: MovementTarget
      targetFacts: MovementTarget
      roller: EncounterPerceptionRoller
    }) =>
      readNativeLiveAttackPerception({
        state,
        system,
        attacker: facts.sourceFacts,
        target: facts.targetFacts,
        roller: facts.roller,
        sceneContext,
        capture
      }),
    loadSourcesSeen: (facts: { holder: MovementTarget; sourceActorIds: readonly string[] }) =>
      readNativeLiveSourcesSeen({
        state,
        system,
        ...facts,
        actors,
        loadTarget,
        sceneContext,
        capture
      }),
    loadCover: (facts: { sourceFacts: MovementTarget; targetFacts: MovementTarget }) =>
      readNativeLiveCover({
        state,
        system,
        sourceActorId: facts.sourceFacts.actor.id,
        targetActorId: facts.targetFacts.actor.id,
        refuseBlocked: true,
        sceneContext,
        capture
      }),
    loadFlanking: async (facts: {
      sourceFacts: MovementTarget
      targetFacts: MovementTarget
      capabilityDefinitionId: string
    }) =>
      sceneContext
        ? loadEncounterFlankingFacts({
            gameSystemId: state.gameSystemId,
            actors,
            attacker: facts.sourceFacts,
            target: facts.targetFacts,
            grid: sceneContext.grid,
            tokens: await captureActionSceneTokens(
              { attacker: facts.sourceFacts, capture },
              sceneContext
            ),
            capabilityDefinitionId: facts.capabilityDefinitionId,
            loadTarget,
            definitions,
            observersSeeing: ({ subject, observers }) =>
              readNativeLiveObserversSeeing({
                state,
                system,
                subject,
                observers,
                sceneContext,
                capture
              })
          })
        : null
  }
}
