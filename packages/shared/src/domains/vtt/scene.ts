import { AUTHORED_LENGTH_AMOUNT_MAX } from '../../utils/authoringLimits.js'
import {
  LENGTH_UNIT_CODES,
  lengthMeasurementInFeet,
  type LengthUnitCode
} from '../core/measurement.js'
import type {
  CombatPerceptionChannel,
  CombatPerceptionIllumination,
  CombatPerceptionIlluminationAccess,
  CombatPerceptionObscurement,
  CombatPerceptionRange
} from './combatPerception.js'

export const VTT_SCENE_LIMITS = {
  annotations: 1_000,
  barriers: 10_000,
  coordinateMagnitude: 1_000_000,
  darknessZones: 1_000,
  fogCellsPerSide: 512,
  lights: 2_000,
  mapBytes: 25 * 1024 * 1024,
  mapDimension: 8_192,
  mapPixels: 64_000_000,
  measurements: 500,
  /** A member's socket sends at most one ping per interval; the room drops faster pings. */
  pingIntervalMs: 500,
  polygonPoints: 2_048,
  tokens: 1_000,
  transientPathPoints: 256
} as const

/** The System's base square (SRD 5.1: 5 feet): one square on a SQUARES Scene, adjacent on every Scene. */
export const SYSTEM_BASE_SQUARE_FEET = 5

export const METERS_PER_FOOT = 0.3048

export const FEET_PER_SCENE_UNIT: Record<SceneGrid['unit'], number> = {
  FEET: 1,
  METERS: 1 / METERS_PER_FOOT,
  SQUARES: SYSTEM_BASE_SQUARE_FEET
}

/**
 * The largest Scene distance an authored length can reach: the longest authored length at its
 * largest amount, counted in the Scene unit with the fewest feet per unit (a FEET Scene).
 */
export const SCENE_LENGTH_AMOUNT_MAX =
  Math.max(
    ...LENGTH_UNIT_CODES.map((unit) =>
      lengthMeasurementInFeet({ amount: AUTHORED_LENGTH_AMOUNT_MAX, unit })
    )
  ) / Math.min(...Object.values(FEET_PER_SCENE_UNIT))

/** Bounds for pure spatial calculations; persisted coordinates use VTT_SCENE_LIMITS. */
export const VTT_SPATIAL_LIMITS = {
  minimumDistance: 1e-6,
  relativeCoordinateMagnitude: VTT_SCENE_LIMITS.coordinateMagnitude * 2
} as const

export interface ScenePoint {
  x: number
  y: number
}

export interface ScenePolygon {
  points: ScenePoint[]
}

export interface SceneMap {
  assetId: string
  height: number
  tileManifestAssetId: string | null
  width: number
}

export type SceneDistanceUnit = 'FEET' | 'METERS' | 'SQUARES'
export type SceneDiagonalPolicy = 'EQUAL' | 'ALTERNATING' | 'EUCLIDEAN'

interface SquareSceneGrid {
  kind: 'SQUARE'
  cellSize: number
  diagonalPolicy: SceneDiagonalPolicy
  origin: ScenePoint
}

export type SceneGrid =
  | (SquareSceneGrid & { distancePerCell: number; unit: 'FEET' | 'METERS' })
  /** One cell of a Squares grid is one System base square. */
  | (SquareSceneGrid & { distancePerCell: 1; unit: 'SQUARES' })
  | {
      kind: 'GRIDLESS'
      pixelsPerUnit: number
      unit: SceneDistanceUnit
    }

export interface SceneTokenVision {
  angleDegrees: number
  brightRange: number
  dimRange: number
  directionDegrees: number
  enabled: boolean
}

/**
 * A sense a token presents to its controllers; its range is in Scene units from the token
 * footprint edge, or unlimited.
 */
export interface SceneTokenSense {
  channel: CombatPerceptionChannel
  illuminationAccess: CombatPerceptionIlluminationAccess
  label: string
  range: CombatPerceptionRange
  /** The pinned sense definition id. */
  senseId: string
}

/** A typed length until a Scene grid converts it. */
export type SceneLength = { amount: number; unit: LengthUnitCode }

/** A sense's reach as a typed length (or unlimited) until a Scene grid converts it. */
export type SceneSenseLength =
  | { rangeKind: 'UNLIMITED' }
  | { rangeKind: 'DISTANCE'; amount: number; unit: LengthUnitCode }

/** An Encounter actor's pinned senses, ranged as typed lengths until a Scene grid converts them. */
export interface SceneActorVision {
  actorId: string
  senses: (Omit<SceneTokenSense, 'range'> & { range: SceneSenseLength })[]
  /** The actor's resolved movement passage takes it through blocking barriers. */
  passesBlockingBarriers?: true
  /** The light the actor sheds; dim is the outer radius. Absent when it sheds none. */
  light?: { bright: SceneLength; dim: SceneLength }
}

