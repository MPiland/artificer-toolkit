import type { SignedVttMapDeliveryDto } from '@artificer-toolkit/schema/api/media'
import type { EncounterSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import {
  canMoveBetween,
  measureScenePathDistance,
  SceneBarrierIndex,
  type SceneGrid,
  type ScenePoint
} from '@artificer-toolkit/shared/vtt'

const unexploredOpacity = 224
const maximumGridLines = 2_048
const transientInterpolationRatePerSecond = 14
const transientInterpolationSnapDistance = 0.25
const minimumVttZoomScale = 0.02
const maximumVttZoomScale = 8

export interface VttFogMask {
  height: number
  opacity: Uint8ClampedArray
  width: number
}

export interface VttMapReloadState {
  assetKey: string | null
  credentialKey: string | null
  layerEmpty: boolean
  loadComplete: boolean
}

export type VttMapLoadDecision = 'LOAD_MISSING' | 'NONE' | 'RESET'

export interface VttMapLoadDecisionInput {
  currentAssetKey: string | null
  loadedPartIds: readonly string[]
  nextAssetKey: string | null
  requiredPartIds: readonly string[]
}

export interface VttSceneTokenDragState {
  appearanceKey: string
  origin: ScenePoint
  tokenId: string
}

export interface VttSceneTokenDragUpdate {
  currentUserId: string
  mode: 'EDIT' | 'PLAY'
  role: 'OWNER' | 'PLAYER'
  scene: EncounterSceneStateDto
  tool: string
}

export type VttMapTilePlacement = SignedVttMapDeliveryDto['tiles'][number] & {
  x: number
  y: number
}

export function buildVttFogMask(
  scene: Pick<EncounterSceneStateDto, 'fogLayers'>,
  hideUnexploredWithoutLayer = false
): VttFogMask | null {
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
  scene: EncounterSceneStateDto,
  token: EncounterSceneStateDto['tokens'][number],
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

export function sceneTokenAppearanceKey(token: EncounterSceneStateDto['tokens'][number]): string {
  return [
    token.assetId,
    token.controlledByUserIds.join(','),
    token.height,
    token.hidden,
    token.label,
    token.locked,
    token.rotationDegrees,
    token.width
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
  return sceneTokenAppearanceKey(token) === drag.appearanceKey
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
  previous: Pick<EncounterSceneStateDto, 'tokens'>,
  next: Pick<EncounterSceneStateDto, 'tokens'>,
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

function canControlSceneToken(
  token: EncounterSceneStateDto['tokens'][number],
  update: Pick<VttSceneTokenDragUpdate, 'currentUserId' | 'role'>
): boolean {
  return update.role === 'OWNER' || token.controlledByUserIds.includes(update.currentUserId)
}

function pointsEqual(left: ScenePoint, right: ScenePoint): boolean {
  return left.x === right.x && left.y === right.y
}
