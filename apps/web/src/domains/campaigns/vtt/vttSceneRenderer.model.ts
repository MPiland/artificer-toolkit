import type { SignedVttMapDeliveryDto } from '@artificer-toolkit/schema/api/media'
import type { EncounterActionChoiceDto } from '@artificer-toolkit/schema/api/encounterActionChoices'
import type { EncounterSessionStateDto } from '@artificer-toolkit/schema/api/encounterData'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { SpatialGeometryDto } from '@artificer-toolkit/schema/shared/spatial'
import {
  canMoveBetween,
  directedAreaOutline,
  isDirectedAreaOriginOnToken,
  isDirectedAreaShape,
  measureScenePathDistance,
  measureScenePathMovementCost,
  nearestFootprintEdgePoint,
  pointCubeOutline,
  requireSceneIlluminationLevel,
  SceneBarrierIndex,
  sceneDistanceAsCoordinateLength,
  scenePointInPolygon,
  sceneRangeBand,
  sceneRangeOutline,
  sceneLightLevels,
  spatialSegmentShareInside,
  type FacingArcSector,
  type SceneGrid,
  type SceneIlluminationLevel,
  type SceneIlluminationRenderClass,
  type ScenePoint,
  type SceneTokenSense,
  type SpatialAreaShape,
  type SpatialDirectedAreaSize,
  type SpatialPointAreaShape,
  type SpatialTokenFootprint,
  type SpatialWallSide,
  wallOutline,
  wallSideBandGeometry,
  zoneMovementSegmentMultiplier
} from '@artificer-toolkit/shared/vtt'

const unexploredOpacity = 224
const maximumGridLines = 2_048
const transientInterpolationRatePerSecond = 14
const transientInterpolationSnapDistance = 0.25
export const minimumVttZoomScale = 0.02
export const maximumVttZoomScale = 8

interface VttFogMask {
  height: number
  opacity: Uint8ClampedArray
  width: number
}

interface VttMapReloadState {
  assetKey: string | null
  credentialKey: string | null
  layerEmpty: boolean
  loadComplete: boolean
}

type VttMapLoadDecision = 'LOAD_MISSING' | 'NONE' | 'RESET'

interface VttMapLoadDecisionInput {
  currentAssetKey: string | null
  loadedPartIds: readonly string[]
  nextAssetKey: string | null
  requiredPartIds: readonly string[]
}

interface VttSceneTokenDragState {
  appearanceKey: string
  origin: ScenePoint
  tokenId: string
}

export interface VttSceneTokenDragUpdate {
  /**
   * Token id to whether the viewer controls the Encounter actor bound to it. Bound tokens follow the
   * actor's controllers; only unbound tokens use the Scene token's own controllers.
   */
  boundTokenControl: ReadonlyMap<string, boolean>
  currentUserId: string
  mode: 'EDIT' | 'PLAY'
  role: 'OWNER' | 'PLAYER'
  scene: CampaignSceneStateDto
  tokenPresentations?: Readonly<Record<string, VttTokenPresentation>>
  tool: string
}

/** How a status reads on the ring: a grant's derived polarity, Concentration, or neither. */
export type VttStatusCategory = 'CONCENTRATION' | 'HARMFUL' | 'BENEFICIAL' | 'OTHER'

/** The most segments the outer ring draws; beyond it the last segment marks the overflow. */
export const maxStatusSegments = 8
export const statusCategoryColours: Record<VttStatusCategory, number> = {
  CONCENTRATION: 0x20c997,
  HARMFUL: 0xffd43b,
  BENEFICIAL: 0x94d82d,
  OTHER: 0xced4da
}
export const statusOverflowColour = 0xffffff
/** Workshop Teal (DESIGN.md): technical selection. */
export const selectionOutlineColor = 0x0891b2
/** The front arc is safe ground, the sides are caution and the rear is where an attack gains the edge. */
export const facingArcColours: Record<FacingArcSector['arc'], number> = {
  FRONT: 0x22b8cf,
  LEFT_SIDE: 0xfab005,
  REAR: 0xff6b6b,
  RIGHT_SIDE: 0xfab005
}

export interface VttTokenPresentation {
  accessibleDescription: string
  artUrl: string | null
  /** The disposition ring's name, so the ring's colour is never the only cue. */
  dispositionLabel: string | null
  /** Draws the token's facing: it is an Encounter creature while the Facing rule is active. */
  facing: boolean
  /**
   * The Facing rule's arcs around the selected or current-turn token, as the Scene bearings each
   * covers; null when they are not drawn.
   */
  facingArcs: FacingArcSector[] | null
  fillColor: number
  halo: { color: number; label: string } | null
  marked: boolean
  outlineColor: number
  /** The creature can be picked on the map while the caster targets (ATTACK-17.1). */
  targetable: boolean
  statuses: Array<{
    category: VttStatusCategory
    id: string
    kind:
      | 'CONCENTRATION'
      | 'CONDITION'
      | 'COVER'
      | 'EFFECT'
      | 'HEALTH'
      | 'INJURY'
      | 'LOOT'
      | 'MORALE'
      | 'REACTION'
    label: string
    /** The System's description of a condition, shown on hover. */
    description?: string
  }>
}

export type VttScenePresentationOverlay =
  | {
      color: number
      id: string
      kind: 'CIRCLE'
      label: string
      purpose: 'AURA' | 'RANGE' | 'TARGET'
      center: ScenePoint
      radius: number
    }
  | {
      color: number
      id: string
      kind: 'PATH'
      label: string
      purpose: 'PATH'
      points: ScenePoint[]
    }
  | {
      color: number
      id: string
      kind: 'POLYGON'
      label: string
      purpose: 'AURA' | 'RANGE' | 'TARGET' | 'TRAP'
      points: ScenePoint[]
    }

