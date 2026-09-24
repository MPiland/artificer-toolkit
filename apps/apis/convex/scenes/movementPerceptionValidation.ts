import type { sceneGeometryFinishInputSchema } from '@artificer-toolkit/schema/api/sceneGeometry'
import type { SceneMovementPerceptionEnvironment } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import type { MovementReactionChoiceGroupDto } from '@artificer-toolkit/schema/shared/reaction'
import {
  discoverEncounterMovementReactionChoices,
  revalidateEncounterMovementReactionOption
} from '@artificer-toolkit/rules-runtime/encounterMovementReactionDiscovery'
import type { MutationCtx } from '../_generated/server'
import { loadNativeMovementReactionFacts } from '../encounters/movementReactionDiscovery'
import type { MovementTarget } from '../encounters/movementTargets'
import { createNativeMovementReactionPerception } from '../encounters/movementReactionPerception'
import type { readSpatialSceneGeometry } from './spatialGeometry'
import { readMovement, requestFor } from './movementPerception'

type Request = ReturnType<typeof sceneGeometryFinishInputSchema.parse>
export async function readSceneMovementReactionPerception(
  ctx: MutationCtx,
  request: Request,
  environments: readonly SceneMovementPerceptionEnvironment[],
  targets?: ReadonlyMap<string, MovementTarget>,
  currentGeometry?: Awaited<ReturnType<typeof readSpatialSceneGeometry>>
) {
  const { movement, geometry, scope } = await readMovement(ctx, request, currentGeometry)
  if (geometry.encounter.automationMode === 'MANUAL') return null
  const facts = await loadNativeMovementReactionFacts(
    ctx,
    {
      encounterId: geometry.encounter.id,
      expectedEncounterVersion: movement.expectedEncounterVersion!
    },
    targets
  )
  const byKey = new Map(environments.map((entry) => [entry.key, entry.environment]))
  if (byKey.size !== environments.length)
    throw new Error('Reaction perception evidence contains duplicate contacts.')
  const resolvePerception = await createNativeMovementReactionPerception(
    ctx,
    {
      state: facts.state,
      actors: facts.encounter.actors,
      targets: facts.targets,
      movingTokenId: movement.tokenId,
      actorIdByTokenId: geometry.actorIdByTokenId,
      sceneId: scope.sceneId,
      sceneVersion: scope.sceneVersion,
      scene: { tokens: geometry.sceneTokens },
      sceneGrid: scope.grid,
      resolveEnvironment: ({ observerToken, subjectToken }) => {
        const key = requestFor(scope, observerToken, subjectToken).key
        const environment = byKey.get(key)
        if (!environment) throw new Error('Reaction perception evidence is missing or stale.')
        return environment
      }
    },
    {
      ctx,
      userId: facts.userId,
      state: facts.state,
      actors: facts.encounter.actors,
      header: geometry.saveContext.header
    }
  )
  return { movement, geometry, scope, facts, resolvePerception }
}

/** Rechecks current sources and exact contact/grid identity before consuming internal action evidence. */
export async function discoverSceneMovementReactions(
  ctx: MutationCtx,
  request: Request,
  occurrenceId: string,
  environments: readonly SceneMovementPerceptionEnvironment[],
  currentGeometry?: Awaited<ReturnType<typeof readSpatialSceneGeometry>>
) {
  const current = await readSceneMovementReactionPerception(
    ctx,
    request,
    environments,
    undefined,
    currentGeometry
  )
  if (!current)
    return { reactionTimeline: [], firstBoundaryDistance: null, movementTargets: undefined }
  const { movement, geometry, scope, facts, resolvePerception } = current
  const choices = await discoverEncounterMovementReactionChoices({
    ...facts,
    grid: scope.grid,
    movementKind: movement.movementKind,
    movingTokenId: movement.tokenId,
    occurrenceId,
    path: movement.path,
    actorIdByTokenId: geometry.actorIdByTokenId,
    tokens: geometry.sceneTokens,
    resolvePerception
  })
  return { ...choices, movementTargets: facts.targets }
}

/** Revalidate issued contacts directly after the mover has reached a prior boundary. */
export async function revalidateSceneMovementReactionChoice(
  ctx: MutationCtx,
  request: Request,
  occurrenceId: string,
  group: MovementReactionChoiceGroupDto,
  environments: readonly SceneMovementPerceptionEnvironment[],
  currentTargets?: ReadonlyMap<string, MovementTarget>
) {
  const current = await readSceneMovementReactionPerception(
    ctx,
    request,
    environments,
    currentTargets
  )
  if (!current) throw new Error('The next movement reaction choice is stale.')
  const { movement, geometry, facts, resolvePerception } = current
  for (const option of group.options)
    await revalidateEncounterMovementReactionOption({
      ...facts,
      movementKind: movement.movementKind,
      occurrenceId,
      option,
      actorIdByTokenId: geometry.actorIdByTokenId,
      tokens: geometry.sceneTokens,
      resolvePerception
    })
}
