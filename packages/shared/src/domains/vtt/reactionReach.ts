import { measureSceneTokenFootprintDistance } from './sceneCombatPerception.js'
import { VTT_SCENE_LIMITS, type SceneGrid, type ScenePoint, type SceneToken } from './scene.js'
import type { SpatialMovementKind } from './spatial.js'

const EPSILON = 1e-8
const MAX_BOUNDARY_CANDIDATES_PER_SEGMENT = VTT_SCENE_LIMITS.transientPathPoints

export type ReactionReachStage = 'BEFORE_LEAVE_REACH' | 'ENTER_REACH'

export interface ReactionReachSource {
  readonly reach: number
  readonly reactorTokenId: string
  readonly sourceId: string
  readonly stage: ReactionReachStage
}

export interface ReactionReachCandidate {
  readonly contact: ScenePoint
  readonly movingActorId: string
  /** Euclidean Scene-coordinate progress, deliberately not grid movement cost. */
  readonly pathDistance: number
  readonly reactorActorId: string
  readonly reactorTokenId: string
  readonly sourceId: string
  readonly stage: ReactionReachStage
}

type ReachToken = Pick<SceneToken, 'height' | 'id' | 'position' | 'width'>

type PathCandidate = {
  readonly distance: number
  readonly point: ScenePoint
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function validCoordinate(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= VTT_SCENE_LIMITS.coordinateMagnitude
}

function validPoint(point: ScenePoint): boolean {
  return validCoordinate(point.x) && validCoordinate(point.y)
}

function samePoint(left: ScenePoint, right: ScenePoint): boolean {
  return left.x === right.x && left.y === right.y
}

function validToken(token: ReachToken): boolean {
  return (
    typeof token.id === 'string' &&
    token.id.length > 0 &&
    validPoint(token.position) &&
    Number.isFinite(token.width) &&
    Number.isFinite(token.height) &&
    token.width > 0 &&
    token.height > 0 &&
    token.width <= VTT_SCENE_LIMITS.coordinateMagnitude &&
    token.height <= VTT_SCENE_LIMITS.coordinateMagnitude
  )
}

function validGrid(grid: SceneGrid): boolean {
  if (grid.kind === 'GRIDLESS') return Number.isFinite(grid.pixelsPerUnit) && grid.pixelsPerUnit > 0
  if (grid.kind !== 'SQUARE') return false
  return (
    (grid.diagonalPolicy === 'EQUAL' ||
      grid.diagonalPolicy === 'EUCLIDEAN' ||
      grid.diagonalPolicy === 'ALTERNATING') &&
    Number.isFinite(grid.cellSize) &&
    grid.cellSize > 0 &&
    Number.isFinite(grid.distancePerCell) &&
    grid.distancePerCell > 0 &&
    validPoint(grid.origin)
  )
}

function validMovementKind(value: unknown): value is SpatialMovementKind {
  return value === 'VOLUNTARY' || value === 'FORCED' || value === 'TELEPORT'
}

function interpolate(from: ScenePoint, to: ScenePoint, progress: number): ScenePoint {
  return { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress }
}

function segmentLength(from: ScenePoint, to: ScenePoint): number {
  return Math.hypot(to.x - from.x, to.y - from.y)
}

function pathPointAtDistance(path: readonly ScenePoint[], distance: number): ScenePoint | null {
  let remaining = distance
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1]!
    const to = path[index]!
    const length = segmentLength(from, to)
    if (length <= EPSILON) continue
    if (remaining <= length + EPSILON)
      return interpolate(from, to, Math.max(0, Math.min(1, remaining / length)))
    remaining -= length
  }
  return remaining <= EPSILON ? (path.at(-1) ?? null) : null
}

function uniqueTimes(times: readonly number[]): number[] {
  return times
    .filter((time) => Number.isFinite(time) && time >= -EPSILON && time <= 1 + EPSILON)
    .map((time) => Math.max(0, Math.min(1, time)))
    .sort((left, right) => left - right)
    .filter((time, index, values) => index === 0 || Math.abs(time - values[index - 1]!) > EPSILON)
}