const pointAreaColor = 0xe8590c
const areaBandColor = 0xfab005

/**
 * Where the caster aimed an area: a point area's center, or a directed area's origin on their
 * token's edge and the point it extends toward (null until it is aimed, and for a point area).
 */
export interface VttAreaAim {
  origin: ScenePoint
  toward: ScenePoint | null
}

/**
 * A zone's wall the caster draws (D154): a straight wall from one endpoint to the other, at most
 * `maximum` long, or a ring around its center whose outer radius is at most `maximum` and more than
 * `thickness`.
 */
interface VttDrawnAreaSize {
  kind: 'WALL' | 'RING'
  maximum: number
  thickness: number
  /** The band beside the wall the zone also reaches (D154), once the caster picks its side. */
  band?: { distance: number; side: SpatialWallSide }
}

/** The selected action's area in Scene coordinates, before it is aimed. */
export type VttAreaSize = SpatialPointAreaShape | SpatialDirectedAreaSize | VttDrawnAreaSize

/** A pick limited to legal squares (D157): footprints of one size, each centred on one point. */
export interface VttSquarePick {
  centers: readonly ScenePoint[]
  width: number
  height: number
}

/** The centre of the legal square `point` lies in, nearest first; null outside every one. */
export function pickedSquare(pick: VttSquarePick, point: ScenePoint): ScenePoint | null {
  const distance = (center: ScenePoint) => Math.hypot(center.x - point.x, center.y - point.y)
  return (
    pick.centers
      .filter(
        (center) =>
          Math.abs(center.x - point.x) <= pick.width / 2 &&
          Math.abs(center.y - point.y) <= pick.height / 2
      )
      .sort((left, right) => distance(left) - distance(right))[0] ?? null
  )
}

export function isDrawnAreaSize(size: VttAreaSize): size is VttDrawnAreaSize {
  return size.kind === 'WALL' || size.kind === 'RING'
}

/** The area `aim` places: null for a directed or drawn area that has no direction yet. */
export function aimedAreaShape(size: VttAreaSize, aim: VttAreaAim): SpatialAreaShape | null {
  if (isDrawnAreaSize(size)) {
    if (!aim.toward) return null
    if (size.kind === 'WALL') return { kind: 'WALL', to: aim.toward, thickness: size.thickness }
    const outerRadius = Math.hypot(aim.toward.x - aim.origin.x, aim.toward.y - aim.origin.y)
    return { kind: 'RING', outerRadius, innerRadius: outerRadius - size.thickness }
  }
  if (!isDirectedAreaShape(size)) return size
  return aim.toward ? { ...size, toward: aim.toward } : null
}

/**
 * The wall or ring drawn from the press toward the pointer, its far point pulled in to the largest
 * size the rules accept. Null for a wall of no length or a ring no wider than its thickness.
 */
export function drawnAreaAim({
  pointer,
  pressedAt,
  size
}: {
  pointer: ScenePoint
  pressedAt: ScenePoint
  size: VttDrawnAreaSize
}): { origin: ScenePoint; toward: ScenePoint } | null {
  const length = Math.hypot(pointer.x - pressedAt.x, pointer.y - pressedAt.y)
  if (length === 0 || (size.kind === 'RING' && length <= size.thickness)) return null
  const scale = Math.min(1, size.maximum / length)
  return {
    origin: pressedAt,
    toward: {
      x: pressedAt.x + (pointer.x - pressedAt.x) * scale,
      y: pressedAt.y + (pointer.y - pressedAt.y) * scale
    }
  }
}

/**
 * The overlay for an area aimed at `aim`: a circle for a radius, a square for a point cube, and for a
 * directed area the polygon the rules catch creatures with (`directedAreaOutline`) from `caster`'s
 * space. Null when a directed area has no direction or no caster.
 */
export function areaOverlay(
  size: VttAreaSize,
  aim: VttAreaAim,
  caster: SpatialTokenFootprint | null
): VttScenePresentationOverlay | null {
  const shape = aimedAreaShape(size, aim)
  if (!shape) return null
  // A ring is drawn by its outer edge.
  if (shape.kind === 'RADIUS' || shape.kind === 'RING') {
    return {
      center: aim.origin,
      color: pointAreaColor,
      id: 'area-origin',
      kind: 'CIRCLE',
      label: 'Area origin',
      purpose: 'TARGET',
      radius: shape.kind === 'RADIUS' ? shape.radius : shape.outerRadius
    }
  }
  const points =
    shape.kind === 'CUBE'
      ? pointCubeOutline(aim.origin, shape.edgeLength)
      : shape.kind === 'WALL'
        ? wallOutline(aim.origin, shape.to, shape.thickness)
        : caster && directedAreaOutline(aim.origin, shape, caster)
  return points
    ? {
        color: pointAreaColor,
        id: 'area-origin',
        kind: 'POLYGON',
        label: 'Area origin',
        points,
        purpose: 'TARGET'
      }
    : null
}

/**
 * The band a drawn zone also reaches on the side the caster picked: the polygon beside a wall, or a
 * ring's band drawn by its edge away from the wall. Null before a side is picked.
 */
