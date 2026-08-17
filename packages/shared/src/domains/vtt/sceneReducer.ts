import type {
  EncounterSceneState,
  SceneAtomicDelta,
  SceneCharacterVision,
  SceneDefinition,
  SceneDelta,
  SceneEvent,
  SceneFogLayer,
  ScenePoint,
  SceneTransientReveal,
  SceneViewer
} from './scene.js'
import { VTT_SCENE_LIMITS } from './scene.js'
import {
  deriveSceneTokenPreviewFogLayers,
  isScenePointExplored,
  isScenePolygonExplored,
  isSceneSegmentExplored
} from './exploration.js'

function upsertById<T extends { id: string }>(values: T[], value: T): T[] {
  const index = values.findIndex((candidate) => candidate.id === value.id)
  if (index < 0) return [...values, value]
  return values.map((candidate, candidateIndex) => (candidateIndex === index ? value : candidate))
}

function removeById<T extends { id: string }>(values: T[], id: string): T[] {
  return values.filter((value) => value.id !== id)
}

function fogLayerKey(layer: SceneFogLayer): string {
  return layer.ownerUserId ?? 'SHARED_PARTY'
}

function dimRangeInSceneUnits(
  vision: SceneCharacterVision,
  grid: EncounterSceneState['grid']
): number | null {
  const range = vision.dimRange
  if (!range) return null
  const feet =
    range.unit === 'INCHES'
      ? range.amount / 12
      : range.unit === 'FEET'
        ? range.amount
        : range.unit === 'YARDS'
          ? range.amount * 3
          : range.unit === 'MILES'
            ? range.amount * 5_280
            : null
  if (feet === null || feet <= 0) return null
  if (grid.unit === 'FEET') return feet
  if (grid.unit === 'METERS') return feet * 0.3048
  return null
}

/** Apply pinned Character vision only where the scene token has no explicit vision override. */
export function resolveSceneCharacterVision(
  state: EncounterSceneState,
  bindings: readonly { actorId: string; characterId: string; encounterId: string }[],
  characterVisions: readonly SceneCharacterVision[]
): EncounterSceneState {
  const characterIdByActorId = new Map(
    bindings
      .filter((binding) => binding.encounterId === state.encounterId)
      .map((binding) => [binding.actorId, binding.characterId])
  )
  const visionByCharacterId = new Map(
    characterVisions.map((vision) => [vision.characterId, vision])
  )
  return {
    ...state,
    tokens: state.tokens.map((token) => {
      if (token.vision || !token.actorId) return token
      const characterId = characterIdByActorId.get(token.actorId)
      const characterVision = characterId ? visionByCharacterId.get(characterId) : undefined
      const dimRange = characterVision ? dimRangeInSceneUnits(characterVision, state.grid) : null
      return dimRange === null
        ? token
        : {
            ...token,
            vision: {
              angleDegrees: 360,
              brightRange: 0,
              dimRange,
              directionDegrees: 0,
              enabled: true
            }
          }
    })
  }
}

function sceneAtomicDeltaConflictKey(delta: SceneAtomicDelta): string {
  switch (delta.kind) {
    case 'TOKEN_UPSERTED':
      return `TOKEN:${delta.token.id}`
    case 'TOKEN_REMOVED':
    case 'TOKEN_MOVED':
    case 'TOKEN_MOVE_UNDONE':
      return `TOKEN:${delta.tokenId}`
    case 'DOOR_STATE_SET':
    case 'BARRIER_REMOVED':
      return `BARRIER:${delta.barrierId}`
    case 'BARRIER_UPSERTED':
      return `BARRIER:${delta.barrier.id}`
    case 'LIGHT_UPSERTED':
      return `LIGHT:${delta.light.id}`
    case 'LIGHT_REMOVED':
      return `LIGHT:${delta.lightId}`
    case 'DARKNESS_UPSERTED':
      return `DARKNESS:${delta.zone.id}`
    case 'DARKNESS_REMOVED':
      return `DARKNESS:${delta.zoneId}`
    case 'ANNOTATION_UPSERTED':
      return `ANNOTATION:${delta.annotation.id}`
    case 'ANNOTATION_REMOVED':
      return `ANNOTATION:${delta.annotationId}`
    case 'FOG_CHUNKS_PATCHED':
      return `FOG:${fogLayerKey(delta.layer)}`
    case 'FOG_LAYER_REPLACED':
      return `FOG:${delta.ownerUserId ?? 'SHARED_PARTY'}`
    case 'VISION_REVEAL_MODE_SET':
      return 'VISION_REVEAL_MODE'
    case 'MEASUREMENT_UPSERTED':
      return `MEASUREMENT:${delta.measurement.id}`
    case 'MEASUREMENT_REMOVED':
      return `MEASUREMENT:${delta.measurementId}`
  }
}