function lineCircleTimes(
  from: ScenePoint,
  to: ScenePoint,
  center: ScenePoint,
  radius: number
): number[] {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const ox = from.x - center.x
  const oy = from.y - center.y
  const a = dx * dx + dy * dy
  if (a <= EPSILON) return []
  const b = 2 * (ox * dx + oy * dy)
  const c = ox * ox + oy * oy - radius * radius
  const discriminant = b * b - 4 * a * c
  if (discriminant < -EPSILON) return []
  const root = Math.sqrt(Math.max(0, discriminant))
  return [(-b - root) / (2 * a), (-b + root) / (2 * a)]
}

/** Exact rounded-rectangle boundary times for full rectangular footprint reach in GRIDLESS Scenes. */
function gridlessBoundaryTimes(
  from: ScenePoint,
  to: ScenePoint,
  reactor: ReachToken,
  moving: ReachToken,
  reachPixels: number
): number[] {
  const halfWidth = (reactor.width + moving.width) / 2
  const halfHeight = (reactor.height + moving.height) / 2
  const minX = reactor.position.x - halfWidth
  const maxX = reactor.position.x + halfWidth
  const minY = reactor.position.y - halfHeight
  const maxY = reactor.position.y + halfHeight
  const dx = to.x - from.x
  const dy = to.y - from.y
  const times = [0, 1]

  for (const x of [minX - reachPixels, maxX + reachPixels]) {
    if (Math.abs(dx) <= EPSILON) continue
    const time = (x - from.x) / dx
    const y = from.y + dy * time
    if (y >= minY - EPSILON && y <= maxY + EPSILON) times.push(time)
  }
  for (const y of [minY - reachPixels, maxY + reachPixels]) {
    if (Math.abs(dy) <= EPSILON) continue
    const time = (y - from.y) / dy
    const x = from.x + dx * time
    if (x >= minX - EPSILON && x <= maxX + EPSILON) times.push(time)
  }
  for (const x of [minX, maxX])
    for (const y of [minY, maxY]) times.push(...lineCircleTimes(from, to, { x, y }, reachPixels))
  return uniqueTimes(times)
}

/**
 * Exact grid-cell transition times. Only distances which can possibly satisfy the reach predicate
 * are enumerated; the values are the actual `Math.round` half-cell boundaries used by the shared
 * Scene distance function, never arbitrary samples.
 */
function squareBoundaryTimes(
  from: ScenePoint,
  to: ScenePoint,
  reactor: ReachToken,
  moving: ReachToken,
  grid: Extract<SceneGrid, { kind: 'SQUARE' }>,
  reach: number
): number[] | null {
  const maximumRelevantCells = Math.floor(reach / grid.distancePerCell)
  if (!Number.isSafeInteger(maximumRelevantCells) || maximumRelevantCells < 0) return []
  const times = [0, 1]
  let thresholdCount = 0
  const addAxisTimes = (
    fromCoordinate: number,
    toCoordinate: number,
    reactorCoordinate: number,
    reactorSize: number,
    movingSize: number
  ): boolean => {
    const delta = toCoordinate - fromCoordinate
    if (Math.abs(delta) <= EPSILON) return true
    const leftBoundary = reactorCoordinate - (reactorSize + movingSize) / 2
    const rightBoundary = reactorCoordinate + (reactorSize + movingSize) / 2
    const minimumCoordinate = Math.min(fromCoordinate, toCoordinate)
    const maximumCoordinate = Math.max(fromCoordinate, toCoordinate)
    const addThresholdRange = (
      minimumCells: number,
      maximumCells: number,
      coordinateAt: (cells: number) => number
    ): boolean => {
      const first = Math.max(0, Math.ceil(minimumCells - EPSILON))
      const last = Math.min(maximumRelevantCells, Math.floor(maximumCells + EPSILON))
      if (first > last) return true
      thresholdCount += last - first + 1
      if (thresholdCount > MAX_BOUNDARY_CANDIDATES_PER_SEGMENT) return false
      for (let cells = first; cells <= last; cells += 1) {
        const coordinate = coordinateAt(cells)
        const time = (coordinate - fromCoordinate) / delta
        if (time >= -EPSILON && time <= 1 + EPSILON) times.push(time)
      }
      return true
    }
    const leftMinimumCells = (leftBoundary - maximumCoordinate) / grid.cellSize - 0.5
    const leftMaximumCells = (leftBoundary - minimumCoordinate) / grid.cellSize - 0.5
    const rightMinimumCells = (minimumCoordinate - rightBoundary) / grid.cellSize - 0.5
    const rightMaximumCells = (maximumCoordinate - rightBoundary) / grid.cellSize - 0.5
    return (
      addThresholdRange(
        leftMinimumCells,
        leftMaximumCells,
        (cells) => leftBoundary - (cells + 0.5) * grid.cellSize
      ) &&
      addThresholdRange(
        rightMinimumCells,
        rightMaximumCells,
        (cells) => rightBoundary + (cells + 0.5) * grid.cellSize
      )
    )
  }
  if (
    !addAxisTimes(from.x, to.x, reactor.position.x, reactor.width, moving.width) ||
    !addAxisTimes(from.y, to.y, reactor.position.y, reactor.height, moving.height)
  )
    return null
  return uniqueTimes(times)
}