export function areaBandOverlay(
  size: VttAreaSize,
  aim: VttAreaAim
): VttScenePresentationOverlay | null {
  if (!isDrawnAreaSize(size) || !size.band) return null
  const shape = aimedAreaShape(size, aim)
  if (shape?.kind !== 'WALL' && shape?.kind !== 'RING') return null
  const band = wallSideBandGeometry(aim.origin, shape, size.band.side, size.band.distance)
  if (!band) return null
  const overlay = {
    color: areaBandColor,
    id: 'area-band',
    label: 'Area band',
    purpose: 'TARGET' as const
  }
  if (band.kind === 'POLYGON') return { ...overlay, kind: 'POLYGON', points: [...band.points] }
  const radius =
    band.kind === 'CIRCLE'
      ? band.radius
      : size.band.side === 'OUTSIDE'
        ? band.outerRadius
        : band.innerRadius
  return { ...overlay, kind: 'CIRCLE', center: band.center, radius }
}

/**
 * The directed area the pointer aims. The origin is the point on the caster's footprint edge nearest
 * where the press began (the pointer, before a press), and the area extends toward the pointer. Null
 * unless the rules would accept that origin for that direction, so a preview or a pick the rules
 * would refuse never shows.
 */
export function directedAreaAim({
  caster,
  pointer,
  pressedAt,
  size
}: {
  caster: SpatialTokenFootprint
  pointer: ScenePoint
  pressedAt: ScenePoint | null
  size: SpatialDirectedAreaSize
}): { origin: ScenePoint; toward: ScenePoint } | null {
  const origin = nearestFootprintEdgePoint(caster, pressedAt ?? pointer)
  return isDirectedAreaOriginOnToken({ token: caster, origin, shape: { ...size, toward: pointer } })
    ? { origin, toward: pointer }
    : null
}
/** The chosen action's range and target as the stage previews them while the drawer is picking. */
export interface VttActionPreview {
  range: EncounterActionChoiceDto['range']
  sourceTokenId: string
  targetTokenId: string | null
}

const rangeColor = 0x0891b2
const targetColor = 0x1c7ed6
/** Scene pixels the target ring clears the token's footprint by. */
const targetRingMargin = 6
const targetRingBands = {
  LONG: { color: 0xf08c00, label: 'Target in long range' },
  NORMAL: { color: 0x2f9e44, label: 'Target in range' },
  OUT: { color: 0xe03131, label: 'Target out of range' }
} as const

type ActionPreviewScene = Pick<CampaignSceneStateDto, 'grid' | 'tokens'>
type ActionPreviewLength = Extract<
  NonNullable<VttActionPreview['range']>,
  { kind: 'WITHIN' }
>['distance']

/** An action's normal reach, then its long reach when it has one; empty for SELF, UNLIMITED and none. */
export function actionRangeLengths(range: VttActionPreview['range']): ActionPreviewLength[] {
  return range?.kind === 'WITHIN'
    ? [range.distance]
    : range?.kind === 'RANGED'
      ? [range.normal, range.long]
      : []
}

let rangeOutlinesMemo: { key: string; overlays: VttScenePresentationOverlay[] } | null = null

/**
 * The RANGE outlines of an acting token. The stage rebuilds its overlays on every Scene update,
 * but the outlines depend only on the token's footprint, the grid and the range, so the last
 * result is reused for an equal key (a target change or another token's move builds nothing).
 */
function rangeOutlineOverlays(
  grid: SceneGrid,
  source: ActionPreviewScene['tokens'][number],
  distances: readonly ActionPreviewLength[]
): VttScenePresentationOverlay[] {
  const key = JSON.stringify([grid, distances, source.position, source.width, source.height])
  if (rangeOutlinesMemo?.key !== key)
    rangeOutlinesMemo = {
      key,
      overlays: distances.flatMap((distance, index) => {
        const points = distance.scaling === undefined && sceneRangeOutline(grid, source, distance)
        return points
          ? [
              {
                color: rangeColor,
                id: `action-range-${index}`,
                kind: 'POLYGON' as const,
                label: index === 0 ? 'Action range' : 'Action long range',
                points,
                purpose: 'RANGE' as const
              }
            ]
          : []
      })
    }
  return rangeOutlinesMemo.overlays
}

/**
 * The RANGE outlines around the acting token and the TARGET ring around the chosen target, in Scene
 * coordinates. Both come from the shared range functions the rules judge a target with, so the
 * outline is the region the server accepts and the ring's color and label say whether the target
 * is in range, in long range or out of range. SELF, UNLIMITED and scaled ranges draw no outline and
 * leave the ring neutral.
 */
export function actionPreviewOverlays(
  preview: VttActionPreview | null,
  scene: ActionPreviewScene
): VttScenePresentationOverlay[] {
  if (!preview) return []
  const overlays: VttScenePresentationOverlay[] = []
  const source = scene.tokens.find((token) => token.id === preview.sourceTokenId)
  const distances = actionRangeLengths(preview.range)
  if (source) overlays.push(...rangeOutlineOverlays(scene.grid, source, distances))
  const target = scene.tokens.find((token) => token.id === preview.targetTokenId)
  if (target) {
    const [normal, long] = distances
    const measurable = source && normal && distances.every(({ scaling }) => scaling === undefined)
    const band = measurable
      ? targetRingBands[sceneRangeBand(scene.grid, source, target, { long, normal })]
      : { color: targetColor, label: 'Action target' }
    overlays.push({
      center: target.position,
      color: band.color,
      id: 'action-target',
      kind: 'CIRCLE',
      label: band.label,
      purpose: 'TARGET',
      radius: Math.max(target.width, target.height) / 2 + targetRingMargin
    })
  }
  return overlays
}

/**
 * The overlays the stage hands the renderer: the action preview while the drawer is open (including
 * while the caster aims an area's center) plus the picked area once it is no longer being aimed.
 */
