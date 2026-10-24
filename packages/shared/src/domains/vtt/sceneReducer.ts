import { lengthMeasurementInFeet } from '../core/measurement.js'
import type { CombatPerceptionRange } from './combatPerception.js'
import type {
  CampaignSceneState,
  SceneAtomicDelta,
  SceneActorVision,
  SceneDefinition,
  SceneDelta,
  SceneEvent,
  SceneEntity,
  SceneFogLayer,
  SceneGrid,
  SceneLength,
  ScenePoint,
  SceneSenseLength,
  SceneTokenLight,
  SceneTransientReveal,
  SceneViewer
} from './scene.js'
import {
  FEET_PER_SCENE_UNIT,
  METERS_PER_FOOT,
  sceneFogOwnerKey,
  VTT_SCENE_LIMITS
} from './scene.js'
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

/** Feet in a Scene's distance unit; a SQUARES Scene counts base squares. */
export function feetInSceneUnit(feet: number, unit: SceneGrid['unit']): number {
  return unit === 'METERS' ? feet * METERS_PER_FOOT : feet / FEET_PER_SCENE_UNIT[unit]
}

/** A distance expressed in another Scene unit; a Metres round trip of a whole-foot distance is exact. */
export function convertSceneDistance(
  amount: number,
  from: SceneGrid['unit'],
  to: SceneGrid['unit']
): number {
  const feet = from === 'METERS' ? amount / METERS_PER_FOOT : amount * FEET_PER_SCENE_UNIT[from]
  return feetInSceneUnit(feet, to)
}

/** A typed length in authoritative Scene units. Never negative. */
export function lengthMeasurementInSceneUnits(length: SceneLength, grid: SceneGrid): number {
  return feetInSceneUnit(Math.max(0, lengthMeasurementInFeet(length)), grid.unit)
}

/** A sense's range in Scene units; an unlimited range stays unlimited. */
export function senseRangeInSceneUnits(
  range: SceneSenseLength,
  grid: SceneGrid
): CombatPerceptionRange {
  return range.rangeKind === 'UNLIMITED'
    ? { rangeKind: 'UNLIMITED' }
    : { rangeKind: 'DISTANCE', amount: lengthMeasurementInSceneUnits(range, grid) }
}

/** Converts an authoritative Scene length to feet. */
export function sceneLengthInFeet(amount: number, grid: CampaignSceneState['grid']): number {
  return amount * FEET_PER_SCENE_UNIT[grid.unit]
}

/** The light an actor sheds, in the Scene's units, as its token carries it. */
function sceneTokenLight(
  light: NonNullable<SceneActorVision['light']>,
  grid: CampaignSceneState['grid']
): SceneTokenLight {
  return {
    brightRadius: lengthMeasurementInSceneUnits(light.bright, grid),
    dimRadius: lengthMeasurementInSceneUnits(light.dim, grid)
  }
}
/** Composes the light each bound actor sheds onto its token; other tokens are unchanged. */
export function withSceneTokenLights<T extends Pick<CampaignSceneState, 'tokens' | 'grid'>>(
  state: T,
  tokenLights: readonly { tokenId: string; light: NonNullable<SceneActorVision['light']> }[]
): T {
  if (!tokenLights.length) return state
  const lightByTokenId = new Map(tokenLights.map(({ tokenId, light }) => [tokenId, light]))
  return {
    ...state,
    tokens: state.tokens.map((token) => {
      const light = lightByTokenId.get(token.id)
      return light ? { ...token, light: sceneTokenLight(light, state.grid) } : token
    })
  }
}
/**
 * Presents the bound actor's senses (a Character's or a Creature's) and the light it sheds on its
 * token. An unlimited sense stays unlimited; a ranged sense whose range is empty is dropped.
 */
export function resolveSceneActorVision<T extends Pick<CampaignSceneState, 'tokens' | 'grid'>>(
  state: T,
  bindings: readonly { actorId: string; tokenId: string }[],
  actorVisions: readonly SceneActorVision[]
): T {
  const actorIdByTokenId = new Map(bindings.map((binding) => [binding.tokenId, binding.actorId]))
  const visionByActorId = new Map(actorVisions.map((vision) => [vision.actorId, vision]))
  return {
    ...state,
    tokens: state.tokens.map((token) => {
      const actorId = actorIdByTokenId.get(token.id)
      const actorVision = actorId ? visionByActorId.get(actorId) : undefined
      if (!actorVision) return token
      const { light } = actorVision
      return {
        ...token,
        ...(actorVision.passesBlockingBarriers ? { passesBlockingBarriers: true as const } : {}),
        senses: actorVision.senses.flatMap(({ range, ...sense }) => {
          const sceneRange = senseRangeInSceneUnits(range, state.grid)
          return sceneRange.rangeKind === 'DISTANCE' && sceneRange.amount <= 0
            ? []
            : [{ ...sense, range: sceneRange }]
        }),
        ...(light && { light: sceneTokenLight(light, state.grid) })
      }
    })
  }
}

