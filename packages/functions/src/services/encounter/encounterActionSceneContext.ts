import {
  createEncounterRepository,
  createVttSceneRepository,
  type DBLike
} from '@artificer-toolkit/db'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { SceneGrid, ScenePoint, SceneToken } from '@artificer-toolkit/shared/vtt'

import { EncounterConflictError } from './encounterErrors.js'
import { encounterSceneGridPolicyRegistry } from '../rules/sceneGridPolicyRegistry.js'

/**
 * The server-only Scene facts an action policy may consume. This is obtained
 * under the already locked Encounter and is never a Scene command or delta.
 */
export interface LockedEncounterActionSceneContext {
  sceneId: string
  sceneVersion: number
  sourceToken: EncounterActionMechanicalToken
  targetToken: EncounterActionMechanicalToken
  grid: SceneGrid
}

/**
 * The complete geometry fact an action policy may inspect. Presentation,
 * control, fog, and vision fields intentionally never cross this boundary.
 */
export interface EncounterActionMechanicalToken {
  actorId: string
  height: number
  position: ScenePoint
  rotationDegrees: number
  tokenId: string
  width: number
}

export interface EncounterActionSceneDependency {
  sceneId: string
  sceneVersion: number
  sourceTokenId: string
  targetTokenId: string
}

export type EncounterActionSceneRequest = {
  sceneId: string
  expectedSceneVersion: number
  sourceTokenId: string
  targetTokenId: string
} | null

export interface EncounterActionStartIntent extends Readonly<Record<string, string>> {
  actionId: string
  actorId: string
  sceneContextChecksum: string
  targetActorId: string
}

function mechanicalTokenFact(token: SceneToken, actorId: string): EncounterActionMechanicalToken {
  return {
    actorId,
    height: token.height,
    position: { x: token.position.x, y: token.position.y },
    rotationDegrees: token.rotationDegrees,
    tokenId: token.id,
    width: token.width
  }
}

function sceneDependencyFromContext(
  context:
    | EncounterActionSceneDependency
    | EncounterActionSceneRequest
    | LockedEncounterActionSceneContext
): EncounterActionSceneDependency | null {
  if (!context) return null
  if ('sourceToken' in context) return toEncounterActionSceneDependency(context)
  if ('expectedSceneVersion' in context) {
    return {
      sceneId: context.sceneId,
      sceneVersion: context.expectedSceneVersion,
      sourceTokenId: context.sourceTokenId,
      targetTokenId: context.targetTokenId
    }
  }
  return context
}

/** One canonical action intent shape for fresh execution and terminal replay. */
export function createEncounterActionStartIntent(input: {
  actionId: string
  actorId: string
  sceneContext:
    | EncounterActionSceneDependency
    | EncounterActionSceneRequest
    | LockedEncounterActionSceneContext
  targetActorId: string
}): EncounterActionStartIntent {
  return {
    actionId: input.actionId,
    actorId: input.actorId,
    sceneContextChecksum: checksumRuleDocument(sceneDependencyFromContext(input.sceneContext)),
    targetActorId: input.targetActorId
  }
}

export function toEncounterActionSceneDependency(
  context: LockedEncounterActionSceneContext | null
): EncounterActionSceneDependency | null {
  return context
    ? {
        sceneId: context.sceneId,
        sceneVersion: context.sceneVersion,
        sourceTokenId: context.sourceToken.tokenId,
        targetTokenId: context.targetToken.tokenId
      }
    : null
}

/** Locks one exact Scene dependency after the Encounter root is locked. */
export async function lockEncounterActionSceneContext(input: {
  db: DBLike
  encounterId: string
  actorId: string
  targetActorId: string
  request: EncounterActionSceneRequest
}): Promise<LockedEncounterActionSceneContext | null> {
  const request = input.request
  if (!request) return null
  const encounter = await createEncounterRepository(input.db).lock(input.encounterId)
  if (!encounter || encounter.id !== input.encounterId)
    throw new EncounterConflictError('Action Scene context is stale.')
  const repository = createVttSceneRepository(input.db)
  const binding = await repository.findEncounterBinding(input.encounterId)
  if (!binding) throw new EncounterConflictError('Action Scene context is stale.')
  const scene = await repository.lockLiveScene(binding.sceneId)
  if (
    !scene ||
    scene.state.id !== request.sceneId ||
    scene.state.version !== request.expectedSceneVersion
  ) {
    throw new EncounterConflictError('Action Scene context is stale.')
  }
  const sourceToken = scene.state.tokens.find((token) => token.id === request.sourceTokenId)
  const targetToken = scene.state.tokens.find((token) => token.id === request.targetTokenId)
  const actorIdByTokenId = new Map<string, string>()
  for (const actorTokenBinding of await repository.listActorTokenBindings(input.encounterId)) {
    if (actorIdByTokenId.has(actorTokenBinding.tokenId))
      throw new EncounterConflictError('Action Scene token context is stale.')
    actorIdByTokenId.set(actorTokenBinding.tokenId, actorTokenBinding.actorId)
  }
  if (
    !sourceToken ||
    !targetToken ||
    actorIdByTokenId.get(sourceToken.id) !== input.actorId ||
    actorIdByTokenId.get(targetToken.id) !== input.targetActorId
  ) {
    throw new EncounterConflictError('Action Scene token context is stale.')
  }
  return {
    sceneId: scene.state.id,
    sceneVersion: scene.state.version,
    sourceToken: mechanicalTokenFact(sourceToken, input.actorId),
    targetToken: mechanicalTokenFact(targetToken, input.targetActorId),
    grid: encounterSceneGridPolicyRegistry.resolveEffectiveGrid({
      encounter,
      sceneGrid: scene.state.grid
    })
  }
}

export async function revalidateEncounterActionSceneDependency(input: {
  db: DBLike
  encounterId: string
  actorId: string
  targetActorId: string
  dependency: EncounterActionSceneDependency | null
}): Promise<LockedEncounterActionSceneContext | null> {
  return lockEncounterActionSceneContext({
    db: input.db,
    encounterId: input.encounterId,
    actorId: input.actorId,
    targetActorId: input.targetActorId,
    request: input.dependency
      ? {
          sceneId: input.dependency.sceneId,
          expectedSceneVersion: input.dependency.sceneVersion,
          sourceTokenId: input.dependency.sourceTokenId,
          targetTokenId: input.dependency.targetTokenId
        }
      : null
  })
}
