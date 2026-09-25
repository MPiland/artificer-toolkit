import polygonClipping, { type MultiPolygon } from 'polygon-clipping'
import RBush from 'rbush'
import { orient2d } from 'robust-predicates'

import { segmentsIntersect } from './segments.js'

import {
  VTT_SCENE_LIMITS,
  type CampaignSceneState,
  type SceneBarrier,
  type SceneDoorState,
  type SceneGrid,
  type SceneLight,
  type ScenePoint,
  type ScenePolygon,
  type SceneTokenVision
} from './scene.js'

const EPSILON = 1e-9
const RAY_ANGLE_OFFSET = 1e-7
const FULL_CIRCLE_RAY_COUNT = 64
const CONE_RAY_COUNT = 32

interface IndexedBarrier {
  barrier: SceneBarrier
  maxX: number
  maxY: number
  minX: number
  minY: number
}

function bounds(a: ScenePoint, b: ScenePoint) {
  return {
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y),
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y)
  }
}

export { segmentsIntersect } from './segments.js'

export class SceneBarrierIndex {
  readonly #tree = new RBush<IndexedBarrier>()

  constructor(barriers: readonly SceneBarrier[]) {
    this.#tree.load(barriers.map((barrier) => ({ barrier, ...bounds(barrier.a, barrier.b) })))
  }

  search(a: ScenePoint, b: ScenePoint): SceneBarrier[] {
    return this.#tree.search(bounds(a, b)).map((entry) => entry.barrier)
  }

  searchWithin(searchBounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }): SceneBarrier[] {
    return this.#tree.search(searchBounds).map((entry) => entry.barrier)
  }
}

function closedDoor(
  barrier: Extract<SceneBarrier, { kind: 'DOOR' }>,
  doorStates: Readonly<Record<string, SceneDoorState>>
): boolean {
  return (doorStates[barrier.id] ?? barrier.initialState) !== 'OPEN'
}

function crossesBlockedOneWay(
  from: ScenePoint,
  to: ScenePoint,
  barrier: Extract<SceneBarrier, { kind: 'ONE_WAY' }>
): boolean {
  const fromSide = orient2d(barrier.a.x, barrier.a.y, barrier.b.x, barrier.b.y, from.x, from.y)
  const toSide = orient2d(barrier.a.x, barrier.a.y, barrier.b.x, barrier.b.y, to.x, to.y)
  return barrier.blockedDirection === 'LEFT_TO_RIGHT'
    ? fromSide > 0 && toSide < 0
    : fromSide < 0 && toSide > 0
}

function footprintSideBounds(
  position: ScenePoint,
  width: number,
  height: number,
  barrier: Extract<SceneBarrier, { kind: 'ONE_WAY' }>
): { max: number; min: number } {
  const center = orient2d(
    barrier.a.x,
    barrier.a.y,
    barrier.b.x,
    barrier.b.y,
    position.x,
    position.y
  )
  const halfSpan =
    (Math.abs(barrier.b.y - barrier.a.y) * width + Math.abs(barrier.b.x - barrier.a.x) * height) / 2
  return { max: center + halfSpan, min: center - halfSpan }
}

function footprintCrossesBlockedOneWay(
  from: ScenePoint,
  to: ScenePoint,
  width: number,
  height: number,
  barrier: Extract<SceneBarrier, { kind: 'ONE_WAY' }>
): boolean {
  const fromBounds = footprintSideBounds(from, width, height, barrier)
  const toBounds = footprintSideBounds(to, width, height, barrier)
  const fromCenter = (fromBounds.min + fromBounds.max) / 2
  const toCenter = (toBounds.min + toBounds.max) / 2
  return barrier.blockedDirection === 'LEFT_TO_RIGHT'
    ? toCenter < fromCenter && fromBounds.max > 0 && toBounds.min < 0
    : toCenter > fromCenter && fromBounds.min < 0 && toBounds.max > 0
}

