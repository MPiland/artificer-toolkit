import { SceneBarrierIndex, visibilityPolygonForToken } from './geometry.js'
import {
  VTT_SCENE_LIMITS,
  type EncounterSceneState,
  type SceneBarrier,
  type SceneFogChunk,
  type SceneFogLayer,
  type ScenePoint,
  type ScenePolygon,
  type SceneToken,
  type SceneViewer
} from './scene.js'

const FOG_CHUNK_SIDE = 32

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function encodeBase64(value: Uint8Array): string {
  let binary = ''
  for (const byte of value) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function bitIsSet(bytes: Uint8Array, index: number): boolean {
  return (bytes[Math.floor(index / 8)]! & (1 << (index % 8))) !== 0
}

function setBit(bytes: Uint8Array, index: number): boolean {
  const byteIndex = Math.floor(index / 8)
  const mask = 1 << (index % 8)
  const current = bytes[byteIndex]!
  if ((current & mask) !== 0) return false
  bytes[byteIndex] = current | mask
  return true
}

function clearBit(bytes: Uint8Array, index: number): boolean {
  const byteIndex = Math.floor(index / 8)
  const mask = 1 << (index % 8)
  const current = bytes[byteIndex]!
  if ((current & mask) === 0) return false
  bytes[byteIndex] = current & ~mask
  return true
}

function scanlineIntersections(polygon: ScenePolygon, y: number): number[] {
  const intersections: number[] = []
  for (
    let index = 0, prior = polygon.points.length - 1;
    index < polygon.points.length;
    prior = index++
  ) {
    const a = polygon.points[index]!
    const b = polygon.points[prior]!
    if (a.y > y === b.y > y) continue
    intersections.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y))
  }
  return intersections.sort((left, right) => left - right)
}

function polygonBounds(polygon: ScenePolygon): {
  maximumX: number
  maximumY: number
  minimumX: number
  minimumY: number
} {
  let maximumX = Number.NEGATIVE_INFINITY
  let maximumY = Number.NEGATIVE_INFINITY
  let minimumX = Number.POSITIVE_INFINITY
  let minimumY = Number.POSITIVE_INFINITY
  for (const point of polygon.points) {
    maximumX = Math.max(maximumX, point.x)
    maximumY = Math.max(maximumY, point.y)
    minimumX = Math.min(minimumX, point.x)
    minimumY = Math.min(minimumY, point.y)
  }
  return { maximumX, maximumY, minimumX, minimumY }
}

function fogDimensions(state: EncounterSceneState): { height: number; width: number } {
  const scale = Math.min(
    1,
    VTT_SCENE_LIMITS.fogCellsPerSide / Math.max(state.map.width, state.map.height)
  )
  return {
    height: Math.max(1, Math.round(state.map.height * scale)),
    width: Math.max(1, Math.round(state.map.width * scale))
  }
}

function readLayerMask(layer: SceneFogLayer): Uint8Array {
  const mask = new Uint8Array(Math.ceil((layer.width * layer.height) / 8))
  for (const chunk of layer.chunks) {
    const bytes = decodeBase64(chunk.data)
    for (let localY = 0; localY < chunk.height; localY += 1) {
      for (let localX = 0; localX < chunk.width; localX += 1) {
        const localIndex = localY * chunk.width + localX
        if (!bitIsSet(bytes, localIndex)) continue
        setBit(mask, (chunk.y + localY) * layer.width + chunk.x + localX)
      }
    }
  }
  return mask
}

function chunkFromMask(
  mask: Uint8Array,
  layerWidth: number,
  chunkX: number,
  chunkY: number,
  chunksPerRow: number,
  layerHeight: number
): SceneFogChunk {
  const x = chunkX * FOG_CHUNK_SIDE
  const y = chunkY * FOG_CHUNK_SIDE
  const width = Math.min(FOG_CHUNK_SIDE, layerWidth - x)
  const height = Math.min(FOG_CHUNK_SIDE, layerHeight - y)
  const bytes = new Uint8Array(Math.ceil((width * height) / 8))
  for (let localY = 0; localY < height; localY += 1) {
    for (let localX = 0; localX < width; localX += 1) {
      if (!bitIsSet(mask, (y + localY) * layerWidth + x + localX)) continue
      setBit(bytes, localY * width + localX)
    }
  }
  return {
    data: encodeBase64(bytes),
    height,
    index: chunkY * chunksPerRow + chunkX,
    width,
    x,
    y
  }
}

