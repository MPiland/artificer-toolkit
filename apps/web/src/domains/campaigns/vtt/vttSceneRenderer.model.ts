import type { SignedVttMapDeliveryDto } from '@artificer-toolkit/schema/api/media'
import type { EncounterActionChoiceDto } from '@artificer-toolkit/schema/api/encounterActionChoices'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import {
  canMoveBetween,
  measureScenePathDistance,
  pointAreaInSceneCoordinates,
  SceneBarrierIndex,
  sceneDistanceAsCoordinateLength,
  scenePointInPolygon,
  type SceneGrid,
  type ScenePoint,
  type SceneTokenSense,
  type SpatialPointAreaShape
} from '@artificer-toolkit/shared/vtt'

const unexploredOpacity = 224
const maximumGridLines = 2_048
const transientInterpolationRatePerSecond = 14
const transientInterpolationSnapDistance = 0.25
const minimumVttZoomScale = 0.02
const maximumVttZoomScale = 8

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

export interface VttTokenPresentation {
  accessibleDescription: string
  artUrl: string | null
  /** The disposition ring's name, so the ring's colour is never the only cue. */
  dispositionLabel: string | null
  facing: boolean
  fillColor: number
  halo: { color: number; label: string } | null
  marked: boolean
  outlineColor: number
  statuses: Array<{
    category: VttStatusCategory
    id: string
    kind: 'CONCENTRATION' | 'CONDITION' | 'EFFECT' | 'HEALTH' | 'INJURY' | 'MORALE' | 'REACTION'
    label: string
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
      purpose: 'AURA' | 'TARGET' | 'TRAP'
      points: ScenePoint[]
    }

const pointAreaColor = 0xe8590c

/** The overlay for a point-origin area centered on `origin`: a circle for a radius, a square for a cube. */
export function pointAreaOverlay(
  shape: SpatialPointAreaShape,
  origin: ScenePoint
): VttScenePresentationOverlay {
  if (shape.kind === 'RADIUS') {
    return {
      center: origin,
      color: pointAreaColor,
      id: 'area-origin',
      kind: 'CIRCLE',
      label: 'Area origin',
      purpose: 'TARGET',
      radius: shape.radius
    }
  }
  const half = shape.edgeLength / 2
  return {
    color: pointAreaColor,
    id: 'area-origin',
    kind: 'POLYGON',
    label: 'Area origin',
    points: [
      { x: origin.x - half, y: origin.y - half },
      { x: origin.x + half, y: origin.y - half },
      { x: origin.x + half, y: origin.y + half },
      { x: origin.x - half, y: origin.y + half }
    ],
    purpose: 'TARGET'
  }
}

/** The chosen action's range and target as the stage previews them while the drawer is picking. */
export interface VttActionPreview {
  range: EncounterActionChoiceDto['range']
  sourceTokenId: string
  targetTokenId: string | null
}

const rangeColor = 0x0891b2
const targetColor = 0xe03131
/** Scene pixels the target ring clears the token's footprint by. */
const targetRingMargin = 6

/**
 * The RANGE circles around the acting token and the TARGET ring around the chosen target, in Scene
 * coordinates. A range is approximated from the token's center. SELF, UNLIMITED and scaled ranges
 * draw no circle.
 */
export function actionPreviewOverlays(
  preview: VttActionPreview | null,
  scene: Pick<CampaignSceneStateDto, 'grid' | 'tokens'>
): VttScenePresentationOverlay[] {
  if (!preview) return []
  const overlays: VttScenePresentationOverlay[] = []
  const source = scene.tokens.find((token) => token.id === preview.sourceTokenId)
  const distances =
    preview.range?.kind === 'WITHIN'
      ? [preview.range.distance]
      : preview.range?.kind === 'RANGED'
        ? [preview.range.normal, preview.range.long]
        : []
  if (source) {
    for (const [index, distance] of distances.entries()) {
      const area = pointAreaInSceneCoordinates({ kind: 'RADIUS', radius: distance }, scene.grid)
      if (area?.kind === 'RADIUS')
        overlays.push({
          center: source.position,
          color: rangeColor,
          id: `action-range-${index}`,
          kind: 'CIRCLE',
          label: index === 0 ? 'Action range' : 'Action long range',
          purpose: 'RANGE',
          radius: area.radius
        })
    }
  }
  const target = scene.tokens.find((token) => token.id === preview.targetTokenId)
  if (target)
    overlays.push({
      center: target.position,
      color: targetColor,
      id: 'action-target',
      kind: 'CIRCLE',
      label: 'Action target',
      purpose: 'TARGET',
      radius: Math.max(target.width, target.height) / 2 + targetRingMargin
    })
  return overlays
}

/**
 * The overlays the stage hands the renderer: the action preview while the drawer is open (including
 * while the caster aims an area's center) plus the picked area once it is no longer being aimed.
 */
export function stageOverlays({
  actionPreview,
  aimingArea,
  areaOrigin,
  areaShape,
  drawerOpened,
  scene
}: {
  actionPreview: VttActionPreview | null
  aimingArea: boolean
  areaOrigin: ScenePoint | null
  areaShape: SpatialPointAreaShape | null
  drawerOpened: boolean
  scene: Pick<CampaignSceneStateDto, 'grid' | 'tokens'> | null
}): VttScenePresentationOverlay[] | undefined {
  const overlays = [
    ...(drawerOpened && scene ? actionPreviewOverlays(actionPreview, scene) : []),
    ...(areaShape && areaOrigin && !aimingArea ? [pointAreaOverlay(areaShape, areaOrigin)] : [])
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
  const distance = measureScenePathDistance(grid, path)
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
    presentation?.fillColor,
    presentation?.halo?.color,
    presentation?.marked,
    presentation?.outlineColor,
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

/** What a sense does to the picture. A sense is told apart by its channel and illumination access. */
export type VttSenseEffect = 'BLINDSIGHT' | 'DARKVISION' | 'TREMORSENSE' | 'TRUESIGHT'

export function senseEffect(
  sense: Pick<SceneTokenSense, 'channel' | 'illuminationAccess'>
): VttSenseEffect | null {
  if (sense.channel === 'NONVISUAL') return 'BLINDSIGHT'
  if (sense.channel === 'VIBRATION') return 'TREMORSENSE'
  if (sense.channel !== 'VISUAL') return null
  if (sense.illuminationAccess === 'ORDINARY_DARKNESS') return 'DARKVISION'
  return sense.illuminationAccess === 'MAGICAL_DARKNESS' ? 'TRUESIGHT' : null
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
  effect: VttSenseEffect
  origin: ScenePoint
  polygon: readonly ScenePoint[]
  radius: number
}

/**
 * Whether a token in this illumination is seen. Bright and dim light show it; in darkness only
 * a sense does. Tremorsense feels the ground, so a token counts as on the ground and is felt at any
 * distance within range with no sight line.
 */
export function isTokenRevealed(input: {
  halfSize: number
  illumination: SceneIllumination
  point: ScenePoint
  reaches: readonly VttSenseReach[]
}): boolean {
  const { halfSize, illumination, point, reaches } = input
  if (illumination === 'BRIGHT' || illumination === 'DIM') return true
  return reaches.some((reach) => {
    if (reach.effect === 'TREMORSENSE') {
      // Every token is treated as standing on the ground: the Scene has no flying data.
      return (
        Math.hypot(point.x - reach.origin.x, point.y - reach.origin.y) - halfSize <= reach.radius
      )
    }
    if (!scenePointInPolygon(point, { points: [...reach.polygon] })) return false
    if (reach.effect === 'BLINDSIGHT' || reach.effect === 'TRUESIGHT') return true
    return illumination === 'ORDINARY_DARKNESS'
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

type SceneIllumination = CampaignSceneStateDto['ambientIllumination']
type SceneDarknessZone = CampaignSceneStateDto['darknessZones'][number]
type SceneLight = CampaignSceneStateDto['lights'][number]

/** Overlay alpha that stands for DIM light; BRIGHT is 0 and both kinds of darkness are 1. */
export const dimOverlayAlpha = 0.5

/** The darkest the GM's see-all view draws darkness, so the whole map stays readable. */
export const gmDarknessCapAlpha = 0.6

/**
 * The alpha of the black darkness overlay that encodes an illumination class at a point. One
 * overlay carries the whole of D108's precedence, so the class is read straight off the pixel.
 */
export function illuminationOverlayAlpha(illumination: SceneIllumination): number {
  if (illumination === 'BRIGHT') return 0
  return illumination === 'DIM' ? dimOverlayAlpha : 1
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

export interface VttDarknessZoneStyle {
  /** Dotted arcane outline of magical darkness. */
  illuminationOutline: { dash: number; gap: number; width: number } | null
  /** Non-colour obscurement cue: dashed for light, solid and heavier for heavy. */
  obscurementOutline: { dash: number | null; gap: number; width: number } | null
}

/** The non-colour cues of a darkness zone: its illumination and obscurement each get an outline. */
export function darknessZoneStyle(
  zone: Pick<SceneDarknessZone, 'mechanicalIllumination' | 'mechanicalObscurement'>
): VttDarknessZoneStyle {
  return {
    illuminationOutline:
      zone.mechanicalIllumination === 'MAGICAL_DARKNESS' ? { dash: 3, gap: 9, width: 3 } : null,
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

const illuminationLabels = {
  BRIGHT: 'Bright light',
  DIM: 'Dim light',
  MAGICAL_DARKNESS: 'Magical darkness',
  ORDINARY_DARKNESS: 'Ordinary darkness'
} as const satisfies Record<SceneIllumination, string>

/** The words for one darkness zone, e.g. "Magical darkness, heavily obscured". */
export function describeDarknessZone(
  zone: Pick<SceneDarknessZone, 'mechanicalIllumination' | 'mechanicalObscurement'>
): string {
  const parts = [
    zone.mechanicalIllumination ? illuminationLabels[zone.mechanicalIllumination] : null,
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

/** The lighting sentence for the canvas description; null when nothing departs from bright light. */
export function describeSceneLighting(
  scene: Pick<CampaignSceneStateDto, 'ambientIllumination' | 'darknessZones'>,
  visionLabels: readonly string[]
): string | null {
  const parts = [
    scene.ambientIllumination === 'BRIGHT'
      ? null
      : `Ambient: ${illuminationLabels[scene.ambientIllumination]}`,
    scene.darknessZones.length > 0
      ? `Darkness zones: ${scene.darknessZones.map(describeDarknessZone).join('; ')}`
      : null,
    visionLabels.length > 0 ? `Vision: ${visionLabels.join(', ')}` : null
  ].filter((part): part is string => part !== null)
  return parts.length > 0 ? `Lighting. ${parts.join('. ')}.` : null
}

export interface VttDarknessZoneCounts {
  dim: number
  heavyObscured: number
  lightObscured: number
  magical: number
  ordinary: number
  unspecified: number
}

/** Counts zones by illumination and obscurement; a zone without illumination is "unspecified". */
export function countDarknessZones(
  zones: readonly Pick<SceneDarknessZone, 'mechanicalIllumination' | 'mechanicalObscurement'>[]
): VttDarknessZoneCounts {
  const count = (predicate: (zone: (typeof zones)[number]) => boolean) =>
    zones.filter(predicate).length
  return {
    dim: count((zone) => zone.mechanicalIllumination === 'DIM'),
    heavyObscured: count((zone) => zone.mechanicalObscurement === 'HEAVY'),
    lightObscured: count((zone) => zone.mechanicalObscurement === 'LIGHT'),
    magical: count((zone) => zone.mechanicalIllumination === 'MAGICAL_DARKNESS'),
    ordinary: count((zone) => zone.mechanicalIllumination === 'ORDINARY_DARKNESS'),
    unspecified: count((zone) => zone.mechanicalIllumination === null)
  }
}

function pointsEqual(left: ScenePoint, right: ScenePoint): boolean {
  return left.x === right.x && left.y === right.y
}
