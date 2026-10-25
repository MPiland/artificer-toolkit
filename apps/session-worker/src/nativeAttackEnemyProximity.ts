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
import {
  nearestAbleEnemyProximity,
  type EnemyProximity
} from '@artificer-toolkit/rules-runtime/encounterEnemyProximity'
import {
  movedTowardTarget,
  type MoveToward
} from '@artificer-toolkit/rules-runtime/encounterMoveToward'
import type { MovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import type { CurrentReusableDefinitionSource } from '@artificer-toolkit/rules-runtime/ruleCapabilityStateService'
import type { SceneGrid } from '@artificer-toolkit/shared/vtt'
import { readNativeLiveTurnLastMove } from './nativeTurnUses.js'

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
export function measureNativeEnemyProximity(input: EnemyProximityInput): Promise<EnemyProximity> {
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
  input: Omit<EnemyProximityInput, 'attackerActorId' | 'targetActorId' | 'grid' | 'tokens'> &
    LiveAttackScene
): Promise<EnemyProximity | null> {
  const { sceneContext } = input
  if (!sceneContext) return null
  const tokens = await captureActionSceneTokens(input, sceneContext)
  return measureNativeEnemyProximity({
    ...input,
    attackerActorId: input.attacker.actor.id,
    targetActorId: input.target.actor.id,
    grid: sceneContext.grid,
    tokens
  })
}

/**
 * How far the attacker's latest move this turn closed its distance to the attack's target, from
 * the live Scene the action locked and the room's turn record (D164). Null for an action without
 * Scene positions, which leaves the check unanswerable.
 */
export async function readNativeLiveMoveToward(input: LiveAttackScene): Promise<MoveToward | null> {
  const { sceneContext } = input
  if (!sceneContext) return null
  const tokens = await captureActionSceneTokens(input, sceneContext)
  const attackerToken = tokens.find(({ actorId }) => actorId === input.attacker.actor.id)
  const targetToken = tokens.find(({ actorId }) => actorId === input.target.actor.id)
  if (!attackerToken || !targetToken) throw new Error('Encounter action facts are stale.')
  return movedTowardTarget({
    grid: sceneContext.grid,
    lastMove: await readNativeLiveTurnLastMove(input.capture, input.attacker.actor.id),
    attackerToken,
    targetToken
  })
}

type LiveAttackScene = {
  attacker: MovementTarget
  target: MovementTarget
  sceneContext: { sceneId: string; sceneVersion: number; grid: SceneGrid } | null
  capture: (request: LiveSessionEncounterRulesRequest) => Promise<LiveSessionEncounterRulesResponse>
}

/** The Scene's tokens bound to the Run's actors, from the live Scene the action locked. */
export async function captureActionSceneTokens(
  input: Pick<LiveAttackScene, 'attacker' | 'capture'>,
  sceneContext: { sceneId: string; sceneVersion: number }
) {
  const captured = await input.capture({
    kind: 'ACTION_AREA_SCENE',
    command: {
      actorId: input.attacker.actor.id,
      sceneId: sceneContext.sceneId,
      expectedSceneVersion: sceneContext.sceneVersion
    }
  })
  if (captured.kind !== 'ACTION_AREA_SCENE') throw new Error('Action Scene context is unavailable.')
  return captured.context.tokens
}
