import type {
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterActorCannotAct } from '@artificer-toolkit/rules-runtime/encounterBasicActions'
import {
  deadCharacterIdsOfTargets,
  isEncounterActorDefeated
} from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { nearestAbleEnemyProximity } from '@artificer-toolkit/rules-runtime/encounterEnemyProximity'
import type { MovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import type { CurrentReusableDefinitionSource } from '@artificer-toolkit/rules-runtime/ruleCapabilityStateService'
import type { Dnd5eEnemyProximity } from '@artificer-toolkit/rules-runtime/systems/dnd5e/attackRestrictions'
import type { SceneGrid } from '@artificer-toolkit/shared/vtt'

/**
 * How near an enemy stands to an attack's target, from the live Scene the action locked (null for
 * an action without Scene positions, which leaves the check unanswerable). The capture refuses a
 * Scene whose version moved since the action was composed; every actor consulted is loaded through
 * `loadTarget`, so its revision joins the commit's read fence.
 */
export async function readNativeLiveEnemyProximity(input: {
  state: EncounterRunState
  actors: readonly EncounterRunActorState[]
  attacker: MovementTarget
  target: MovementTarget
  sceneContext: { sceneId: string; sceneVersion: number; grid: SceneGrid } | null
  loadTarget: (actor: EncounterRunActorState) => Promise<MovementTarget>
  definitions: CurrentReusableDefinitionSource
  capture: (request: LiveSessionEncounterRulesRequest) => Promise<LiveSessionEncounterRulesResponse>
}): Promise<Dnd5eEnemyProximity | null> {
  const { sceneContext } = input
  if (!sceneContext) return null
  const captured = await input.capture({
    kind: 'ACTION_AREA_SCENE',
    command: {
      actorId: input.attacker.actor.id,
      sceneId: sceneContext.sceneId,
      expectedSceneVersion: sceneContext.sceneVersion
    }
  })
  if (captured.kind !== 'ACTION_AREA_SCENE') throw new Error('Action Scene context is unavailable.')
  return nearestAbleEnemyProximity({
    grid: sceneContext.grid,
    actors: input.actors,
    attackerActorId: input.attacker.actor.id,
    targetActorId: input.target.actor.id,
    tokens: captured.context.tokens,
    canAct: async (actorId) => {
      const actor = input.actors.find((candidate) => candidate.id === actorId)
      if (!actor) throw new Error('Encounter rules input binding mismatch.')
      const loaded = await input.loadTarget(actor)
      return (
        !isEncounterActorDefeated(actor, deadCharacterIdsOfTargets([loaded])) &&
        !(await encounterActorCannotAct({
          conditionIds: loaded.state.conditions,
          activeEffects: loaded.activeEffects,
          gameSystemId: input.state.gameSystemId,
          definitions: input.definitions
        }))
      )
    }
  })
}