export function stageOverlays({
  actionPreview,
  aimingArea,
  areaAim,
  areaSize,
  drawerOpened,
  scene
}: {
  actionPreview: VttActionPreview | null
  aimingArea: boolean
  areaAim: VttAreaAim | null
  areaSize: VttAreaSize | null
  drawerOpened: boolean
  scene: Pick<CampaignSceneStateDto, 'grid' | 'tokens'> | null
}): VttScenePresentationOverlay[] | undefined {
  // A directed area is drawn from the token the action is previewed for.
  const caster = scene?.tokens.find((token) => token.id === actionPreview?.sourceTokenId) ?? null
  const picked = areaSize && areaAim && !aimingArea ? areaOverlay(areaSize, areaAim, caster) : null
  const band = picked && areaSize && areaAim ? areaBandOverlay(areaSize, areaAim) : null
  const overlays = [
    ...(drawerOpened && scene ? actionPreviewOverlays(actionPreview, scene) : []),
    ...(picked ? [picked] : []),
    ...(band ? [band] : [])
  ]
  return overlays.length > 0 ? overlays : undefined
}

type VttMapTilePlacement = SignedVttMapDeliveryDto['tiles'][number] & {
  x: number
  y: number
}

export function buildVttFogMask(
  scene: Pick<CampaignSceneStateDto, 'fogLayers' | 'fogMode'>,
  hideUnexploredWithoutLayer = false
): VttFogMask | null {
  // Layers kept while fog is OFF stay stored for a later fog mode but are never drawn.
  if (scene.fogMode === 'OFF') return null
  if (scene.fogLayers.length === 0) {
    return hideUnexploredWithoutLayer
      ? { height: 1, opacity: new Uint8ClampedArray([unexploredOpacity]), width: 1 }
      : null
  }
  const width = Math.max(...scene.fogLayers.map((layer) => layer.width))
  const height = Math.max(...scene.fogLayers.map((layer) => layer.height))
  const opacity = new Uint8ClampedArray(width * height)
  opacity.fill(unexploredOpacity)

  for (const layer of scene.fogLayers) {
    for (const chunk of layer.chunks) {
      const bytes = decodeBase64(chunk.data)
      for (let localY = 0; localY < chunk.height; localY += 1) {
        for (let localX = 0; localX < chunk.width; localX += 1) {
          const bitIndex = localY * chunk.width + localX
          if ((bytes[Math.floor(bitIndex / 8)]! & (1 << (bitIndex % 8))) === 0) continue
          revealFogCell(
            opacity,
            width,
            height,
            layer.width,
            layer.height,
            chunk.x + localX,
            chunk.y + localY
          )
        }
      }
    }
  }
  return { height, opacity, width }
}

export function formatSceneMeasurement(grid: SceneGrid, path: readonly ScenePoint[]): string {
  return formatSceneDistance(grid, measureScenePathDistance(grid, path))
}

/** A concealed zone the GM's route names, with the labels of the creatures that have not noticed it. */
export type UnnoticedZone = { label: string | null; shape: SpatialGeometryDto; by: string[] }

/** Whether a token's footprint passes through a zone anywhere on its path. */
export function pathEntersZone(
  shape: SpatialGeometryDto,
  path: readonly ScenePoint[],
  token: SpatialTokenFootprint
): boolean {
  return path
    .slice(1)
    .some(
      (to, index) =>
        spatialSegmentShareInside({ geometries: [shape], token, from: path[index]!, to }) > 0
    )
}

/**
 * A dragged token's route: its distance and, for an Encounter mover whose terrain, a zone that
 * slows it or a creature it drags makes the walk dearer, the movement it costs, priced as the room
 * charges it (D105, D154, D156). The GM's route then names, for each concealed zone it enters,
 * the creatures that have not noticed it (MOVE-3.6).
 */
export function formatSceneRoute(
  scene: CampaignSceneStateDto,
  path: readonly ScenePoint[],
  mover: {
    actorId: string
    tokenId: string
    zones: EncounterSessionStateDto['movementCostZones']
    /** The mover drags a creature not two sizes smaller (D105). */
    dragDoublesCost: boolean
    /** The GM's concealed zones; a player's route names none. */
    unnoticedZones?: readonly UnnoticedZone[]
  } | null
): string {
  const distance = measureScenePathDistance(scene.grid, path)
  const cost =
    mover &&
    measureScenePathMovementCost(
      scene.grid,
      scene,
      path,
      zoneMovementSegmentMultiplier({
        zones: mover.zones,
        mover,
        tokens: scene.tokens,
        dragDoublesCost: mover.dragDoublesCost
      })
    )
  const token = mover && scene.tokens.find(({ id }) => id === mover.tokenId)
  const unnoticed =
    mover && token
      ? (mover.unnoticedZones ?? [])
          .filter(({ shape }) => pathEntersZone(shape, path, token))
          .map(({ label, by }) => ` · ${label ?? 'Hidden zone'} not noticed by ${by.join(', ')}`)
      : []
  return (
    (cost && cost > distance
      ? `${formatSceneDistance(scene.grid, distance)} · costs ${formatSceneDistance(scene.grid, cost)}`
      : formatSceneDistance(scene.grid, distance)) + unnoticed.join('')
  )
}

/** A distance in the Scene's grid units, with the unit's short name. */
export function formatSceneDistance(grid: SceneGrid, distance: number): string {
  const formatted = Number.isInteger(distance) ? String(distance) : distance.toFixed(1)
  const unit = grid.unit === 'FEET' ? 'ft' : grid.unit === 'METERS' ? 'm' : 'squares'
  return `${formatted} ${unit}`
}