/**
 * Returns every resource a delta changes. Batches must retain derived deltas
 * (notably exploration fog) so stale commands can be safely rebased.
 */
export function sceneDeltaConflictKeys(delta: SceneDelta): string[] {
  if (delta.kind === 'BATCH') {
    return [...new Set(delta.deltas.flatMap((childDelta) => sceneDeltaConflictKeys(childDelta)))]
  }
  return [sceneAtomicDeltaConflictKey(delta)]
}

export function materializeEncounterScene(
  definition: SceneDefinition,
  encounterId: string,
  sceneId: string
): EncounterSceneState {
  return {
    annotations: definition.annotations.map((annotation) => ({ ...annotation })),
    barriers: definition.barriers.map((barrier) => ({ ...barrier })),
    campaignId: definition.campaignId,
    darknessZones: definition.darknessZones.map((zone) => ({
      ...zone,
      polygon: { points: zone.polygon.points.map((point) => ({ ...point })) }
    })),
    definitionId: definition.id,
    definitionVersion: definition.version,
    doorStates: Object.fromEntries(
      definition.barriers
        .filter((barrier) => barrier.kind === 'DOOR')
        .map((barrier) => [barrier.id, barrier.initialState])
    ),
    encounterId,
    fogLayers: [],
    fogMode: definition.fogMode,
    grid: structuredClone(definition.grid),
    id: sceneId,
    lights: definition.lights.map((light) => ({ ...light, position: { ...light.position } })),
    map: { ...definition.map },
    measurements: [],
    name: definition.name,
    tokens: definition.tokens.map((token) => ({
      ...token,
      controlledByUserIds: [...token.controlledByUserIds],
      position: { ...token.position },
      vision: token.vision ? { ...token.vision } : null
    })),
    version: 0,
    visionRevealMode: definition.visionRevealMode
  }
}

