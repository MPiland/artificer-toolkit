import type { MeasurementUnitCode } from '../core/measurement.js'
import type {
  CombatPerceptionIllumination,
  CombatPerceptionObscurement
} from '../rules/combatPerception.js'

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
  polygonPoints: 2_048,
  tokens: 1_000,
  transientPathPoints: 256
} as const

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

export type SceneGrid =
  | {
      kind: 'SQUARE'
      cellSize: number
      diagonalPolicy: SceneDiagonalPolicy
      distancePerCell: number
      origin: ScenePoint
      unit: SceneDistanceUnit
    }
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

/** Pinned Character-derived vision input retained separately from scene-authored overrides. */
export interface SceneCharacterVision {
  characterId: string
  dimRange: { amount: number; unit: MeasurementUnitCode } | null
}

export interface SceneToken {
  assetId: string | null
  controlledByUserIds: string[]
  height: number
  hidden: boolean
  id: string
  label: string
  locked: boolean
  position: ScenePoint
  rotationDegrees: number
  vision: SceneTokenVision | null
  width: number
}

/** Encounter-local association. It is never persisted on a Campaign Scene token. */
export interface SceneActorTokenBinding {
  actorId: string
  tokenId: string
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
  | { kind: 'AMBIENT_ILLUMINATION_SET'; illumination: CombatPerceptionIllumination }
  | { kind: 'TOKEN_UPSERTED'; token: SceneToken }
  | { kind: 'TOKEN_REMOVED'; tokenId: string }
  | { kind: 'TOKEN_MOVED'; position: ScenePoint; tokenId: string }
  | {
      kind: 'TOKEN_MOVE_UNDONE'
      position: ScenePoint
      tokenId: string
      undoneCommandId: string
    }
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
      kind: 'POINTER_PREVIEW'
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

export interface SceneViewer {
  role: 'GM' | 'PLAYER'
  userId: string
}