export function resolveSceneTokenMove(
  scene: CampaignSceneStateDto,
  token: CampaignSceneStateDto['tokens'][number],
  from: ScenePoint,
  requested: ScenePoint,
  barrierIndex = new SceneBarrierIndex(scene.barriers)
): ScenePoint {
  const halfWidth = token.width / 2
  const halfHeight = token.height / 2
  const position = {
    x: Math.min(scene.map.width - halfWidth, Math.max(halfWidth, requested.x)),
    y: Math.min(scene.map.height - halfHeight, Math.max(halfHeight, requested.y))
  }
  return canMoveBetween(scene, from, position, barrierIndex) ? position : from
}

export function sceneTokenAppearanceKey(
  token: CampaignSceneStateDto['tokens'][number],
  presentation?: VttTokenPresentation
): string {
  return [
    token.assetId,
    token.controlledByUserIds.join(','),
    token.height,
    token.hidden,
    token.label,
    token.locked,
    token.rotationDegrees,
    token.width,
    presentation?.artUrl,
    presentation?.facing,
    presentation?.facingArcs?.map((sector) => `${sector.arc}@${sector.fromBearing}`).join(','),
    presentation?.fillColor,
    presentation?.halo?.color,
    presentation?.marked,
    presentation?.outlineColor,
    presentation?.targetable,
    presentation?.statuses.map((status) => `${status.id}:${status.label}:${status.kind}`).join(',')
  ].join(':')
}

export function canPreserveSceneTokenDrag(
  previous: VttSceneTokenDragUpdate,
  next: VttSceneTokenDragUpdate,
  drag: VttSceneTokenDragState
): boolean {
  if (
    previous.scene.id !== next.scene.id ||
    previous.mode !== next.mode ||
    previous.tool !== 'SELECT' ||
    next.tool !== 'SELECT' ||
    previous.role !== next.role ||
    previous.currentUserId !== next.currentUserId
  ) {
    return false
  }
  const token = next.scene.tokens.find((candidate) => candidate.id === drag.tokenId)
  if (!token || token.locked || !canControlSceneToken(token, next)) return false
  if (!pointsEqual(token.position, drag.origin)) return false
  return sceneTokenAppearanceKey(token, next.tokenPresentations?.[token.id]) === drag.appearanceKey
}

export function interpolateScenePoint(
  current: ScenePoint,
  target: ScenePoint,
  elapsedMs: number
): void {
  const elapsedSeconds = Math.max(0, elapsedMs) / 1_000
  const progress = 1 - Math.exp(-transientInterpolationRatePerSecond * elapsedSeconds)
  const x = current.x + (target.x - current.x) * progress
  const y = current.y + (target.y - current.y) * progress
  if (Math.hypot(target.x - x, target.y - y) <= transientInterpolationSnapDistance) {
    current.x = target.x
    current.y = target.y
    return
  }
  current.x = x
  current.y = y
}

export function hasCommittedSceneTokenPositionChanged(
  previous: Pick<CampaignSceneStateDto, 'tokens'>,
  next: Pick<CampaignSceneStateDto, 'tokens'>,
  tokenId: string
): boolean {
  const previousToken = previous.tokens.find((token) => token.id === tokenId)
  if (!previousToken) return false
  const nextToken = next.tokens.find((token) => token.id === tokenId)
  return !nextToken || !pointsEqual(previousToken.position, nextToken.position)
}

export function resolveVttZoomScale(currentScale: number, factor: number): number {
  const clampedCurrent = Number.isFinite(currentScale)
    ? Math.min(maximumVttZoomScale, Math.max(minimumVttZoomScale, currentScale))
    : minimumVttZoomScale
  if (!Number.isFinite(factor) || factor <= 0) return clampedCurrent
  return Math.min(maximumVttZoomScale, Math.max(minimumVttZoomScale, clampedCurrent * factor))
}

/** The least on-screen size, in pixels, that focusing a token zooms its larger footprint side to. */
export const minimumFocusedTokenScreenSize = 64

/** The zoom for focusing a token: the current one, or the least that makes the token readable. Never zooms out. */
export function resolveVttTokenFocusScale(
  currentScale: number,
  footprint: { height: number; width: number }
): number {
  const readableScale = minimumFocusedTokenScreenSize / Math.max(footprint.width, footprint.height)
  return resolveVttZoomScale(currentScale, Math.max(1, readableScale / currentScale))
}

export function positionVttMapTiles(
  delivery: Pick<SignedVttMapDeliveryDto, 'tiles'>
): VttMapTilePlacement[] {
  const columnWidths = maximumSizeByIndex(delivery.tiles, 'column', 'width')
  const rowHeights = maximumSizeByIndex(delivery.tiles, 'row', 'height')
  return delivery.tiles.map((tile) => ({
    ...tile,
    x: offsetBefore(columnWidths, tile.column),
    y: offsetBefore(rowHeights, tile.row)
  }))
}

export function shouldReloadVttMap(
  current: VttMapReloadState,
  next: Pick<VttMapReloadState, 'assetKey' | 'credentialKey'>
): boolean {
  return (
    current.assetKey !== next.assetKey ||
    current.layerEmpty ||
    (!current.loadComplete && current.credentialKey !== next.credentialKey)
  )
}

export function stableVttMapPartIds(delivery: Pick<SignedVttMapDeliveryDto, 'tiles'>): string[] {
  return ['overview', ...delivery.tiles.map((tile) => `tile:${tile.row}:${tile.column}`)]
}

export function resolveVttMapLoadDecision({
  currentAssetKey,
  loadedPartIds,
  nextAssetKey,
  requiredPartIds
}: VttMapLoadDecisionInput): VttMapLoadDecision {
  if (currentAssetKey !== nextAssetKey) return 'RESET'
  const loaded = new Set(loadedPartIds)
  const hasMissingPart = requiredPartIds.some((partId) => !loaded.has(partId))
  if (!hasMissingPart) return 'NONE'
  return 'LOAD_MISSING'
}