/** Light a token sheds, in Scene units measured from its footprint edge; dim is the outer radius. */
export interface SceneTokenLight {
  brightRadius: number
  dimRadius: number
}

export interface SceneToken {
  assetId: string | null
  /** The assigned Campaign Character this token represents; its controllers move it outside an Encounter (D162). */
  characterId?: string
  controlledByUserIds: string[]
  height: number
  hidden: boolean
  id: string
  label: string
  locked: boolean
  position: ScenePoint
  rotationDegrees: number
  /** Composed from the bound Encounter actor at runtime; only the token's controllers receive it. */
  senses: SceneTokenSense[]
  /**
   * Composed from the bound Encounter actor's resolved movement passage: its moves are not stopped
   * by blocking barriers. The server resolves the mover's passage again from the facts it settles with.
   */
  passesBlockingBarriers?: true
  /** Composed from the bound Encounter actor at runtime and never stored. */
  light?: SceneTokenLight
  vision: SceneTokenVision | null
  width: number
}

interface SceneBarrierBase {
  a: ScenePoint
  b: ScenePoint
  id: string
}

export type SceneBarrier =
  | (SceneBarrierBase & {
      kind: 'WALL'
      blocksLight: boolean
      blocksMovement: boolean
    })
  | (SceneBarrierBase & {
      kind: 'DOOR'
      blocksLightWhenClosed: boolean
      blocksMovementWhenClosed: boolean
      initialState: SceneDoorState
      openAngleDegrees: number
    })
  | (SceneBarrierBase & {
      kind: 'WINDOW'
      blocksLight: boolean
      blocksMovement: boolean
    })
  | (SceneBarrierBase & {
      kind: 'ONE_WAY'
      blocksLight: boolean
      blocksMovement: boolean
      blockedDirection: 'LEFT_TO_RIGHT' | 'RIGHT_TO_LEFT'
    })
  | (SceneBarrierBase & {
      kind: 'TERRAIN'
      movementCostMultiplier: number
    })

export type SceneDoorState = 'OPEN' | 'CLOSED' | 'LOCKED'

interface SceneLightBase {
  brightRadius: number
  color: string
  dimRadius: number
  id: string
  intensity: number
  position: ScenePoint
}

export type SceneLight =
  | (SceneLightBase & { kind: 'POINT' })
  | (SceneLightBase & {
      kind: 'CONE'
      angleDegrees: number
      directionDegrees: number
    })

export interface SceneDarknessZone {
  id: string
  mechanicalIllumination: Exclude<CombatPerceptionIllumination, 'BRIGHT'> | null
  mechanicalObscurement: Exclude<CombatPerceptionObscurement, 'NONE'> | null
  opacity: number
  polygon: ScenePolygon
}

export interface SceneAnnotation {
  id: string
  position: ScenePoint
  text: string
  visibility: 'GM_ONLY' | 'TABLE'
}

/** OFF shows players every non-hidden Scene object; the other modes use explored fog layers. */
export type SceneFogMode = 'OFF' | 'SHARED_PARTY' | 'PER_PLAYER'
export type SceneVisionRevealMode = 'ON_DRAG' | 'ON_DROP'

export type SceneEntity =
  | { collection: 'annotations'; entity: SceneAnnotation }
  | { collection: 'barriers'; entity: SceneBarrier }
  | { collection: 'darknessZones'; entity: SceneDarknessZone }
  | { collection: 'lights'; entity: SceneLight }
  | { collection: 'measurements'; entity: SceneMeasurement }
  | { collection: 'tokens'; entity: SceneToken }

export interface SceneDefinition {
  annotations: SceneAnnotation[]
  ambientIllumination: CombatPerceptionIllumination
  barriers: SceneBarrier[]
  campaignId: string
  daylight: boolean
  darknessZones: SceneDarknessZone[]
  fogMode: SceneFogMode
  grid: SceneGrid
  id: string
  lights: SceneLight[]
  map: SceneMap
  name: string
  tokens: SceneToken[]
  version: number
  visionRevealMode: SceneVisionRevealMode
}

export interface SceneFogChunk {
  data: string
  height: number
  index: number
  width: number
  x: number
  y: number
}

export interface SceneFogLayer {
  chunks: SceneFogChunk[]
  height: number
  ownerUserId: string | null
  width: number
}

/** Private, ephemeral objects newly exposed by a validated token-vision preview. */
export interface SceneTransientReveal {
  barriers: SceneBarrier[]
  doorStates: Record<string, SceneDoorState>
  tokens: SceneToken[]
}

export interface SceneMeasurement {
  createdByUserId: string
  id: string
  label: string | null
  path: ScenePoint[]
}