function pathBoundaryCandidates(
  path: readonly ScenePoint[],
  reactor: ReachToken,
  moving: ReachToken,
  grid: SceneGrid,
  reach: number
): PathCandidate[] | null {
  const candidates: PathCandidate[] = []
  let pathDistance = 0
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1]!
    const to = path[index]!
    const length = segmentLength(from, to)
    if (length <= EPSILON) continue
    const times =
      grid.kind === 'GRIDLESS'
        ? gridlessBoundaryTimes(from, to, reactor, moving, reach * grid.pixelsPerUnit)
        : squareBoundaryTimes(from, to, reactor, moving, grid, reach)
    if (!times) return null
    for (const time of times)
      candidates.push({
        distance: pathDistance + length * time,
        point: interpolate(from, to, time)
      })
    pathDistance += length
  }
  return candidates
    .sort((left, right) => left.distance - right.distance)
    .filter(
      (candidate, index, all) =>
        index === 0 || Math.abs(candidate.distance - all[index - 1]!.distance) > EPSILON
    )
}

function withinReach(
  grid: SceneGrid,
  reactor: ReachToken,
  moving: ReachToken,
  position: ScenePoint,
  reach: number
): boolean {
  return (
    measureSceneTokenFootprintDistance(grid, reactor, { ...moving, position }) <= reach + EPSILON
  )
}

function movementCandidates(input: {
  readonly movingActorId: string
  readonly grid: SceneGrid
  readonly moving: ReachToken
  readonly path: readonly ScenePoint[]
  readonly reactor: ReachToken
  readonly reactorActorId: string
  readonly source: ReactionReachSource
}): ReactionReachCandidate[] {
  const boundaries = pathBoundaryCandidates(
    input.path,
    input.reactor,
    input.moving,
    input.grid,
    input.source.reach
  )
  if (!boundaries) return []
  const candidates: ReactionReachCandidate[] = []
  for (let index = 0; index < boundaries.length; index += 1) {
    const boundary = boundaries[index]!
    const prior = boundaries[index - 1]
    const next = boundaries[index + 1]
    const beforePoint = prior
      ? pathPointAtDistance(input.path, (prior.distance + boundary.distance) / 2)
      : boundary.point
    const afterPoint = next
      ? pathPointAtDistance(input.path, (boundary.distance + next.distance) / 2)
      : boundary.point
    if (!beforePoint || !afterPoint) continue
    const before = withinReach(
      input.grid,
      input.reactor,
      input.moving,
      beforePoint,
      input.source.reach
    )
    const after = withinReach(
      input.grid,
      input.reactor,
      input.moving,
      afterPoint,
      input.source.reach
    )
    const matchesStage =
      (input.source.stage === 'ENTER_REACH' && !before && after) ||
      (input.source.stage === 'BEFORE_LEAVE_REACH' && before && !after)
    if (!matchesStage) continue
    candidates.push({
      contact: boundary.point,
      movingActorId: input.movingActorId,
      pathDistance: boundary.distance,
      reactorActorId: input.reactorActorId,
      reactorTokenId: input.reactor.id,
      sourceId: input.source.sourceId,
      stage: input.source.stage
    })
  }
  return candidates
}