function visionRangeInMapPixels(state: EncounterSceneState, token: SceneToken): SceneToken | null {
  if (!token.vision) return null
  const multiplier =
    state.grid.kind === 'GRIDLESS'
      ? state.grid.pixelsPerUnit
      : state.grid.cellSize / state.grid.distancePerCell
  return {
    ...token,
    vision: {
      ...token.vision,
      brightRange: token.vision.brightRange * multiplier,
      dimRange: token.vision.dimRange * multiplier
    }
  }
}

function squaredDistanceToSegment(point: ScenePoint, barrier: SceneBarrier): number {
  const deltaX = barrier.b.x - barrier.a.x
  const deltaY = barrier.b.y - barrier.a.y
  const lengthSquared = deltaX * deltaX + deltaY * deltaY
  if (lengthSquared === 0) {
    return (point.x - barrier.a.x) ** 2 + (point.y - barrier.a.y) ** 2
  }
  const progress = Math.max(
    0,
    Math.min(
      1,
      ((point.x - barrier.a.x) * deltaX + (point.y - barrier.a.y) * deltaY) / lengthSquared
    )
  )
  const closestX = barrier.a.x + progress * deltaX
  const closestY = barrier.a.y + progress * deltaY
  return (point.x - closestX) ** 2 + (point.y - closestY) ** 2
}

/** Return vision-bearing tokens whose current sight radius can intersect changed barriers. */
export function sceneTokenIdsAffectedByBarriers(
  state: EncounterSceneState,
  barriers: readonly SceneBarrier[]
): string[] {
  if (barriers.length === 0) return []
  return state.tokens.flatMap((token) => {
    if (token.hidden || token.vision?.enabled !== true) return []
    const ranged = visionRangeInMapPixels(state, token)
    if (!ranged?.vision) return []
    const maximum = Math.max(ranged.vision.brightRange, ranged.vision.dimRange)
    return maximum > 0 &&
      barriers.some(
        (barrier) => squaredDistanceToSegment(ranged.position, barrier) <= maximum * maximum
      )
      ? [token.id]
      : []
  })
}

function eligibleTokens(
  state: EncounterSceneState,
  ownerUserId: string | null,
  tokenIds: ReadonlySet<string> | null
): SceneToken[] {
  if (state.fogMode === 'SHARED_PARTY' && ownerUserId !== null) {
    throw new Error('Shared-party exploration requires the shared fog layer.')
  }
  if (state.fogMode === 'PER_PLAYER' && ownerUserId === null) {
    throw new Error('Per-player exploration requires a player-owned fog layer.')
  }
  return state.tokens.filter(
    (token) =>
      !token.hidden &&
      token.vision?.enabled === true &&
      (tokenIds === null || tokenIds.has(token.id)) &&
      (ownerUserId === null
        ? token.controlledByUserIds.length > 0
        : token.controlledByUserIds.includes(ownerUserId))
  )
}

/**
 * Derive only newly explored canonical 32x32 fog chunks. Applying the returned layer is
 * monotonic: already explored cells stay explored and an unchanged view returns null.
 */