export function visibleGridLinePositions(
  origin: number,
  cellSize: number,
  limit: number
): number[] {
  const normalizedOrigin = ((origin % cellSize) + cellSize) % cellSize
  const lineCount = limit / cellSize
  const step = Number.isFinite(lineCount)
    ? cellSize * Math.max(1, Math.ceil(lineCount / maximumGridLines))
    : limit / maximumGridLines
  const positions: number[] = []
  for (
    let position = normalizedOrigin;
    position <= limit && positions.length < maximumGridLines;
    position += step
  ) {
    positions.push(position)
  }
  return positions
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function revealFogCell(
  opacity: Uint8ClampedArray,
  width: number,
  height: number,
  layerWidth: number,
  layerHeight: number,
  cellX: number,
  cellY: number
): void {
  const startX = Math.floor((cellX / layerWidth) * width)
  const endX = Math.min(width, Math.ceil(((cellX + 1) / layerWidth) * width))
  const startY = Math.floor((cellY / layerHeight) * height)
  const endY = Math.min(height, Math.ceil(((cellY + 1) / layerHeight) * height))
  for (let y = startY; y < endY; y += 1) {
    opacity.fill(0, y * width + startX, y * width + endX)
  }
}

function maximumSizeByIndex(
  tiles: SignedVttMapDeliveryDto['tiles'],
  indexKey: 'column' | 'row',
  sizeKey: 'height' | 'width'
): Map<number, number> {
  const sizes = new Map<number, number>()
  for (const tile of tiles) {
    sizes.set(tile[indexKey], Math.max(sizes.get(tile[indexKey]) ?? 0, tile[sizeKey]))
  }
  return sizes
}

function offsetBefore(sizes: ReadonlyMap<number, number>, index: number): number {
  let offset = 0
  for (let current = 0; current < index; current += 1) offset += sizes.get(current) ?? 0
  return offset
}

export function canControlSceneToken(
  token: CampaignSceneStateDto['tokens'][number],
  viewer: Pick<VttSceneTokenDragUpdate, 'boundTokenControl' | 'currentUserId' | 'role'>
): boolean {
  return (
    viewer.role === 'OWNER' ||
    (viewer.boundTokenControl.get(token.id) ??
      token.controlledByUserIds.includes(viewer.currentUserId))
  )
}

/**
 * The one token whose senses the scene is drawn through. A Player sees through the token they
 * selected when they control it, else their main Character's token. The GM sees through the token
 * they preview. The GM's preview never reaches a Player.
 */
export function resolveViewTokenId(input: {
  /** The Scene token bound to the viewer's main (assigned) Character. */
  assignedTokenId: string | null
  boundTokenControl: ReadonlyMap<string, boolean>
  currentUserId: string
  previewTokenId: string | null
  role: 'OWNER' | 'PLAYER'
  selectedTokenId: string | null
  tokens: CampaignSceneStateDto['tokens']
}): string | null {
  const { assignedTokenId, previewTokenId, role, selectedTokenId, tokens } = input
  const has = (tokenId: string | null): tokenId is string =>
    tokenId !== null && tokens.some((token) => token.id === tokenId)
  if (role === 'OWNER') return has(previewTokenId) ? previewTokenId : null
  const selected = tokens.find((token) => token.id === selectedTokenId)
  if (selected && canControlSceneToken(selected, input)) return selected.id
  return has(assignedTokenId) ? assignedTokenId : null
}

/**
 * What a sense does to the picture. A sense is told apart by its channel and the System level of
 * its illumination access: sight into some darkness, or into the System's darkest level.
 */
export type VttSenseEffect = 'BLINDSIGHT' | 'DARKVISION' | 'TREMORSENSE' | 'TRUESIGHT'

/** The System level a sense's sight reaches into, when that level is a darkness. */
export function senseAccessLevel(
  sense: Pick<SceneTokenSense, 'channel' | 'illuminationAccess'>,
  illuminationLevels: readonly SceneIlluminationLevel[]
): SceneIlluminationLevel | null {
  if (sense.channel !== 'VISUAL') return null
  const access = illuminationLevels.find(({ code }) => code === sense.illuminationAccess)
  return access?.renderClass === 'DARK' ? access : null
}

export function senseEffect(
  sense: Pick<SceneTokenSense, 'channel' | 'illuminationAccess'>,
  illuminationLevels: readonly SceneIlluminationLevel[]
): VttSenseEffect | null {
  if (sense.channel === 'NONVISUAL') return 'BLINDSIGHT'
  if (sense.channel === 'VIBRATION') return 'TREMORSENSE'
  const access = senseAccessLevel(sense, illuminationLevels)
  if (!access) return null
  return access === illuminationLevels.at(-1) ? 'TRUESIGHT' : 'DARKVISION'
}

/**
 * A sense range is measured from the footprint edge, so its radius from the centre adds half the
 * footprint. An unlimited sense has an infinite radius: it reaches all of its line of sight.
 */
export function senseReachRadius(
  grid: SceneGrid,
  token: Pick<CampaignSceneStateDto['tokens'][number], 'height' | 'width'>,
  sense: Pick<SceneTokenSense, 'range'>
): number {
  if (sense.range.rangeKind === 'UNLIMITED') return Infinity
  return (
    sceneDistanceAsCoordinateLength(grid, sense.range.amount) +
    Math.max(token.height, token.width) / 2
  )
}

/** The area one sense reaches: its radius and the line of sight clamped to it. */
export interface VttSenseReach {
  /** The darkest System level the sense's sight reaches into; null for a sense that is not sight. */
  access: SceneIlluminationLevel | null
  effect: VttSenseEffect
  origin: ScenePoint
  polygon: readonly ScenePoint[]
  radius: number
}

/**
 * Whether a token at this System illumination level is seen. Lit and dim levels show it; in
 * darkness only a sense does, and sight only into darkness no darker than its access level, as the
 * rules rank it. Tremorsense feels the ground, so a token counts as on the ground and is felt at
 * any distance within range with no sight line.
 */
export function isTokenRevealed(input: {
  halfSize: number
  illumination: SceneIlluminationLevel
  illuminationLevels: readonly SceneIlluminationLevel[]
  point: ScenePoint
  reaches: readonly VttSenseReach[]
}): boolean {
  const { halfSize, illumination, illuminationLevels, point, reaches } = input
  if (illumination.renderClass !== 'DARK') return true
  const rank = (level: SceneIlluminationLevel) =>
    illuminationLevels.findIndex(({ code }) => code === level.code)
  return reaches.some((reach) => {
    if (reach.effect === 'TREMORSENSE') {
      // Every token is treated as standing on the ground: the Scene has no flying data.
      return (
        Math.hypot(point.x - reach.origin.x, point.y - reach.origin.y) - halfSize <= reach.radius
      )
    }
    if (!scenePointInPolygon(point, { points: [...reach.polygon] })) return false
    if (reach.effect === 'BLINDSIGHT') return true
    return reach.access !== null && rank(illumination) <= rank(reach.access)
  })
}

/** A display object as far as its place in the scene graph goes. */
interface SceneGraphNode {
  parent: SceneGraphNode | null
}

/** Whether a pointer target is a token visual on the token layer, or any depth inside one. */
export function isWithinTokenVisual(
  target: SceneGraphNode | null,
  tokenLayer: SceneGraphNode
): boolean {
  for (let node = target; node; node = node.parent) {
    if (node.parent === tokenLayer) return true
  }
  return false
}

type SceneDarknessZone = CampaignSceneStateDto['darknessZones'][number]
type SceneLight = CampaignSceneStateDto['lights'][number]

/** Overlay alpha that stands for the DIM render class; LIT is 0 and DARK is 1. */
export const dimOverlayAlpha = 0.5

/** The darkest the GM's see-all view draws darkness, so the whole map stays readable. */
export const gmDarknessCapAlpha = 0.6

/**
 * The alpha of the black darkness overlay that encodes a render class at a point. One overlay
 * carries the whole of D108's precedence, so the class is read straight off the pixel.
 */
export function illuminationOverlayAlpha(renderClass: SceneIlluminationRenderClass): number {
  if (renderClass === 'LIT') return 0
  return renderClass === 'DIM' ? dimOverlayAlpha : 1
}

/** The overlay alphas of a light's bright and dim bands: the System's two brightest levels. */
export function lightBandAlphas(levels: readonly SceneIlluminationLevel[]) {
  const { bright, dim } = sceneLightLevels(levels)
  return {
    bright: illuminationOverlayAlpha(bright.renderClass),
    dim: illuminationOverlayAlpha(dim.renderClass)
  }
}

export function wholeMapPolygon(
  map: Pick<CampaignSceneStateDto['map'], 'height' | 'width'>
): ScenePoint[] {
  return [
    { x: 0, y: 0 },
    { x: map.width, y: 0 },
    { x: map.width, y: map.height },
    { x: 0, y: map.height }
  ]
}

/** One area at a System illumination level: the whole map (`zone: false`) or a darkness zone. */
export interface VttIlluminationArea {
  level: SceneIlluminationLevel
  points: readonly ScenePoint[]
  zone: boolean
}

/** The Scene's illumination areas: the ambient level over the whole map, then each zone's level. */
export function sceneIlluminationAreas(
  scene: Pick<CampaignSceneStateDto, 'ambientIllumination' | 'darknessZones' | 'map'>,
  illuminationLevels: readonly SceneIlluminationLevel[]
): VttIlluminationArea[] {
  const ambient = requireSceneIlluminationLevel(illuminationLevels, scene.ambientIllumination)
  return [
    { level: ambient, points: wholeMapPolygon(scene.map), zone: false },
    ...scene.darknessZones.flatMap((zone) =>
      zone.mechanicalIllumination
        ? [
            {
              level: requireSceneIlluminationLevel(illuminationLevels, zone.mechanicalIllumination),
              points: zone.polygon.points,
              zone: true
            }
          ]
        : []
    )
  ]
}

/** The low-alpha colour tint a light lays over its bright core and its dim reach. */
export function lightTintAlpha(light: Pick<SceneLight, 'intensity'>): number {
  return Math.min(0.2, Math.max(0.04, light.intensity * 0.12))
}

/** The bright core never exceeds the dim reach; the visibility polygon is built to the larger. */
export function lightRadii(light: Pick<SceneLight, 'brightRadius' | 'dimRadius'>): {
  bright: number
  dim: number
} {
  return { bright: light.brightRadius, dim: Math.max(light.brightRadius, light.dimRadius) }
}

/**
 * Pulls every polygon point farther than `radius` from `origin` back onto that circle. A
 * star-shaped visibility polygon stays star-shaped, so the result is the lit area within `radius`.
 */
export function clampPolygonToRadius(
  points: readonly ScenePoint[],
  origin: ScenePoint,
  radius: number
): ScenePoint[] {
  return points.map((point) => {
    const distance = Math.hypot(point.x - origin.x, point.y - origin.y)
    if (distance <= radius) return point
    const ratio = radius / distance
    return {
      x: origin.x + (point.x - origin.x) * ratio,
      y: origin.y + (point.y - origin.y) * ratio
    }
  })
}

interface VttDarknessZoneStyle {
  /** Dotted arcane outline of a level that dispels light. */
  illuminationOutline: { dash: number; gap: number; width: number } | null
  /** Non-colour obscurement cue: dashed for light, solid and heavier for heavy. */
  obscurementOutline: { dash: number | null; gap: number; width: number } | null
}

/** The non-colour cues of a darkness zone: its illumination and obscurement each get an outline. */
export function darknessZoneStyle(
  zone: Pick<SceneDarknessZone, 'mechanicalIllumination' | 'mechanicalObscurement'>,
  illuminationLevels: readonly SceneIlluminationLevel[]
): VttDarknessZoneStyle {
  return {
    illuminationOutline:
      zone.mechanicalIllumination &&
      requireSceneIlluminationLevel(illuminationLevels, zone.mechanicalIllumination).suppressesLight
        ? { dash: 3, gap: 9, width: 3 }
        : null,
    obscurementOutline:
      zone.mechanicalObscurement === 'HEAVY'
        ? { dash: null, gap: 0, width: 6 }
        : zone.mechanicalObscurement === 'LIGHT'
          ? { dash: 22, gap: 14, width: 3 }
          : null
  }
}

/** Points along an ellipse from one angle to another, clockwise from the top when started at -90 degrees. */
export function ellipseArcPoints(
  radiusX: number,
  radiusY: number,
  startRadians: number,
  endRadians: number
): ScenePoint[] {
  const steps = Math.max(2, Math.ceil(Math.abs(endRadians - startRadians) / 0.12))
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = startRadians + ((endRadians - startRadians) * index) / steps
    return { x: radiusX * Math.cos(angle), y: radiusY * Math.sin(angle) }
  })
}