function convexHull(points: readonly ScenePoint[]): ScenePoint[] {
  const sorted = [...points].sort((left, right) => left.x - right.x || left.y - right.y)
  const cross = (origin: ScenePoint, a: ScenePoint, b: ScenePoint) =>
    (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x)
  const lower: ScenePoint[] = []
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, point) <= 0) lower.pop()
    lower.push(point)
  }
  const upper: ScenePoint[] = []
  for (const point of [...sorted].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, point) <= 0) upper.pop()
    upper.push(point)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

function segmentIntersectsConvexPolygonInterior(
  from: ScenePoint,
  to: ScenePoint,
  polygon: readonly ScenePoint[]
): boolean {
  const centroid = polygon.reduce(
    (total, point) => ({
      x: total.x + point.x / polygon.length,
      y: total.y + point.y / polygon.length
    }),
    { x: 0, y: 0 }
  )
  let lower = 0
  let upper = 1
  for (let index = 0; index < polygon.length; index += 1) {
    const edgeFrom = polygon[index]!
    const edgeTo = polygon[(index + 1) % polygon.length]!
    const interiorSign = Math.sign(
      orient2d(edgeFrom.x, edgeFrom.y, edgeTo.x, edgeTo.y, centroid.x, centroid.y)
    )
    const start =
      interiorSign * orient2d(edgeFrom.x, edgeFrom.y, edgeTo.x, edgeTo.y, from.x, from.y)
    const end = interiorSign * orient2d(edgeFrom.x, edgeFrom.y, edgeTo.x, edgeTo.y, to.x, to.y)
    const slope = end - start
    if (slope === 0) {
      if (start <= 0) return false
      continue
    }
    const boundary = -start / slope
    if (slope > 0) lower = Math.max(lower, boundary)
    else upper = Math.min(upper, boundary)
  }
  return lower < upper && lower < 1 && upper > 0
}

function sweptFootprintIntersectsBarrier(
  from: ScenePoint,
  to: ScenePoint,
  width: number,
  height: number,
  barrier: SceneBarrier
): boolean {
  const halfWidth = width / 2
  const halfHeight = height / 2
  const expandedBarrier = convexHull(
    [barrier.a, barrier.b].flatMap((point) => [
      { x: point.x - halfWidth, y: point.y - halfHeight },
      { x: point.x + halfWidth, y: point.y - halfHeight },
      { x: point.x + halfWidth, y: point.y + halfHeight },
      { x: point.x - halfWidth, y: point.y + halfHeight }
    ])
  )
  return segmentIntersectsConvexPolygonInterior(from, to, expandedBarrier)
}

export function movementCrossesBlockingBarrier(
  from: ScenePoint,
  to: ScenePoint,
  barrier: SceneBarrier,
  doorStates: Readonly<Record<string, SceneDoorState>>
): boolean {
  if (!segmentsIntersect(from, to, barrier.a, barrier.b)) return false
  switch (barrier.kind) {
    case 'WALL':
    case 'WINDOW':
      return barrier.blocksMovement
    case 'DOOR':
      return barrier.blocksMovementWhenClosed && closedDoor(barrier, doorStates)
    case 'ONE_WAY':
      return barrier.blocksMovement && crossesBlockedOneWay(from, to, barrier)
    case 'TERRAIN':
      return false
  }
}

export function canMoveBetween(
  state: Pick<CampaignSceneState, 'barriers' | 'doorStates'>,
  from: ScenePoint,
  to: ScenePoint,
  index = new SceneBarrierIndex(state.barriers)
): boolean {
  return !index
    .search(from, to)
    .some((barrier) => movementCrossesBlockingBarrier(from, to, barrier, state.doorStates))
}