export interface CampaignSceneState {
  annotations: SceneAnnotation[]
  ambientIllumination: CombatPerceptionIllumination
  barriers: SceneBarrier[]
  campaignId: string
  daylight: boolean
  darknessZones: SceneDarknessZone[]
  definitionId: string
  definitionVersion: number
  doorStates: Record<string, SceneDoorState>
  fogLayers: SceneFogLayer[]
  fogMode: SceneFogMode
  grid: SceneGrid
  id: string
  lights: SceneLight[]
  map: SceneMap
  measurements: SceneMeasurement[]
  name: string
  tokens: SceneToken[]
  version: number
  visionRevealMode: SceneVisionRevealMode
}

export type SceneAtomicDelta =
  | {
      kind: 'AMBIENT_ILLUMINATION_SET'
      daylight: boolean
      illumination: CombatPerceptionIllumination
    }
  | { kind: 'TOKEN_UPSERTED'; token: SceneToken }
  | { kind: 'TOKEN_REMOVED'; tokenId: string }
  /** `rotationDegrees` is the facing a move ended in, when the Encounter's Facing rule asked for one. */
  | { kind: 'TOKEN_MOVED'; position: ScenePoint; rotationDegrees?: number; tokenId: string }
  | {
      kind: 'TOKEN_MOVE_UNDONE'
      position: ScenePoint
      rotationDegrees?: number
      tokenId: string
      undoneCommandId: string
    }
  | { kind: 'TOKEN_FACING_SET'; rotationDegrees: number; tokenId: string }
  | { kind: 'DOOR_STATE_SET'; barrierId: string; state: SceneDoorState }
  | { kind: 'BARRIER_UPSERTED'; barrier: SceneBarrier }
  | { kind: 'BARRIER_REMOVED'; barrierId: string }
  | { kind: 'LIGHT_UPSERTED'; light: SceneLight }
  | { kind: 'LIGHT_REMOVED'; lightId: string }
  | { kind: 'DARKNESS_UPSERTED'; zone: SceneDarknessZone }
  | { kind: 'DARKNESS_REMOVED'; zoneId: string }
  | { kind: 'ANNOTATION_UPSERTED'; annotation: SceneAnnotation }
  | { kind: 'ANNOTATION_REMOVED'; annotationId: string }
  | { kind: 'FOG_CHUNKS_PATCHED'; layer: SceneFogLayer }
  | {
      kind: 'FOG_LAYER_REPLACED'
      layer: SceneFogLayer | null
      ownerUserId: string | null
    }
  | { kind: 'VISION_REVEAL_MODE_SET'; mode: SceneVisionRevealMode }
  | { kind: 'FOG_MODE_SET'; mode: SceneFogMode }
  | { kind: 'MEASUREMENT_UPSERTED'; measurement: SceneMeasurement }
  | { kind: 'MEASUREMENT_REMOVED'; measurementId: string }

export type SceneDelta = SceneAtomicDelta | { deltas: SceneAtomicDelta[]; kind: 'BATCH' }

export interface SceneEvent {
  actorUserId: string
  commandId: string
  delta: SceneDelta
  sceneId: string
  version: number
}

/** Who receives a live preview: the whole table, or only the Campaign owner (GM). */
export type SceneTransientAudience = 'GM' | 'TABLE'

export type SceneTransientEnvelope =
  | {
      audience: SceneTransientAudience
      baselineVersion: number
      kind: 'TOKEN_DRAG_PREVIEW'
      position: ScenePoint
      previewUserId?: string
      sceneId: string
      sequence: number
      tokenId: string
    }
  | {
      audience: SceneTransientAudience
      baselineVersion: number
      /** One "look here" at a map point from a long press or the ping key (Q19); never a stream. */
      kind: 'PING'
      position: ScenePoint
      sceneId: string
      sequence: number
    }
  | {
      audience: SceneTransientAudience
      baselineVersion: number
      kind: 'MEASUREMENT_PREVIEW'
      path: ScenePoint[]
      sceneId: string
      sequence: number
    }
  | {
      audience: SceneTransientAudience
      baselineVersion: number
      explored: boolean
      kind: 'FOG_AREA_PREVIEW'
      ownerUserId: string | null
      rectangle: { a: ScenePoint; b: ScenePoint }
      sceneId: string
      sequence: number
    }

/** A fog layer's owner identity: the owning player's user id, or the shared party layer (null). */
export function sceneFogOwnerKey(ownerUserId: string | null): string {
  return ownerUserId ?? 'SHARED_PARTY'
}

/** A live preview stream as the room and its clients key it: per kind, dragged token and fog owner. */
export function sceneTransientStreamKey(envelope: SceneTransientEnvelope): string {
  if (envelope.kind === 'TOKEN_DRAG_PREVIEW') return `${envelope.kind}:${envelope.tokenId}`
  if (envelope.kind === 'FOG_AREA_PREVIEW')
    return `${envelope.kind}:${sceneFogOwnerKey(envelope.ownerUserId)}`
  return envelope.kind
}

export interface SceneViewer {
  role: 'GM' | 'PLAYER'
  userId: string
}