export function deriveSceneExplorationPatch(
  state: EncounterSceneState,
  options: { ownerUserId: string | null; tokenIds?: readonly string[] }
): SceneFogLayer | null {
  const existing = state.fogLayers.find((layer) => layer.ownerUserId === options.ownerUserId)
  const dimensions = existing ?? fogDimensions(state)
  const before = existing
    ? readLayerMask(existing)
    : new Uint8Array(Math.ceil((dimensions.width * dimensions.height) / 8))
  const after = before.slice()
  const tokens = eligibleTokens(
    state,
    options.ownerUserId,
    options.tokenIds ? new Set(options.tokenIds) : null
  )
  const barrierIndex = new SceneBarrierIndex(state.barriers)
  const polygons = tokens.flatMap((token) => {
    const ranged = visionRangeInMapPixels(state, token)
    if (!ranged?.vision) return []
    const polygon = visibilityPolygonForToken(
      ranged.position,
      ranged.vision,
      state.barriers,
      state.doorStates,
      barrierIndex
    )
    return polygon ? [polygon] : []
  })
  if (polygons.length === 0) return null

  const changedChunkIndexes = new Set<number>()
  const chunksPerRow = Math.ceil(dimensions.width / FOG_CHUNK_SIDE)
  for (const polygon of polygons) {
    const bounds = polygonBounds(polygon)
    const minimumY = Math.max(
      0,
      Math.floor((bounds.minimumY / state.map.height) * dimensions.height)
    )
    const maximumY = Math.min(
      dimensions.height - 1,
      Math.ceil((bounds.maximumY / state.map.height) * dimensions.height)
    )
    for (let y = minimumY; y <= maximumY; y += 1) {
      const mapY = ((y + 0.5) / dimensions.height) * state.map.height
      const intersections = scanlineIntersections(polygon, mapY)
      for (let index = 0; index + 1 < intersections.length; index += 2) {
        const minimumX = Math.max(
          0,
          Math.ceil((intersections[index]! / state.map.width) * dimensions.width - 0.5)
        )
        const maximumX = Math.min(
          dimensions.width - 1,
          Math.floor((intersections[index + 1]! / state.map.width) * dimensions.width - 0.5)
        )
        for (let x = minimumX; x <= maximumX; x += 1) {
          if (!setBit(after, y * dimensions.width + x)) continue
          changedChunkIndexes.add(
            Math.floor(y / FOG_CHUNK_SIDE) * chunksPerRow + Math.floor(x / FOG_CHUNK_SIDE)
          )
        }
      }
    }
  }
  if (changedChunkIndexes.size === 0) return null

  return {
    chunks: [...changedChunkIndexes]
      .sort((left, right) => left - right)
      .map((index) =>
        chunkFromMask(
          after,
          dimensions.width,
          index % chunksPerRow,
          Math.floor(index / chunksPerRow),
          chunksPerRow,
          dimensions.height
        )
      ),
    height: dimensions.height,
    ownerUserId: options.ownerUserId,
    width: dimensions.width
  }
}

function withFogPatch(state: EncounterSceneState, patch: SceneFogLayer): EncounterSceneState {
  const current = state.fogLayers.find((layer) => layer.ownerUserId === patch.ownerUserId)
  const chunks = new Map(current?.chunks.map((chunk) => [chunk.index, chunk]) ?? [])
  for (const chunk of patch.chunks) chunks.set(chunk.index, chunk)
  const layer = { ...patch, chunks: [...chunks.values()].sort((a, b) => a.index - b.index) }
  return {
    ...state,
    fogLayers: current
      ? state.fogLayers.map((candidate) =>
          candidate.ownerUserId === patch.ownerUserId ? layer : candidate
        )
      : [...state.fogLayers, layer]
  }
}

/** Derive one cumulative exploration patch for a token's validated movement path. */
export function deriveSceneTokenPathExplorationPatch(
  state: EncounterSceneState,
  options: { ownerUserId: string | null; path: readonly ScenePoint[]; tokenId: string }
): SceneFogLayer | null {
  const token = state.tokens.find((candidate) => candidate.id === options.tokenId)
  if (!token || options.path.length === 0) return null
  const original = state.fogLayers.find((layer) => layer.ownerUserId === options.ownerUserId)
  let working = state
  for (const position of options.path) {
    const positioned = {
      ...working,
      tokens: working.tokens.map((candidate) =>
        candidate.id === token.id ? { ...candidate, position } : candidate
      )
    }
    const patch = deriveSceneExplorationPatch(positioned, {
      ownerUserId: options.ownerUserId,
      tokenIds: [token.id]
    })
    working = patch ? withFogPatch(positioned, patch) : positioned
  }
  const resolved = working.fogLayers.find((layer) => layer.ownerUserId === options.ownerUserId)
  if (!resolved) return null
  const originalChunks = new Map(original?.chunks.map((chunk) => [chunk.index, chunk.data]) ?? [])
  const chunks = resolved.chunks.filter((chunk) => originalChunks.get(chunk.index) !== chunk.data)
  return chunks.length === 0 ? null : { ...resolved, chunks }
}

/**
 * Derive only the fog layers a particular recipient may observe for a validated token preview.
 * Owners receive all affected per-player layers so their explicit player-preview mode stays exact.
 */