/** Tests a translating axis-aligned token footprint against the authoritative movement barriers. */
export function canTokenFootprintMoveBetween(
  state: Pick<CampaignSceneState, 'barriers' | 'doorStates'>,
  from: ScenePoint,
  to: ScenePoint,
  footprint: { readonly width: number; readonly height: number },
  index = new SceneBarrierIndex(state.barriers)
): boolean {
  const halfWidth = footprint.width / 2
  const halfHeight = footprint.height / 2
  const candidates = index.searchWithin({
    maxX: Math.max(from.x, to.x) + halfWidth,
    maxY: Math.max(from.y, to.y) + halfHeight,
    minX: Math.min(from.x, to.x) - halfWidth,
    minY: Math.min(from.y, to.y) - halfHeight
  })
  return !candidates.some((barrier) => {
    if (!sweptFootprintIntersectsBarrier(from, to, footprint.width, footprint.height, barrier))
      return false
    switch (barrier.kind) {
      case 'WALL':
      case 'WINDOW':
        return barrier.blocksMovement
      case 'DOOR':
        return barrier.blocksMovementWhenClosed && closedDoor(barrier, state.doorStates)
      case 'ONE_WAY':
        return (
          barrier.blocksMovement &&
          footprintCrossesBlockedOneWay(from, to, footprint.width, footprint.height, barrier)
        )
      case 'TERRAIN':
        return false
    }
  })
}

/**
 * Append one accepted drag position while removing redundant straight-line samples. The path
 * retains every required corner, so the authoritative command can validate the route without
 * storing pointer-event noise.
 */
export function extendSceneMovementPath(
  state: Pick<CampaignSceneState, 'barriers' | 'doorStates'>,
  path: readonly ScenePoint[],
  position: ScenePoint,
  index = new SceneBarrierIndex(state.barriers)
): ScenePoint[] {
  const last = path.at(-1)
  if (!last) return [position]
  if (last.x === position.x && last.y === position.y) return [...path]
  if (!canMoveBetween(state, last, position, index)) return [...path]

  const prior = path.at(-2)
  if (prior && canMoveBetween(state, prior, position, index)) {
    return [...path.slice(0, -1), position]
  }
  if (path.length >= VTT_SCENE_LIMITS.transientPathPoints) return [...path]
  return [...path, position]
}

export function isSceneMovementPathValid(
  state: Pick<CampaignSceneState, 'barriers' | 'doorStates'>,
  path: readonly ScenePoint[],
  index = new SceneBarrierIndex(state.barriers)
): boolean {
  return path.every(
    (point, pathIndex) =>
      pathIndex === 0 || canMoveBetween(state, path[pathIndex - 1]!, point, index)
  )
}

/** Returns the canonical movement failure for callers that own their error boundary. */
export function sceneTokenMovementFailure(
  state: Pick<CampaignSceneState, 'map' | 'tokens' | 'barriers' | 'doorStates'>,
  tokenId: string,
  position: ScenePoint,
  path: readonly ScenePoint[]
): string | null {
  const token = state.tokens.find((candidate) => candidate.id === tokenId)
  if (!token || token.locked) return 'The token is missing or locked.'
  const first = path[0]
  const last = path.at(-1)
  if (
    !first ||
    !last ||
    first.x !== token.position.x ||
    first.y !== token.position.y ||
    last.x !== position.x ||
    last.y !== position.y
  )
    return 'Token movement must follow a path from its current position.'
  for (const point of path) {
    if (point.x < 0 || point.y < 0 || point.x > state.map.width || point.y > state.map.height)
      return 'Token movement must remain within the map bounds.'
  }
  const index = new SceneBarrierIndex(state.barriers)
  for (let pathIndex = 1; pathIndex < path.length; pathIndex += 1) {
    if (!canMoveBetween(state, path[pathIndex - 1]!, path[pathIndex]!, index))
      return 'Token movement crosses a blocking barrier.'
  }
  return null
}

/** Anyone may open or close an unlocked door; locking and unlocking stay with the GM (ADR 0034). */
export function sceneDoorChangeFailure(
  actorIsGm: boolean,
  current: SceneDoorState | undefined,
  next: SceneDoorState
): string | null {
  if (actorIsGm || (current !== 'LOCKED' && next !== 'LOCKED')) return null
  return 'Only the GM can lock or unlock doors.'
}