function sceneAtomicDeltaConflictKey(delta: SceneAtomicDelta): string {
  switch (delta.kind) {
    case 'AMBIENT_ILLUMINATION_SET':
      return 'ENVIRONMENT:AMBIENT_ILLUMINATION'
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
      return `FOG:${sceneFogOwnerKey(delta.layer.ownerUserId)}`
    case 'FOG_LAYER_REPLACED':
      return `FOG:${sceneFogOwnerKey(delta.ownerUserId)}`
    case 'VISION_REVEAL_MODE_SET':
      return 'VISION_REVEAL_MODE'
    case 'FOG_MODE_SET':
      return 'FOG_MODE'
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

export function materializeCampaignScene(
  definition: SceneDefinition,
  sceneId: string
): CampaignSceneState {
  return {
    annotations: definition.annotations.map((annotation) => ({ ...annotation })),
    ambientIllumination: definition.ambientIllumination,
    barriers: definition.barriers.map((barrier) => ({ ...barrier })),
    campaignId: definition.campaignId,
    daylight: definition.daylight,
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
      senses: token.senses.map((sense) => ({ ...sense })),
      vision: token.vision ? { ...token.vision } : null
    })),
    version: 0,
    visionRevealMode: definition.visionRevealMode
  }
}

function applyAtomicDelta(state: CampaignSceneState, delta: SceneAtomicDelta): CampaignSceneState {
  switch (delta.kind) {
    case 'AMBIENT_ILLUMINATION_SET':
      return { ...state, ambientIllumination: delta.illumination, daylight: delta.daylight }
    case 'TOKEN_UPSERTED':
    case 'TOKEN_REMOVED':
    case 'TOKEN_MOVED':
    case 'TOKEN_MOVE_UNDONE':
    case 'DOOR_STATE_SET':
    case 'BARRIER_UPSERTED':
    case 'BARRIER_REMOVED':
      return applySceneGeometryDelta(state, delta)
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
      const key = sceneFogOwnerKey(delta.layer.ownerUserId)
      const index = state.fogLayers.findIndex(
        (layer) => sceneFogOwnerKey(layer.ownerUserId) === key
      )
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
      const key = sceneFogOwnerKey(delta.ownerUserId)
      const remaining = state.fogLayers.filter(
        (layer) => sceneFogOwnerKey(layer.ownerUserId) !== key
      )
      return {
        ...state,
        fogLayers: delta.layer ? [...remaining, structuredClone(delta.layer)] : remaining
      }
    }
    case 'VISION_REVEAL_MODE_SET':
      return { ...state, visionRevealMode: delta.mode }
    case 'FOG_MODE_SET':
      return { ...state, fogMode: delta.mode }
    case 'MEASUREMENT_UPSERTED':
      return { ...state, measurements: upsertById(state.measurements, delta.measurement) }
    case 'MEASUREMENT_REMOVED':
      return { ...state, measurements: removeById(state.measurements, delta.measurementId) }
  }
}

/** Apply geometry only; the caller still validates aggregate limits and commits derived fog. */
export function applySceneGeometryDelta<
  T extends Pick<CampaignSceneState, 'tokens' | 'barriers' | 'doorStates'>
>(
  state: T,
  delta: Extract<
    SceneAtomicDelta,
    {
      kind:
        | 'TOKEN_UPSERTED'
        | 'TOKEN_REMOVED'
        | 'TOKEN_MOVED'
        | 'TOKEN_MOVE_UNDONE'
        | 'DOOR_STATE_SET'
        | 'BARRIER_UPSERTED'
        | 'BARRIER_REMOVED'
    }
  >
): T {
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
  }
}