function applyAtomicDelta(
  state: EncounterSceneState,
  delta: SceneAtomicDelta
): EncounterSceneState {
  switch (delta.kind) {
    case 'TOKEN_UPSERTED':
      return { ...state, tokens: upsertById(state.tokens, delta.token) }
    case 'TOKEN_REMOVED':
      return { ...state, tokens: removeById(state.tokens, delta.tokenId) }
    case 'TOKEN_MOVED': {
      if (!state.tokens.some((token) => token.id === delta.tokenId)) {
        throw new Error('Cannot move a token that is not in the scene.')
      }
      return {
        ...state,
        tokens: state.tokens.map((token) =>
          token.id === delta.tokenId ? { ...token, position: delta.position } : token
        )
      }
    }
    case 'TOKEN_MOVE_UNDONE': {
      if (!state.tokens.some((token) => token.id === delta.tokenId)) {
        throw new Error('Cannot undo movement for a token that is not in the scene.')
      }
      return {
        ...state,
        tokens: state.tokens.map((token) =>
          token.id === delta.tokenId ? { ...token, position: delta.position } : token
        )
      }
    }
    case 'DOOR_STATE_SET': {
      if (
        !state.barriers.some((barrier) => barrier.id === delta.barrierId && barrier.kind === 'DOOR')
      ) {
        throw new Error('Cannot set state for a barrier that is not a door.')
      }
      return {
        ...state,
        doorStates: { ...state.doorStates, [delta.barrierId]: delta.state }
      }
    }
    case 'BARRIER_UPSERTED':
      return {
        ...state,
        barriers: upsertById(state.barriers, delta.barrier),
        doorStates:
          delta.barrier.kind === 'DOOR'
            ? state.doorStates[delta.barrier.id] === undefined
              ? { ...state.doorStates, [delta.barrier.id]: delta.barrier.initialState }
              : state.doorStates
            : Object.fromEntries(
                Object.entries(state.doorStates).filter(
                  ([barrierId]) => barrierId !== delta.barrier.id
                )
              )
      }
    case 'BARRIER_REMOVED': {
      return {
        ...state,
        barriers: removeById(state.barriers, delta.barrierId),
        doorStates: Object.fromEntries(
          Object.entries(state.doorStates).filter(([barrierId]) => barrierId !== delta.barrierId)
        )
      }
    }
    case 'LIGHT_UPSERTED':
      return { ...state, lights: upsertById(state.lights, delta.light) }
    case 'LIGHT_REMOVED':
      return { ...state, lights: removeById(state.lights, delta.lightId) }
    case 'DARKNESS_UPSERTED':
      return { ...state, darknessZones: upsertById(state.darknessZones, delta.zone) }
    case 'DARKNESS_REMOVED':
      return { ...state, darknessZones: removeById(state.darknessZones, delta.zoneId) }
    case 'ANNOTATION_UPSERTED':
      return { ...state, annotations: upsertById(state.annotations, delta.annotation) }
    case 'ANNOTATION_REMOVED':
      return { ...state, annotations: removeById(state.annotations, delta.annotationId) }
    case 'FOG_CHUNKS_PATCHED': {
      const key = fogLayerKey(delta.layer)
      const index = state.fogLayers.findIndex((layer) => fogLayerKey(layer) === key)
      if (index < 0) return { ...state, fogLayers: [...state.fogLayers, delta.layer] }
      const current = state.fogLayers[index]
      if (
        !current ||
        current.width !== delta.layer.width ||
        current.height !== delta.layer.height
      ) {
        throw new Error('Fog layer dimensions cannot change through a chunk patch.')
      }
      const chunks = new Map(current.chunks.map((chunk) => [chunk.index, chunk]))
      for (const chunk of delta.layer.chunks) chunks.set(chunk.index, chunk)
      return {
        ...state,
        fogLayers: state.fogLayers.map((layer, layerIndex) =>
          layerIndex === index
            ? {
                ...layer,
                chunks: [...chunks.values()].sort((left, right) => left.index - right.index)
              }
            : layer
        )
      }
    }
    case 'FOG_LAYER_REPLACED': {
      if (delta.layer && delta.layer.ownerUserId !== delta.ownerUserId) {
        throw new Error('Fog replacement owner must match its layer owner.')
      }
      const key = delta.ownerUserId ?? 'SHARED_PARTY'
      const remaining = state.fogLayers.filter((layer) => fogLayerKey(layer) !== key)
      return {
        ...state,
        fogLayers: delta.layer ? [...remaining, structuredClone(delta.layer)] : remaining
      }
    }
    case 'VISION_REVEAL_MODE_SET':
      return { ...state, visionRevealMode: delta.mode }
    case 'MEASUREMENT_UPSERTED':
      return { ...state, measurements: upsertById(state.measurements, delta.measurement) }
    case 'MEASUREMENT_REMOVED':
      return { ...state, measurements: removeById(state.measurements, delta.measurementId) }
  }
}