export function lightCrossesBlockingBarrier(
  from: ScenePoint,
  to: ScenePoint,
  barrier: SceneBarrier,
  doorStates: Readonly<Record<string, SceneDoorState>>
): boolean {
  return segmentsIntersect(from, to, barrier.a, barrier.b) && blocksLight(barrier, doorStates)
}

function blocksLight(
  barrier: SceneBarrier,
  doorStates: Readonly<Record<string, SceneDoorState>>
): boolean {
  switch (barrier.kind) {
    case 'WALL':
    case 'WINDOW':
    case 'ONE_WAY':
      return barrier.blocksLight
    case 'DOOR':
      return barrier.blocksLightWhenClosed && closedDoor(barrier, doorStates)
    case 'TERRAIN':
      return false
  }
}

export function canLightPassBetween(
  state: Pick<CampaignSceneState, 'barriers' | 'doorStates'>,
  from: ScenePoint,
  to: ScenePoint,
  index = new SceneBarrierIndex(state.barriers)
): boolean {
  return !index
    .search(from, to)
    .some((barrier) => lightCrossesBlockingBarrier(from, to, barrier, state.doorStates))
}

/** Inclusive point-in-polygon predicate for authoritative Scene zones. */
export function scenePointInPolygon(point: ScenePoint, polygon: ScenePolygon): boolean {
  let inside = false
  for (let index = 0; index < polygon.points.length; index += 1) {
    const from = polygon.points[index]!
    const to = polygon.points[(index + 1) % polygon.points.length]!
    if (segmentsIntersect(point, point, from, to)) return true
    if (from.y > point.y === to.y > point.y) continue
    const crossing = ((to.x - from.x) * (point.y - from.y)) / (to.y - from.y) + from.x
    if (point.x <= crossing) inside = !inside
  }
  return inside
}

function visibleOccludersWithinRange(
  origin: ScenePoint,
  maximum: number,
  index: SceneBarrierIndex,
  doorStates: Readonly<Record<string, SceneDoorState>>
): SceneBarrier[] {
  return index
    .search(
      { x: origin.x - maximum, y: origin.y - maximum },
      { x: origin.x + maximum, y: origin.y + maximum }
    )
    .filter((barrier) => blocksLight(barrier, doorStates))
}

function raySegmentIntersection(
  origin: ScenePoint,
  angle: number,
  a: ScenePoint,
  b: ScenePoint,
  maximum: number
): ScenePoint | null {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const sx = b.x - a.x
  const sy = b.y - a.y
  const denominator = dx * sy - dy * sx
  if (Math.abs(denominator) < EPSILON) return null
  const ox = a.x - origin.x
  const oy = a.y - origin.y
  const distance = (ox * sy - oy * sx) / denominator
  const segment = (ox * dy - oy * dx) / denominator
  if (distance < 0 || distance > maximum || segment < 0 || segment > 1) return null
  return { x: origin.x + dx * distance, y: origin.y + dy * distance }
}

export function visibilityPolygon(
  origin: ScenePoint,
  maximum: number,
  barriers: readonly SceneBarrier[],
  doorStates: Readonly<Record<string, SceneDoorState>>,
  index = new SceneBarrierIndex(barriers)
): ScenePolygon {
  const occluders = visibleOccludersWithinRange(origin, maximum, index, doorStates)
  const boundaryAngles = Array.from(
    { length: FULL_CIRCLE_RAY_COUNT },
    (_, index) => (index / FULL_CIRCLE_RAY_COUNT) * Math.PI * 2
  )
  const angles = [
    ...boundaryAngles,
    ...occluders.flatMap((barrier) =>
      [barrier.a, barrier.b].flatMap((point) => {
        const angle = Math.atan2(point.y - origin.y, point.x - origin.x)
        return [angle - RAY_ANGLE_OFFSET, angle, angle + RAY_ANGLE_OFFSET]
      })
    )
  ]
  const points = [...new Set(angles)]
    .sort((left, right) => left - right)
    .map((angle) => visibleRayEndpoint(origin, angle, maximum, index, doorStates))
  return { points }
}