function assertSceneLimits(state: CampaignSceneState): void {
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

export function applySceneEvent(state: CampaignSceneState, event: SceneEvent): CampaignSceneState {
  if (event.sceneId !== state.id) throw new Error('Scene event targets a different scene.')
  return applySceneDelta(state, event.delta, event.version)
}

export function applySceneDelta(
  state: CampaignSceneState,
  delta: SceneDelta,
  version: number
): CampaignSceneState {
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
  sceneId: string,
  events: readonly SceneEvent[]
): CampaignSceneState {
  return events.reduce(
    (state, event) => applySceneEvent(state, event),
    materializeCampaignScene(definition, sceneId)
  )
}

/** The same privacy predicate serves complete snapshots and independently paged collections. */
export function isSceneEntityVisibleToViewer(
  state: Pick<CampaignSceneState, 'map' | 'fogLayers' | 'fogMode'>,
  viewer: SceneViewer,
  value: SceneEntity
): boolean {
  if (viewer.role === 'GM') return true
  switch (value.collection) {
    case 'annotations':
      return (
        value.entity.visibility === 'TABLE' &&
        isScenePointExplored(state, viewer.userId, value.entity.position)
      )
    case 'barriers':
      return isSceneSegmentExplored(state, viewer.userId, value.entity.a, value.entity.b)
    case 'darknessZones':
      return isScenePolygonExplored(state, viewer.userId, value.entity.polygon)
    case 'lights':
      return isScenePointExplored(state, viewer.userId, value.entity.position)
    case 'measurements':
      return true
    case 'tokens':
      return (
        !value.entity.hidden &&
        (value.entity.controlledByUserIds.includes(viewer.userId) ||
          isScenePointExplored(state, viewer.userId, value.entity.position))
      )
  }
}

/**
 * `boundTokenControl` says whether a player controls each Encounter-bound token (ADR 0034); a token
 * absent from it is unbound and follows the Scene's `controlledByUserIds`.
 */
export function projectSceneForViewer(
  state: CampaignSceneState,
  viewer: SceneViewer,
  boundTokenControl: ReadonlyMap<string, boolean>
): CampaignSceneState {
  if (viewer.role === 'GM') return structuredClone(state)
  const barriers = state.barriers.filter((barrier) =>
    isSceneEntityVisibleToViewer(state, viewer, { collection: 'barriers', entity: barrier })
  )
  const barrierIds = new Set(barriers.map((barrier) => barrier.id))
  return {
    ...structuredClone(state),
    annotations: state.annotations.filter((annotation) =>
      isSceneEntityVisibleToViewer(state, viewer, { collection: 'annotations', entity: annotation })
    ),
    barriers,
    darknessZones: state.darknessZones.filter((zone) =>
      isSceneEntityVisibleToViewer(state, viewer, { collection: 'darknessZones', entity: zone })
    ),
    doorStates: Object.fromEntries(
      Object.entries(state.doorStates).filter(([barrierId]) => barrierIds.has(barrierId))
    ),
    fogLayers: state.fogLayers.filter(
      (layer) => layer.ownerUserId === null || layer.ownerUserId === viewer.userId
    ),
    lights: state.lights.filter((light) =>
      isSceneEntityVisibleToViewer(state, viewer, { collection: 'lights', entity: light })
    ),
    tokens: state.tokens
      .filter((token) =>
        isSceneEntityVisibleToViewer(state, viewer, { collection: 'tokens', entity: token })
      )
      .map((token) => tokenForPlayer(token, viewer, boundTokenControl))
  }
}

/** A player's senses are theirs alone; other tokens show only what is seen of them. */
function tokenForPlayer(
  token: CampaignSceneState['tokens'][number],
  viewer: SceneViewer,
  boundTokenControl: ReadonlyMap<string, boolean>
): CampaignSceneState['tokens'][number] {
  return (boundTokenControl.get(token.id) ?? token.controlledByUserIds.includes(viewer.userId))
    ? token
    : { ...token, senses: [] }
}

/** Build a recipient-specific transient reveal without exposing the complete scene. */
export function projectSceneTokenPreviewForViewer(
  state: CampaignSceneState,
  options: { path: readonly ScenePoint[]; tokenId: string; viewer: SceneViewer }
): { reveal: SceneTransientReveal; visionLayers: SceneFogLayer[] } {
  const visionLayers =
    state.visionRevealMode === 'ON_DROP' ? [] : deriveSceneTokenPreviewFogLayers(state, options)
  if (visionLayers.length === 0)
    return { reveal: { barriers: [], doorStates: {}, tokens: [] }, visionLayers }
  let revealedState = state
  for (const layer of visionLayers) {
    revealedState = applyAtomicDelta(revealedState, { kind: 'FOG_CHUNKS_PATCHED', layer })
  }
  // Only the newly seen tokens of `after` are read, and the reveal never carries senses.
  const before = projectSceneForViewer(state, options.viewer, new Map())
  const after = projectSceneForViewer(revealedState, options.viewer, new Map())
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
  state: CampaignSceneState,
  viewer: SceneViewer,
  tokenId: string
) {
  const token = state.tokens.find((candidate) => candidate.id === tokenId)
  return (
    token !== undefined &&
    isSceneEntityVisibleToViewer(state, viewer, { collection: 'tokens', entity: token })
  )
}

function visibleToken(state: CampaignSceneState, viewer: SceneViewer, tokenId: string) {
  const token = state.tokens.find((candidate) => candidate.id === tokenId)
  return isSceneTokenVisibleToViewer(state, viewer, tokenId) ? token : undefined
}

function visibleAnnotation(state: CampaignSceneState, viewer: SceneViewer, annotationId: string) {
  const annotation = state.annotations.find((candidate) => candidate.id === annotationId)
  return viewer.role === 'GM' ||
    (annotation?.visibility === 'TABLE' &&
      isScenePointExplored(state, viewer.userId, annotation.position))
    ? annotation
    : undefined
}

function projectAtomicSceneDeltaForViewer(
  before: CampaignSceneState,
  after: CampaignSceneState,
  viewer: SceneViewer,
  rawDelta: SceneAtomicDelta,
  boundTokenControl: ReadonlyMap<string, boolean>
): SceneAtomicDelta | null {
  const upserted = (token: CampaignSceneState['tokens'][number]): SceneAtomicDelta => ({
    kind: 'TOKEN_UPSERTED',
    token: structuredClone(tokenForPlayer(token, viewer, boundTokenControl))
  })
  switch (rawDelta.kind) {
    case 'TOKEN_UPSERTED': {
      const prior = visibleToken(before, viewer, rawDelta.token.id)
      const next = visibleToken(after, viewer, rawDelta.token.id)
      if (next) return upserted(next)
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
        return upserted(next)
      }
      if (next) return upserted(next)
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
      const prior = projectSceneForViewer(before, viewer, new Map()).barriers.find(
        (barrier) => barrier.id === rawDelta.barrier.id
      )
      const next = projectSceneForViewer(after, viewer, new Map()).barriers.find(
        (barrier) => barrier.id === rawDelta.barrier.id
      )
      if (next) return { barrier: structuredClone(next), kind: 'BARRIER_UPSERTED' }
      return prior ? { barrierId: rawDelta.barrier.id, kind: 'BARRIER_REMOVED' } : null
    }
    case 'BARRIER_REMOVED':
      return projectSceneForViewer(before, viewer, new Map()).barriers.some(
        (barrier) => barrier.id === rawDelta.barrierId
      )
        ? structuredClone(rawDelta)
        : null
    case 'DOOR_STATE_SET': {
      const barrier = after.barriers.find((candidate) => candidate.id === rawDelta.barrierId)
      return barrier &&
        isSceneEntityVisibleToViewer(after, viewer, { collection: 'barriers', entity: barrier })
        ? structuredClone(rawDelta)
        : null
    }
    case 'LIGHT_UPSERTED': {
      const prior = projectSceneForViewer(before, viewer, new Map()).lights.find(
        (light) => light.id === rawDelta.light.id
      )
      const next = projectSceneForViewer(after, viewer, new Map()).lights.find(
        (light) => light.id === rawDelta.light.id
      )
      if (next) return { kind: 'LIGHT_UPSERTED', light: structuredClone(next) }
      return prior ? { kind: 'LIGHT_REMOVED', lightId: rawDelta.light.id } : null
    }
    case 'LIGHT_REMOVED':
      return projectSceneForViewer(before, viewer, new Map()).lights.some(
        (light) => light.id === rawDelta.lightId
      )
        ? structuredClone(rawDelta)
        : null
    case 'DARKNESS_UPSERTED': {
      const prior = projectSceneForViewer(before, viewer, new Map()).darknessZones.find(
        (zone) => zone.id === rawDelta.zone.id
      )
      const next = projectSceneForViewer(after, viewer, new Map()).darknessZones.find(
        (zone) => zone.id === rawDelta.zone.id
      )
      if (next) return { kind: 'DARKNESS_UPSERTED', zone: structuredClone(next) }
      return prior ? { kind: 'DARKNESS_REMOVED', zoneId: rawDelta.zone.id } : null
    }
    case 'DARKNESS_REMOVED':
      return projectSceneForViewer(before, viewer, new Map()).darknessZones.some(
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
  before: CampaignSceneState,
  after: CampaignSceneState,
  viewer: SceneViewer,
  rawDelta: SceneDelta,
  boundTokenControl: ReadonlyMap<string, boolean>
): SceneDelta | null {
  if (viewer.role === 'GM') return structuredClone(rawDelta)
  if (rawDelta.kind !== 'BATCH') {
    return projectAtomicSceneDeltaForViewer(before, after, viewer, rawDelta, boundTokenControl)
  }
  const deltas = rawDelta.deltas.flatMap((delta) => {
    const projected = projectAtomicSceneDeltaForViewer(
      before,
      after,
      viewer,
      delta,
      boundTokenControl
    )
    return projected ? [projected] : []
  })
  if (deltas.length === 0) return null
  return deltas.length === 1 ? deltas[0]! : { deltas, kind: 'BATCH' }
}