/** The segments of a dashed closed outline, walked around the polygon with a continuous pattern. */
export function dashedPolygonSegments(
  points: readonly ScenePoint[],
  dash: number,
  gap: number
): Array<[ScenePoint, ScenePoint]> {
  const segments: Array<[ScenePoint, ScenePoint]> = []
  // Distance into the repeating dash+gap pattern at the start of the current edge.
  let phase = 0
  for (const [index, from] of points.entries()) {
    const to = points[(index + 1) % points.length]!
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    let walked = 0
    while (walked < length) {
      const inDash = phase < dash
      const step = Math.min(length - walked, inDash ? dash - phase : dash + gap - phase)
      if (inDash) {
        const start = walked / length
        const end = (walked + step) / length
        segments.push([
          { x: from.x + (to.x - from.x) * start, y: from.y + (to.y - from.y) * start },
          { x: from.x + (to.x - from.x) * end, y: from.y + (to.y - from.y) * end }
        ])
      }
      walked += step
      phase = (phase + step) % (dash + gap)
    }
  }
  return segments
}

/** The words for one darkness zone with its System level label, e.g. "Magical darkness, heavily obscured". */
export function describeDarknessZone(
  zone: Pick<SceneDarknessZone, 'mechanicalIllumination' | 'mechanicalObscurement'>,
  illuminationLevels: readonly SceneIlluminationLevel[]
): string {
  const parts = [
    zone.mechanicalIllumination
      ? requireSceneIlluminationLevel(illuminationLevels, zone.mechanicalIllumination).label
      : null,
    zone.mechanicalObscurement === 'HEAVY'
      ? 'heavily obscured'
      : zone.mechanicalObscurement === 'LIGHT'
        ? 'lightly obscured'
        : null
  ].filter((part): part is string => part !== null)
  if (parts.length === 0) return 'Visual darkness'
  const text = parts.join(', ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** The lighting sentence for the canvas description; null when nothing departs from a lit Scene. */
export function describeSceneLighting(
  scene: Pick<CampaignSceneStateDto, 'ambientIllumination' | 'darknessZones'>,
  visionLabels: readonly string[],
  illuminationLevels: readonly SceneIlluminationLevel[]
): string | null {
  const ambient = requireSceneIlluminationLevel(illuminationLevels, scene.ambientIllumination)
  const parts = [
    ambient.renderClass === 'LIT' ? null : `Ambient: ${ambient.label}`,
    scene.darknessZones.length > 0
      ? `Darkness zones: ${scene.darknessZones
          .map((zone) => describeDarknessZone(zone, illuminationLevels))
          .join('; ')}`
      : null,
    visionLabels.length > 0 ? `Vision: ${visionLabels.join(', ')}` : null
  ].filter((part): part is string => part !== null)
  return parts.length > 0 ? `Lighting. ${parts.join('. ')}.` : null
}

function pointsEqual(left: ScenePoint, right: ScenePoint): boolean {
  return left.x === right.x && left.y === right.y
}

/** A facing arc reaches this far past the token's footprint. */
const FACING_ARC_REACH = 40

/** How far from the token's centre its facing arcs are drawn. */
export function facingArcRadius(token: { height: number; width: number }): number {
  return Math.max(token.width, token.height) / 2 + FACING_ARC_REACH
}

/** Degrees between the samples that approximate a facing arc's curved edge. */
const FACING_ARC_SAMPLE_DEGREES = 5

/** The wedge a facing arc covers around a token's centre: the centre, then its sampled outer edge. */
export function facingArcWedge(sector: FacingArcSector, radius: number): ScenePoint[] {
  const span = sector.toBearing - sector.fromBearing
  const samples = Math.max(1, Math.ceil(span / FACING_ARC_SAMPLE_DEGREES))
  return [
    { x: 0, y: 0 },
    ...Array.from({ length: samples + 1 }, (_, index) => {
      const bearing = ((sector.fromBearing + (span * index) / samples) * Math.PI) / 180
      return { x: Math.sin(bearing) * radius, y: -Math.cos(bearing) * radius }
    })
  ]
}