function visibleRayEndpoint(
  origin: ScenePoint,
  angle: number,
  maximum: number,
  index: SceneBarrierIndex,
  doorStates: Readonly<Record<string, SceneDoorState>>
): ScenePoint {
  let nearest: ScenePoint = {
    x: origin.x + Math.cos(angle) * maximum,
    y: origin.y + Math.sin(angle) * maximum
  }
  let nearestDistance = maximum
  for (const barrier of index
    .search(origin, nearest)
    .filter((candidate) => blocksLight(candidate, doorStates))) {
    const hit = raySegmentIntersection(origin, angle, barrier.a, barrier.b, maximum)
    if (!hit) continue
    const distance = Math.hypot(hit.x - origin.x, hit.y - origin.y)
    if (distance < nearestDistance) {
      nearest = hit
      nearestDistance = distance
    }
  }
  return nearest
}

function normalizeRadians(angle: number): number {
  const fullCircle = Math.PI * 2
  return ((angle % fullCircle) + fullCircle) % fullCircle
}

function signedAngleOffset(angle: number, center: number): number {
  const fullCircle = Math.PI * 2
  return ((((angle - center + Math.PI) % fullCircle) + fullCircle) % fullCircle) - Math.PI
}

/** Resolve the visible area of a point or directional cone light against the same barrier rules. */
export function visibilityPolygonForLight(
  light: SceneLight,
  barriers: readonly SceneBarrier[],
  doorStates: Readonly<Record<string, SceneDoorState>>,
  index = new SceneBarrierIndex(barriers)
): ScenePolygon {
  const maximum = Math.max(light.brightRadius, light.dimRadius)
  if (light.kind === 'POINT' || light.angleDegrees >= 360) {
    return visibilityPolygon(light.position, maximum, barriers, doorStates, index)
  }

  const direction = (light.directionDegrees * Math.PI) / 180
  const halfAngle = (light.angleDegrees * Math.PI) / 360
  const occluders = visibleOccludersWithinRange(light.position, maximum, index, doorStates)
  const sampledOffsets = Array.from(
    { length: CONE_RAY_COUNT + 1 },
    (_, index) => -halfAngle + (index / CONE_RAY_COUNT) * halfAngle * 2
  )
  const endpointOffsets = occluders.flatMap((barrier) =>
    [barrier.a, barrier.b].flatMap((point) => {
      const offset = signedAngleOffset(
        Math.atan2(point.y - light.position.y, point.x - light.position.x),
        direction
      )
      if (Math.abs(offset) > halfAngle + RAY_ANGLE_OFFSET) return []
      return [offset - RAY_ANGLE_OFFSET, offset, offset + RAY_ANGLE_OFFSET].filter(
        (candidate) => Math.abs(candidate) <= halfAngle
      )
    })
  )
  const rays = [...new Set([...sampledOffsets, ...endpointOffsets])]
    .sort((left, right) => left - right)
    .map((offset) =>
      visibleRayEndpoint(
        light.position,
        normalizeRadians(direction + offset),
        maximum,
        index,
        doorStates
      )
    )
  return { points: [light.position, ...rays] }
}

