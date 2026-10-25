import type {
  SceneGeometryEntity,
  SceneNativeGeometryCommandInput
} from '@artificer-toolkit/schema/api/sceneGeometry'
import type { SceneAtomicDelta } from '@artificer-toolkit/shared/vtt/scene'

export function normalizeSceneGeometryEntity<T extends SceneGeometryEntity>(value: T): T {
  if (value.collection === 'barriers')
    return { ...value, entity: { ...value.entity, id: value.entity.id.toLowerCase() } }
  return {
    ...value,
    entity: {
      ...value.entity,
      id: value.entity.id.toLowerCase(),
      assetId: value.entity.assetId?.toLowerCase() ?? null,
      ...(value.entity.characterId && { characterId: value.entity.characterId.toLowerCase() }),
      controlledByUserIds: [
        ...new Set(value.entity.controlledByUserIds.map((id) => id.toLowerCase()))
      ]
    }
  }
}

export function normalizeGeometryInput(
  input: SceneNativeGeometryCommandInput
): SceneNativeGeometryCommandInput {
  const identity = {
    sceneId: input.sceneId.toLowerCase(),
    commandId: input.commandId.toLowerCase()
  }
  switch (input.type) {
    case 'UPSERT_SCENE_TOKEN':
      return {
        ...input,
        ...identity,
        token: normalizeSceneGeometryEntity({ collection: 'tokens', entity: input.token }).entity
      }
    case 'REMOVE_SCENE_TOKEN':
      return { ...input, ...identity, tokenId: input.tokenId.toLowerCase() }
    case 'UPSERT_SCENE_BARRIER':
      return {
        ...input,
        ...identity,
        barrier: normalizeSceneGeometryEntity({ collection: 'barriers', entity: input.barrier })
          .entity
      }
    case 'REMOVE_SCENE_BARRIER':
    case 'SET_SCENE_DOOR_STATE':
      return { ...input, ...identity, barrierId: input.barrierId.toLowerCase() }
    case 'MOVE_SCENE_TOKEN':
    case 'SET_SCENE_TOKEN_FACING':
      return { ...input, ...identity, tokenId: input.tokenId.toLowerCase() }
  }
}

export function geometryTarget(input: SceneNativeGeometryCommandInput): {
  collection: 'tokens' | 'barriers'
  entityId: string
  delta: Extract<
    SceneAtomicDelta,
    {
      kind:
        | 'TOKEN_UPSERTED'
        | 'TOKEN_REMOVED'
        | 'TOKEN_MOVED'
        | 'TOKEN_FACING_SET'
        | 'BARRIER_UPSERTED'
        | 'BARRIER_REMOVED'
        | 'DOOR_STATE_SET'
    }
  >
} {
  switch (input.type) {
    case 'UPSERT_SCENE_TOKEN':
      return {
        collection: 'tokens',
        entityId: input.token.id,
        delta: { kind: 'TOKEN_UPSERTED', token: input.token }
      }
    case 'REMOVE_SCENE_TOKEN':
      return {
        collection: 'tokens',
        entityId: input.tokenId,
        delta: { kind: 'TOKEN_REMOVED', tokenId: input.tokenId }
      }
    case 'MOVE_SCENE_TOKEN':
      return {
        collection: 'tokens',
        entityId: input.tokenId,
        delta: {
          kind: 'TOKEN_MOVED',
          tokenId: input.tokenId,
          position: input.path.at(-1)!,
          ...(input.facingDegrees !== undefined && { rotationDegrees: input.facingDegrees })
        }
      }
    case 'SET_SCENE_TOKEN_FACING':
      return {
        collection: 'tokens',
        entityId: input.tokenId,
        delta: {
          kind: 'TOKEN_FACING_SET',
          tokenId: input.tokenId,
          rotationDegrees: input.rotationDegrees
        }
      }
    case 'UPSERT_SCENE_BARRIER':
      return {
        collection: 'barriers',
        entityId: input.barrier.id,
        delta: { kind: 'BARRIER_UPSERTED', barrier: input.barrier }
      }
    case 'REMOVE_SCENE_BARRIER':
      return {
        collection: 'barriers',
        entityId: input.barrierId,
        delta: { kind: 'BARRIER_REMOVED', barrierId: input.barrierId }
      }
    case 'SET_SCENE_DOOR_STATE':
      return {
        collection: 'barriers',
        entityId: input.barrierId,
        delta: { kind: 'DOOR_STATE_SET', barrierId: input.barrierId, state: input.state }
      }
  }
}