function assertSceneLimits(state: EncounterSceneState): void {
  const counts = [
    ['annotations', state.annotations.length, VTT_SCENE_LIMITS.annotations],
    ['barriers', state.barriers.length, VTT_SCENE_LIMITS.barriers],
    ['darkness zones', state.darknessZones.length, VTT_SCENE_LIMITS.darknessZones],
    ['lights', state.lights.length, VTT_SCENE_LIMITS.lights],
    ['measurements', state.measurements.length, VTT_SCENE_LIMITS.measurements],
    ['tokens', state.tokens.length, VTT_SCENE_LIMITS.tokens]
  ] as const
  for (const [label, count, limit] of counts) {
    if (count > limit) throw new Error(`Scene ${label} exceed the ${limit} item limit.`)
  }
  if (state.fogLayers.length > 101) throw new Error('Scene fog layers exceed the 101 layer limit.')
  if (state.fogLayers.some((layer) => layer.chunks.length > 256)) {
    throw new Error('Scene fog layers exceed the 256 chunk limit.')
  }
}

export function applySceneEvent(
  state: EncounterSceneState,
  event: SceneEvent
): EncounterSceneState {
  if (event.sceneId !== state.id) throw new Error('Scene event targets a different scene.')
  return applySceneDelta(state, event.delta, event.version)
}

export function applySceneDelta(
  state: EncounterSceneState,
  delta: SceneDelta,
  version: number
): EncounterSceneState {
  if (version <= state.version) return state
  if (version !== state.version + 1) {
    throw new Error('Scene events must be applied in contiguous version order.')
  }
  const deltas = delta.kind === 'BATCH' ? delta.deltas : [delta]
  const next = {
    ...deltas.reduce((current, atomicDelta) => applyAtomicDelta(current, atomicDelta), state),
    version
  }
  assertSceneLimits(next)
  return next
}

export function replaySceneEvents(
  definition: SceneDefinition,
  encounterId: string,
  sceneId: string,
  events: readonly SceneEvent[]
): EncounterSceneState {
  return events.reduce(
    (state, event) => applySceneEvent(state, event),
    materializeEncounterScene(definition, encounterId, sceneId)
  )
}

export function projectSceneForViewer(
  state: EncounterSceneState,
  viewer: SceneViewer
): EncounterSceneState {
  if (viewer.role === 'GM') return structuredClone(state)
  const barriers = state.barriers.filter((barrier) =>
    isSceneSegmentExplored(state, viewer.userId, barrier.a, barrier.b)
  )
  const barrierIds = new Set(barriers.map((barrier) => barrier.id))
  return {
    ...structuredClone(state),
    annotations: state.annotations.filter(
      (annotation) =>
        annotation.visibility === 'TABLE' &&
        isScenePointExplored(state, viewer.userId, annotation.position)
    ),
    barriers,
    darknessZones: state.darknessZones.filter((zone) =>
      isScenePolygonExplored(state, viewer.userId, zone.polygon)
    ),
    doorStates: Object.fromEntries(
      Object.entries(state.doorStates).filter(([barrierId]) => barrierIds.has(barrierId))
    ),
    fogLayers: state.fogLayers.filter(
      (layer) => layer.ownerUserId === null || layer.ownerUserId === viewer.userId
    ),
    lights: state.lights.filter((light) =>
      isScenePointExplored(state, viewer.userId, light.position)
    ),
    tokens: state.tokens.filter((token) => isSceneTokenVisibleToViewer(state, viewer, token.id))
  }
}

/** Build a recipient-specific transient reveal without exposing the complete scene. */
export function projectSceneTokenPreviewForViewer(
  state: EncounterSceneState,
  options: { path: readonly ScenePoint[]; tokenId: string; viewer: SceneViewer }
): { reveal: SceneTransientReveal; visionLayers: SceneFogLayer[] } {
  if (state.visionRevealMode === 'ON_DROP') {
    return { reveal: { barriers: [], doorStates: {}, tokens: [] }, visionLayers: [] }
  }
  const visionLayers = deriveSceneTokenPreviewFogLayers(state, options)
  let revealedState = state
  for (const layer of visionLayers) {
    revealedState = applyAtomicDelta(revealedState, { kind: 'FOG_CHUNKS_PATCHED', layer })
  }
  const before = projectSceneForViewer(state, options.viewer)
  const after = projectSceneForViewer(revealedState, options.viewer)
  const barrierIds = new Set(before.barriers.map((barrier) => barrier.id))
  const tokenIds = new Set(before.tokens.map((token) => token.id))
  const barriers = after.barriers.filter((barrier) => !barrierIds.has(barrier.id))
  return {
    reveal: {
      barriers,
      doorStates: Object.fromEntries(
        barriers.flatMap((barrier) => {
          const doorState = after.doorStates[barrier.id]
          return doorState ? [[barrier.id, doorState] as const] : []
        })
      ),
      tokens: after.tokens.filter((token) => !tokenIds.has(token.id))
    },
    visionLayers
  }
}