/** Resolve a token's full-circle or directional sight polygon against light-blocking barriers. */
export function visibilityPolygonForToken(
  position: ScenePoint,
  vision: SceneTokenVision,
  barriers: readonly SceneBarrier[],
  doorStates: Readonly<Record<string, SceneDoorState>>,
  index = new SceneBarrierIndex(barriers)
): ScenePolygon | null {
  if (!vision.enabled) return null
  const maximum = Math.max(vision.brightRange, vision.dimRange)
  if (maximum <= 0) return null
  return visibilityPolygonForLight(
    vision.angleDegrees >= 360
      ? {
          brightRadius: vision.brightRange,
          color: '#ffffff',
          dimRadius: vision.dimRange,
          id: 'TOKEN_VISION',
          intensity: 1,
          kind: 'POINT',
          position
        }
      : {
          angleDegrees: vision.angleDegrees,
          brightRadius: vision.brightRange,
          color: '#ffffff',
          dimRadius: vision.dimRange,
          directionDegrees: vision.directionDegrees,
          id: 'TOKEN_VISION',
          intensity: 1,
          kind: 'CONE',
          position
        },
    barriers,
    doorStates,
    index
  )
}

export function measureSceneDistance(grid: SceneGrid, from: ScenePoint, to: ScenePoint): number {
  const deltaX = Math.abs(to.x - from.x)
  const deltaY = Math.abs(to.y - from.y)
  if (grid.kind === 'GRIDLESS') return Math.hypot(deltaX, deltaY) / grid.pixelsPerUnit
  const horizontal = Math.round(deltaX / grid.cellSize)
  const vertical = Math.round(deltaY / grid.cellSize)
  if (grid.diagonalPolicy === 'EUCLIDEAN') {
    return Math.hypot(horizontal, vertical) * grid.distancePerCell
  }
  const diagonals = Math.min(horizontal, vertical)
  const straight = Math.max(horizontal, vertical) - diagonals
  const cells =
    grid.diagonalPolicy === 'EQUAL'
      ? diagonals + straight
      : diagonals + Math.floor(diagonals / 2) + straight
  return cells * grid.distancePerCell
}

export function measureScenePathDistance(grid: SceneGrid, path: readonly ScenePoint[]): number {
  if (grid.kind !== 'SQUARE' || grid.diagonalPolicy !== 'ALTERNATING') {
    let distance = 0
    for (let index = 1; index < path.length; index += 1) {
      distance += measureSceneDistance(grid, path[index - 1]!, path[index]!)
    }
    return distance
  }

  let diagonals = 0
  let straight = 0
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1]!
    const to = path[index]!
    const horizontal = Math.round(Math.abs(to.x - from.x) / grid.cellSize)
    const vertical = Math.round(Math.abs(to.y - from.y) / grid.cellSize)
    const segmentDiagonals = Math.min(horizontal, vertical)
    diagonals += segmentDiagonals
    straight += Math.max(horizontal, vertical) - segmentDiagonals
  }
  return (diagonals + Math.floor(diagonals / 2) + straight) * grid.distancePerCell
}

/** Terrain segments do not block movement; the highest crossed multiplier controls its cost. */
export function terrainMovementMultiplier(
  state: { readonly barriers: readonly SceneBarrier[] },
  from: ScenePoint,
  to: ScenePoint,
  index = new SceneBarrierIndex(state.barriers)
): number {
  return index
    .search(from, to)
    .reduce(
      (multiplier, barrier) =>
        barrier.kind === 'TERRAIN' && segmentsIntersect(from, to, barrier.a, barrier.b)
          ? Math.max(multiplier, barrier.movementCostMultiplier)
          : multiplier,
      1
    )
}

export function measureSceneMovementCost(
  grid: SceneGrid,
  state: { readonly barriers: readonly SceneBarrier[] },
  from: ScenePoint,
  to: ScenePoint,
  index = new SceneBarrierIndex(state.barriers)
): number {
  return measureSceneDistance(grid, from, to) * terrainMovementMultiplier(state, from, to, index)
}

function toMultiPolygon(polygon: ScenePolygon): MultiPolygon {
  return [[polygon.points.map((point) => [point.x, point.y])]]
}

export function unionScenePolygons(polygons: readonly ScenePolygon[]): MultiPolygon {
  if (polygons.length === 0) return []
  const [first, ...rest] = polygons
  if (!first) return []
  return polygonClipping.union(toMultiPolygon(first), ...rest.map(toMultiPolygon))
}
