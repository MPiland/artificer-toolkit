import {
  canonicalizeSceneFogLayer,
  deriveSceneExplorationPatch,
  deriveSceneTokenPathExplorationPatch,
  sceneTokenIdsAffectedByBarriers,
  type SceneExplorationState
} from './exploration.js'
import { resolveSceneCharacterVision } from './sceneReducer.js'
import type {
  SceneAtomicDelta,
  SceneCharacterVision,
  SceneFogLayer,
  SceneFogMode,
  ScenePoint,
  SceneToken
} from './scene.js'

/**
 * Whether token moves and door changes on this Scene derive fog exploration: fog is on and a fog
 * layer or a seeing token exists. Fog OFF derives none, so kept layers and token vision do not apply.
 */
export function sceneDerivesExploration(scene: {
  fogMode: SceneFogMode
  fogLayerCount: number
  tokens: readonly Pick<SceneToken, 'vision'>[]
}): boolean {
  return (
    scene.fogMode !== 'OFF' &&
    (scene.fogLayerCount > 0 || scene.tokens.some((token) => token.vision?.enabled === true))
  )
}

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

type ExplorationPlan = ReturnType<typeof planSceneCommandExploration>

/** The newly explored chunks of one fog owner's layer; a token move explores along its path. */
function deriveOwnerExplorationPatch(
  plan: ExplorationPlan,
  input: {
    ownerUserId: string | null
    existing: SceneFogLayer | null
    movement?: { tokenId: string; path: readonly ScenePoint[] }
  }
): SceneFogLayer | null {
  const recipientState = { ...plan.state, fogLayers: input.existing ? [input.existing] : [] }
  return input.movement
    ? deriveSceneTokenPathExplorationPatch(recipientState, {
        ownerUserId: input.ownerUserId,
        path: input.movement.path,
        tokenId: input.movement.tokenId
      })
    : deriveSceneExplorationPatch(recipientState, {
        ownerUserId: input.ownerUserId,
        tokenIds: plan.tokenIds
      })
}

/**
 * The complete canonical layer a staged Scene command replaces for one fog owner, or null when it
 * explores nothing new. Staging replaces whole layers, so the existing chunks are carried forward.
 */
export function deriveSceneCommandFogLayer(
  plan: ExplorationPlan,
  input: Parameters<typeof deriveOwnerExplorationPatch>[1]
): SceneFogLayer | null {
  const patch = deriveOwnerExplorationPatch(plan, input)
  return patch
    ? canonicalizeSceneFogLayer({
        ...patch,
        chunks: [...(input.existing?.chunks ?? []), ...patch.chunks]
      })
    : null
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
    const layer = deriveOwnerExplorationPatch(plan, {
      ownerUserId,
      existing: state.fogLayers.find((candidate) => candidate.ownerUserId === ownerUserId) ?? null,
      ...(delta.kind === 'TOKEN_MOVED' && movementPath
        ? { movement: { tokenId: delta.tokenId, path: movementPath } }
        : {})
    })
    return layer ? [{ kind: 'FOG_CHUNKS_PATCHED' as const, layer }] : []
  })
}
