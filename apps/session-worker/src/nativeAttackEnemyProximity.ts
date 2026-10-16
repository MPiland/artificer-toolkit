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

type EnemyProximityInput = {
  state: EncounterRunState
  actors: readonly EncounterRunActorState[]
  attackerActorId: string
  targetActorId: string
  grid: SceneGrid
  /** The Scene's tokens bound to the Run's actors, the mover's at the place the attack is made. */
  tokens: Parameters<typeof nearestAbleEnemyProximity>[0]['tokens']
  loadTarget: (actor: EncounterRunActorState) => Promise<MovementTarget>
  definitions: CurrentReusableDefinitionSource
}

/**
 * How near an enemy stands to an attack's target among the given Scene tokens. Every actor
 * consulted is loaded through `loadTarget`, so its revision joins the commit's read fence.
 */
export function measureNativeEnemyProximity(input: EnemyProximityInput): Promise<Dnd5eEnemyProximity> {
  return nearestAbleEnemyProximity({
    grid: input.grid,
    actors: input.actors,
    attackerActorId: input.attackerActorId,
    targetActorId: input.targetActorId,
    tokens: input.tokens,
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

/**
 * How near an enemy stands to an attack's target, from the live Scene the action locked (null for
 * an action without Scene positions, which leaves the check unanswerable). The capture refuses a
 * Scene whose version moved since the action was composed.
 */
export async function readNativeLiveEnemyProximity(
  input: Omit<EnemyProximityInput, 'attackerActorId' | 'targetActorId' | 'grid' | 'tokens'> & {
    attacker: MovementTarget
    target: MovementTarget
    sceneContext: { sceneId: string; sceneVersion: number; grid: SceneGrid } | null
    capture: (
      request: LiveSessionEncounterRulesRequest
    ) => Promise<LiveSessionEncounterRulesResponse>
  }
): Promise<Dnd5eEnemyProximity | null> {
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
  return measureNativeEnemyProximity({
    ...input,
    attackerActorId: input.attacker.actor.id,
    targetActorId: input.target.actor.id,
    grid: sceneContext.grid,
    tokens: captured.context.tokens
  })
}