function teleportCandidate(input: {
  readonly movingActorId: string
  readonly grid: SceneGrid
  readonly moving: ReachToken
  readonly path: readonly ScenePoint[]
  readonly reactor: ReachToken
  readonly reactorActorId: string
  readonly source: ReactionReachSource
}): ReactionReachCandidate[] {
  const [origin, destination] = input.path
  if (!origin || !destination) return []
  const originWithin = withinReach(
    input.grid,
    input.reactor,
    input.moving,
    origin,
    input.source.reach
  )
  const destinationWithin = withinReach(
    input.grid,
    input.reactor,
    input.moving,
    destination,
    input.source.reach
  )
  const isExit = input.source.stage === 'BEFORE_LEAVE_REACH' && originWithin && !destinationWithin
  const isEnter = input.source.stage === 'ENTER_REACH' && !originWithin && destinationWithin
  if (!isExit && !isEnter) return []
  return [
    {
      contact: isExit ? origin : destination,
      movingActorId: input.movingActorId,
      pathDistance: isExit ? 0 : segmentLength(origin, destination),
      reactorActorId: input.reactorActorId,
      reactorTokenId: input.reactor.id,
      sourceId: input.source.sourceId,
      stage: input.source.stage
    }
  ]
}

/**
 * Collects pure full-footprint reach contacts. It intentionally does not determine reaction
 * eligibility, perception, resources, or execute an action.
 */
export function collectReactionReachCandidates(input: {
  readonly actorIdByTokenId: ReadonlyMap<string, string>
  readonly grid: SceneGrid
  readonly movementKind: SpatialMovementKind
  readonly movingTokenId: string
  readonly path: readonly ScenePoint[]
  readonly sources: readonly ReactionReachSource[]
  readonly tokens: readonly ReachToken[]
}): ReactionReachCandidate[] {
  const tokenIds = new Set(input.tokens.map((token) => token.id))
  const sourceIds = new Set(input.sources.map((source) => source.sourceId))
  const moving = input.tokens.find((token) => token.id === input.movingTokenId)
  if (
    !validGrid(input.grid) ||
    !validMovementKind(input.movementKind) ||
    !moving ||
    !input.actorIdByTokenId.get(moving.id) ||
    !validToken(moving) ||
    tokenIds.size !== input.tokens.length ||
    sourceIds.size !== input.sources.length ||
    input.path.length < 2 ||
    !input.path.every(validPoint) ||
    !samePoint(input.path[0]!, moving.position) ||
    input.tokens.some((token) => !validToken(token)) ||
    input.sources.some(
      (source) =>
        typeof source.sourceId !== 'string' ||
        source.sourceId.length === 0 ||
        typeof source.reactorTokenId !== 'string' ||
        source.reactorTokenId.length === 0 ||
        !Number.isFinite(source.reach) ||
        source.reach < 0 ||
        (source.stage !== 'BEFORE_LEAVE_REACH' && source.stage !== 'ENTER_REACH')
    ) ||
    (input.movementKind === 'TELEPORT' && input.path.length !== 2)
  )
    return []

  const candidates: ReactionReachCandidate[] = []
  for (const source of input.sources) {
    const reactor = input.tokens.find((token) => token.id === source.reactorTokenId)
    if (!reactor || !input.actorIdByTokenId.get(reactor.id)) return []
    if (
      reactor.id === moving.id ||
      input.actorIdByTokenId.get(reactor.id) === input.actorIdByTokenId.get(moving.id)
    )
      continue
    const sourceCandidates =
      input.movementKind === 'TELEPORT'
        ? teleportCandidate({
            grid: input.grid,
            moving,
            movingActorId: input.actorIdByTokenId.get(moving.id)!,
            path: input.path,
            reactor,
            reactorActorId: input.actorIdByTokenId.get(reactor.id)!,
            source
          })
        : movementCandidates({
            grid: input.grid,
            moving,
            movingActorId: input.actorIdByTokenId.get(moving.id)!,
            path: input.path,
            reactor,
            reactorActorId: input.actorIdByTokenId.get(reactor.id)!,
            source
          })
    candidates.push(...sourceCandidates)
  }
  return candidates.sort(
    (left, right) =>
      left.pathDistance - right.pathDistance ||
      compareText(left.sourceId, right.sourceId) ||
      compareText(left.reactorTokenId, right.reactorTokenId) ||
      compareText(left.stage, right.stage)
  )
}
