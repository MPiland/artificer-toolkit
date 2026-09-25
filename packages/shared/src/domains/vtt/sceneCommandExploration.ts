import {
  deriveSceneExplorationPatch,
  deriveSceneTokenPathExplorationPatch,
  sceneTokenIdsAffectedByBarriers,
  type SceneExplorationState
} from './exploration.js'
import { resolveSceneCharacterVision } from './sceneReducer.js'
import type { SceneAtomicDelta, SceneCharacterVision, ScenePoint } from './scene.js'

/** Select recipients before loading their fog; preserve supplied geometry and Character vision. */
export function planSceneCommandExploration(
  priorState: Pick<SceneExplorationState, 'barriers'>,
  state: Omit<SceneExplorationState, 'fogLayers'>,
  delta: SceneAtomicDelta,
  sceneVisionContext?: {
    encounterCharacterBindings: readonly { actorId: string; characterId: string; tokenId: string }[]
    characterVisions: readonly SceneCharacterVision[]
  }
): {
  state: Omit<SceneExplorationState, 'fogLayers'>
  tokenIds: string[]
  owners: (string | null)[]
} {
  const geometry = {
    map: state.map,
    grid: state.grid,
    tokens: state.tokens,
    barriers: state.barriers,
    doorStates: state.doorStates,
    fogMode: state.fogMode
  }
  const resolvedState = sceneVisionContext
    ? resolveSceneCharacterVision(
        geometry,
        sceneVisionContext.encounterCharacterBindings,
        sceneVisionContext.characterVisions
      )
    : geometry
  const affectedBarriers =
    delta.kind === 'DOOR_STATE_SET'
      ? state.barriers.filter((barrier) => barrier.id === delta.barrierId)
      : delta.kind === 'BARRIER_UPSERTED'
        ? [
            ...priorState.barriers.filter((barrier) => barrier.id === delta.barrier.id),
            delta.barrier
          ]
        : delta.kind === 'BARRIER_REMOVED'
          ? priorState.barriers.filter((barrier) => barrier.id === delta.barrierId)
          : []
  const tokenIds =
    delta.kind === 'TOKEN_MOVED'
      ? [delta.tokenId]
      : delta.kind === 'TOKEN_UPSERTED'
        ? [delta.token.id]
        : delta.kind === 'DOOR_STATE_SET' ||
            delta.kind === 'BARRIER_UPSERTED' ||
            delta.kind === 'BARRIER_REMOVED'
          ? sceneTokenIdsAffectedByBarriers(resolvedState, affectedBarriers)
          : null
  // Fog OFF records no exploration; layers kept from an earlier fog mode stay unchanged.
  if (resolvedState.fogMode === 'OFF' || tokenIds === null || tokenIds.length === 0)
    return { state: resolvedState, tokenIds: [], owners: [] }
  const owners =
    resolvedState.fogMode === 'SHARED_PARTY'
      ? [null]
      : [
          ...new Set(
            resolvedState.tokens
              .filter((token) => tokenIds.includes(token.id))
              .flatMap((token) => token.controlledByUserIds)
          )
        ]
  return { state: resolvedState, tokenIds, owners }
}

/** Derive command-owned fog changes using the existing geometry and supplied Character vision. */
export function deriveSceneCommandExplorationDeltas(
  priorState: Pick<SceneExplorationState, 'barriers'>,
  state: SceneExplorationState,
  delta: SceneAtomicDelta,
  sceneVisionContext?: Parameters<typeof planSceneCommandExploration>[3],
  movementPath?: readonly ScenePoint[]
): SceneAtomicDelta[] {
  const plan = planSceneCommandExploration(priorState, state, delta, sceneVisionContext)
  return plan.owners.flatMap((ownerUserId) => {
    const existing = state.fogLayers.find((layer) => layer.ownerUserId === ownerUserId)
    const recipientState = { ...plan.state, fogLayers: existing ? [existing] : [] }
    const layer =
      delta.kind === 'TOKEN_MOVED' && movementPath
        ? deriveSceneTokenPathExplorationPatch(recipientState, {
            ownerUserId,
            path: movementPath,
            tokenId: delta.tokenId
          })
        : deriveSceneExplorationPatch(recipientState, {
            ownerUserId,
            tokenIds: plan.tokenIds
          })
    return layer ? [{ kind: 'FOG_CHUNKS_PATCHED' as const, layer }] : []
  })
}