/** Lightweight token visibility check for private snapshots, deltas, and transient fanout. */
export function isSceneTokenVisibleToViewer(
  state: EncounterSceneState,
  viewer: SceneViewer,
  tokenId: string
) {
  const token = state.tokens.find((candidate) => candidate.id === tokenId)
  return (
    token !== undefined &&
    (viewer.role === 'GM' ||
      (!token.hidden &&
        (token.controlledByUserIds.includes(viewer.userId) ||
          isScenePointExplored(state, viewer.userId, token.position))))
  )
}

function visibleToken(state: EncounterSceneState, viewer: SceneViewer, tokenId: string) {
  const token = state.tokens.find((candidate) => candidate.id === tokenId)
  return isSceneTokenVisibleToViewer(state, viewer, tokenId) ? token : undefined
}

function visibleAnnotation(state: EncounterSceneState, viewer: SceneViewer, annotationId: string) {
  const annotation = state.annotations.find((candidate) => candidate.id === annotationId)
  return viewer.role === 'GM' ||
    (annotation?.visibility === 'TABLE' &&
      isScenePointExplored(state, viewer.userId, annotation.position))
    ? annotation
    : undefined
}

function projectAtomicSceneDeltaForViewer(
  before: EncounterSceneState,
  after: EncounterSceneState,
  viewer: SceneViewer,
  rawDelta: SceneAtomicDelta
): SceneAtomicDelta | null {
  switch (rawDelta.kind) {
    case 'TOKEN_UPSERTED': {
      const prior = visibleToken(before, viewer, rawDelta.token.id)
      const next = visibleToken(after, viewer, rawDelta.token.id)
      if (next) return { kind: 'TOKEN_UPSERTED', token: structuredClone(next) }
      return prior ? { kind: 'TOKEN_REMOVED', tokenId: rawDelta.token.id } : null
    }
    case 'TOKEN_REMOVED':
    case 'TOKEN_MOVED':
    case 'TOKEN_MOVE_UNDONE': {
      const tokenId = rawDelta.tokenId
      const prior = visibleToken(before, viewer, tokenId)
      const next = visibleToken(after, viewer, tokenId)
      if (next && prior) {
        if (rawDelta.kind === 'TOKEN_MOVED') {
          return { kind: 'TOKEN_MOVED', tokenId, position: structuredClone(next.position) }
        }
        if (rawDelta.kind === 'TOKEN_MOVE_UNDONE') {
          return {
            kind: 'TOKEN_MOVE_UNDONE',
            position: structuredClone(next.position),
            tokenId,
            undoneCommandId: rawDelta.undoneCommandId
          }
        }
        return { kind: 'TOKEN_UPSERTED', token: structuredClone(next) }
      }
      if (next) return { kind: 'TOKEN_UPSERTED', token: structuredClone(next) }
      return prior ? { kind: 'TOKEN_REMOVED', tokenId } : null
    }
    case 'ANNOTATION_UPSERTED': {
      const prior = visibleAnnotation(before, viewer, rawDelta.annotation.id)
      const next = visibleAnnotation(after, viewer, rawDelta.annotation.id)
      if (next) return { kind: 'ANNOTATION_UPSERTED', annotation: structuredClone(next) }
      return prior ? { kind: 'ANNOTATION_REMOVED', annotationId: rawDelta.annotation.id } : null
    }
    case 'ANNOTATION_REMOVED': {
      const prior = visibleAnnotation(before, viewer, rawDelta.annotationId)
      const next = visibleAnnotation(after, viewer, rawDelta.annotationId)
      if (next) return { kind: 'ANNOTATION_UPSERTED', annotation: structuredClone(next) }
      return prior ? { kind: 'ANNOTATION_REMOVED', annotationId: rawDelta.annotationId } : null
    }
    case 'BARRIER_UPSERTED': {
      const prior = projectSceneForViewer(before, viewer).barriers.find(
        (barrier) => barrier.id === rawDelta.barrier.id
      )
      const next = projectSceneForViewer(after, viewer).barriers.find(
        (barrier) => barrier.id === rawDelta.barrier.id
      )
      if (next) return { barrier: structuredClone(next), kind: 'BARRIER_UPSERTED' }
      return prior ? { barrierId: rawDelta.barrier.id, kind: 'BARRIER_REMOVED' } : null
    }
    case 'BARRIER_REMOVED':
      return projectSceneForViewer(before, viewer).barriers.some(
        (barrier) => barrier.id === rawDelta.barrierId
      )
        ? structuredClone(rawDelta)
        : null
    case 'DOOR_STATE_SET':
      return projectSceneForViewer(after, viewer).barriers.some(
        (barrier) => barrier.id === rawDelta.barrierId
      )
        ? structuredClone(rawDelta)
        : null
    case 'LIGHT_UPSERTED': {
      const prior = projectSceneForViewer(before, viewer).lights.find(
        (light) => light.id === rawDelta.light.id
      )
      const next = projectSceneForViewer(after, viewer).lights.find(
        (light) => light.id === rawDelta.light.id
      )
      if (next) return { kind: 'LIGHT_UPSERTED', light: structuredClone(next) }
      return prior ? { kind: 'LIGHT_REMOVED', lightId: rawDelta.light.id } : null
    }
    case 'LIGHT_REMOVED':
      return projectSceneForViewer(before, viewer).lights.some(
        (light) => light.id === rawDelta.lightId
      )
        ? structuredClone(rawDelta)
        : null
    case 'DARKNESS_UPSERTED': {
      const prior = projectSceneForViewer(before, viewer).darknessZones.find(
        (zone) => zone.id === rawDelta.zone.id
      )
      const next = projectSceneForViewer(after, viewer).darknessZones.find(
        (zone) => zone.id === rawDelta.zone.id
      )
      if (next) return { kind: 'DARKNESS_UPSERTED', zone: structuredClone(next) }
      return prior ? { kind: 'DARKNESS_REMOVED', zoneId: rawDelta.zone.id } : null
    }
    case 'DARKNESS_REMOVED':
      return projectSceneForViewer(before, viewer).darknessZones.some(
        (zone) => zone.id === rawDelta.zoneId
      )
        ? structuredClone(rawDelta)
        : null
    case 'FOG_CHUNKS_PATCHED':
      return rawDelta.layer.ownerUserId === null || rawDelta.layer.ownerUserId === viewer.userId
        ? structuredClone(rawDelta)
        : null
    case 'FOG_LAYER_REPLACED':
      return rawDelta.ownerUserId === null || rawDelta.ownerUserId === viewer.userId
        ? structuredClone(rawDelta)
        : null
    default:
      return structuredClone(rawDelta)
  }
}

export function projectSceneDeltaForViewer(
  before: EncounterSceneState,
  after: EncounterSceneState,
  viewer: SceneViewer,
  rawDelta: SceneDelta
): SceneDelta | null {
  if (viewer.role === 'GM') return structuredClone(rawDelta)
  if (rawDelta.kind !== 'BATCH') {
    return projectAtomicSceneDeltaForViewer(before, after, viewer, rawDelta)
  }
  const deltas = rawDelta.deltas.flatMap((delta) => {
    const projected = projectAtomicSceneDeltaForViewer(before, after, viewer, delta)
    return projected ? [projected] : []
  })
  if (deltas.length === 0) return null
  return deltas.length === 1 ? deltas[0]! : { deltas, kind: 'BATCH' }
}