export function deriveSceneTokenPreviewFogLayers(
  state: EncounterSceneState,
  options: { path: readonly ScenePoint[]; tokenId: string; viewer: SceneViewer }
): SceneFogLayer[] {
  const token = state.tokens.find((candidate) => candidate.id === options.tokenId)
  if (!token || token.hidden || token.vision?.enabled !== true) return []
  const owners =
    state.fogMode === 'SHARED_PARTY'
      ? [null]
      : options.viewer.role === 'GM'
        ? [...new Set(token.controlledByUserIds)]
        : token.controlledByUserIds.includes(options.viewer.userId)
          ? [options.viewer.userId]
          : []
  return owners.flatMap((ownerUserId) => {
    const layer = deriveSceneTokenPathExplorationPatch(state, {
      ownerUserId,
      path: options.path,
      tokenId: token.id
    })
    return layer ? [layer] : []
  })
}

/** Build a complete manual fog replacement for one shared or per-player layer. */
export function createUniformSceneFogLayer(
  state: EncounterSceneState,
  options: { explored: boolean; ownerUserId: string | null }
): SceneFogLayer {
  if (state.fogMode === 'SHARED_PARTY' && options.ownerUserId !== null) {
    throw new Error('Shared-party fog requires the shared fog layer.')
  }
  if (state.fogMode === 'PER_PLAYER' && options.ownerUserId === null) {
    throw new Error('Per-player fog requires a player-owned fog layer.')
  }
  const existing = state.fogLayers.find((layer) => layer.ownerUserId === options.ownerUserId)
  const dimensions = existing ?? fogDimensions(state)
  const mask = new Uint8Array(Math.ceil((dimensions.width * dimensions.height) / 8))
  if (options.explored) mask.fill(0xff)
  const chunksPerRow = Math.ceil(dimensions.width / FOG_CHUNK_SIDE)
  const chunkRows = Math.ceil(dimensions.height / FOG_CHUNK_SIDE)
  return {
    chunks: Array.from({ length: chunksPerRow * chunkRows }, (_, index) =>
      chunkFromMask(
        mask,
        dimensions.width,
        index % chunksPerRow,
        Math.floor(index / chunksPerRow),
        chunksPerRow,
        dimensions.height
      )
    ),
    height: dimensions.height,
    ownerUserId: options.ownerUserId,
    width: dimensions.width
  }
}

/**
 * Apply a bounded map-space rectangle to one fog layer. The returned patch contains only
 * canonical chunks whose bits changed, so it composes with concurrent unrelated fog edits.
 */
export function createSceneFogAreaPatch(
  state: EncounterSceneState,
  options: {
    explored: boolean
    ownerUserId: string | null
    rectangle: { a: ScenePoint; b: ScenePoint }
  }
): SceneFogLayer | null {
  if (state.fogMode === 'SHARED_PARTY' && options.ownerUserId !== null) {
    throw new Error('Shared-party fog requires the shared fog layer.')
  }
  if (state.fogMode === 'PER_PLAYER' && options.ownerUserId === null) {
    throw new Error('Per-player fog requires a player-owned fog layer.')
  }
  const existing = state.fogLayers.find((layer) => layer.ownerUserId === options.ownerUserId)
  const dimensions = existing ?? fogDimensions(state)
  const before = existing
    ? readLayerMask(existing)
    : new Uint8Array(Math.ceil((dimensions.width * dimensions.height) / 8))
  const after = before.slice()
  const minimumMapX = Math.max(0, Math.min(options.rectangle.a.x, options.rectangle.b.x))
  const maximumMapX = Math.min(
    state.map.width,
    Math.max(options.rectangle.a.x, options.rectangle.b.x)
  )
  const minimumMapY = Math.max(0, Math.min(options.rectangle.a.y, options.rectangle.b.y))
  const maximumMapY = Math.min(
    state.map.height,
    Math.max(options.rectangle.a.y, options.rectangle.b.y)
  )
  if (minimumMapX >= maximumMapX || minimumMapY >= maximumMapY) return null
  const minimumX = Math.max(0, Math.floor((minimumMapX / state.map.width) * dimensions.width))
  const maximumX = Math.min(
    dimensions.width - 1,
    Math.ceil((maximumMapX / state.map.width) * dimensions.width) - 1
  )
  const minimumY = Math.max(0, Math.floor((minimumMapY / state.map.height) * dimensions.height))
  const maximumY = Math.min(
    dimensions.height - 1,
    Math.ceil((maximumMapY / state.map.height) * dimensions.height) - 1
  )
  const changed = new Set<number>()
  const chunksPerRow = Math.ceil(dimensions.width / FOG_CHUNK_SIDE)
  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      const changedBit = options.explored
        ? setBit(after, y * dimensions.width + x)
        : clearBit(after, y * dimensions.width + x)
      if (changedBit) {
        changed.add(Math.floor(y / FOG_CHUNK_SIDE) * chunksPerRow + Math.floor(x / FOG_CHUNK_SIDE))
      }
    }
  }
  if (changed.size === 0) return null
  return {
    chunks: [...changed]
      .sort((left, right) => left - right)
      .map((index) =>
        chunkFromMask(
          after,
          dimensions.width,
          index % chunksPerRow,
          Math.floor(index / chunksPerRow),
          chunksPerRow,
          dimensions.height
        )
      ),
    height: dimensions.height,
    ownerUserId: options.ownerUserId,
    width: dimensions.width
  }
}

export function isSceneFogCellExplored(layer: SceneFogLayer, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= layer.width || y >= layer.height) return false
  const chunk = layer.chunks.find(
    (candidate) =>
      x >= candidate.x &&
      y >= candidate.y &&
      x < candidate.x + candidate.width &&
      y < candidate.y + candidate.height
  )
  if (!chunk) return false
  return bitIsSet(decodeBase64(chunk.data), (y - chunk.y) * chunk.width + x - chunk.x)
}

export function isScenePointExplored(
  state: Pick<EncounterSceneState, 'fogLayers' | 'map'>,
  ownerUserId: string,
  point: ScenePoint
): boolean {
  if (point.x < 0 || point.y < 0 || point.x > state.map.width || point.y > state.map.height) {
    return false
  }
  return state.fogLayers
    .filter((layer) => layer.ownerUserId === null || layer.ownerUserId === ownerUserId)
    .some((layer) => {
      const x = Math.min(layer.width - 1, Math.floor((point.x / state.map.width) * layer.width))
      const y = Math.min(layer.height - 1, Math.floor((point.y / state.map.height) * layer.height))
      return isSceneFogCellExplored(layer, x, y)
    })
}

export function isSceneSegmentExplored(
  state: Pick<EncounterSceneState, 'fogLayers' | 'map'>,
  ownerUserId: string,
  a: ScenePoint,
  b: ScenePoint
): boolean {
  const layers = state.fogLayers.filter(
    (layer) => layer.ownerUserId === null || layer.ownerUserId === ownerUserId
  )
  if (layers.length === 0) return false
  const halfCellX = state.map.width / (Math.max(...layers.map((layer) => layer.width)) * 2)
  const halfCellY = state.map.height / (Math.max(...layers.map((layer) => layer.height)) * 2)
  const steps = Math.max(
    1,
    Math.ceil(
      Math.max(Math.abs(b.x - a.x) / state.map.width, Math.abs(b.y - a.y) / state.map.height) *
        VTT_SCENE_LIMITS.fogCellsPerSide
    )
  )
  for (let index = 0; index <= steps; index += 1) {
    const progress = index / steps
    const point = {
      x: a.x + (b.x - a.x) * progress,
      y: a.y + (b.y - a.y) * progress
    }
    if (
      [
        point,
        { x: point.x - halfCellX, y: point.y },
        { x: point.x + halfCellX, y: point.y },
        { x: point.x, y: point.y - halfCellY },
        { x: point.x, y: point.y + halfCellY }
      ].some((candidate) => isScenePointExplored(state, ownerUserId, candidate))
    ) {
      return true
    }
  }
  return false
}

export function isScenePolygonExplored(
  state: Pick<EncounterSceneState, 'fogLayers' | 'map'>,
  ownerUserId: string,
  polygon: ScenePolygon
): boolean {
  if (polygon.points.length === 0) return false
  const centroid = polygon.points.reduce(
    (point, candidate) => ({ x: point.x + candidate.x, y: point.y + candidate.y }),
    { x: 0, y: 0 }
  )
  if (
    isScenePointExplored(state, ownerUserId, {
      x: centroid.x / polygon.points.length,
      y: centroid.y / polygon.points.length
    })
  ) {
    return true
  }
  return polygon.points.some((point, index) =>
    isSceneSegmentExplored(
      state,
      ownerUserId,
      point,
      polygon.points[(index + 1) % polygon.points.length]!
    )
  )
}
