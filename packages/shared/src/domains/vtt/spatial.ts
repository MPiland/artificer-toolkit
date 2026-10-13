import type { LengthUnitCode } from '../core/measurement.js'
import { sceneDistanceAsCoordinateLength } from './geometry.js'
import { lengthMeasurementInSceneUnits } from './sceneReducer.js'
import { segmentsIntersect } from './segments.js'
import {
  VTT_SCENE_LIMITS,
  VTT_SPATIAL_LIMITS,
  type SceneGrid,
  type ScenePoint,
  type SceneToken
} from './scene.js'

export { VTT_SPATIAL_LIMITS } from './scene.js'

const EPSILON = 1e-8

export type SpatialAnchorKind = 'FIXED' | 'TOKEN'
type SpatialGeometryFrame = 'SCENE_ABSOLUTE' | 'TOKEN_LOCAL'
export type SpatialMovementKind = 'VOLUNTARY' | 'FORCED' | 'TELEPORT'
export type SpatialTriggerMode = 'ENTER' | 'EXIT' | 'CROSS'

type SpatialGeometry =
  | {
      readonly kind: 'CIRCLE'
      readonly center: ScenePoint
      readonly radius: number
    }
  | { readonly kind: 'POLYGON'; readonly points: readonly ScenePoint[] }

export interface SpatialPersistedGeometry {
  readonly frame: SpatialGeometryFrame
  readonly shape: SpatialGeometry
}

/** A system-neutral spatial instance after its source has been resolved. */
export interface SpatialEffectInstance {
  readonly effectId: string
  readonly sourceActorId: string | null
  readonly sourceTokenId: string | null
  readonly anchorKind: SpatialAnchorKind
  readonly geometry: SpatialPersistedGeometry
  readonly triggerModes: readonly SpatialTriggerMode[]
  readonly movementKinds: readonly SpatialMovementKind[]
}

export type SpatialSceneToken = Pick<SceneToken, 'height' | 'id' | 'position' | 'width'>

export interface SpatialMovementCandidate {
  /**
   * The authoritative mover path position at pathDistance. sourceMoved records that the moving
   * token was also the TOKEN-anchored effect source; it does not create a second contact point.
   */
  readonly contact: ScenePoint
  readonly effectId: string
  readonly pathDistance: number
  readonly sourceActorId: string | null
  readonly sourceMoved: boolean
  readonly targetActorId: string
  readonly trigger: SpatialTriggerMode
}

/** One complete outside-to-outside crossing of a stationary token's occupied footprint. */
interface TokenFootprintPathCrossing {
  readonly entry: ScenePoint
  readonly entryPathDistance: number
  readonly exit: ScenePoint
  readonly exitPathDistance: number
  readonly stationaryTokenId: string
}

interface Footprint {
  readonly center: ScenePoint
  readonly halfHeight: number
  readonly halfWidth: number
}

function isAbsoluteCoordinate(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= VTT_SCENE_LIMITS.coordinateMagnitude
}

function isAbsolutePoint(point: ScenePoint): boolean {
  return isAbsoluteCoordinate(point.x) && isAbsoluteCoordinate(point.y)
}

function isRelativePoint(point: ScenePoint): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Math.abs(point.x) <= VTT_SPATIAL_LIMITS.relativeCoordinateMagnitude &&
    Math.abs(point.y) <= VTT_SPATIAL_LIMITS.relativeCoordinateMagnitude
  )
}

function isBoundedDistance(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= VTT_SPATIAL_LIMITS.minimumDistance &&
    value <= VTT_SCENE_LIMITS.coordinateMagnitude
  )
}

function nonAdjacentPolygonEdgesIntersect(points: readonly ScenePoint[]): boolean {
  for (let left = 0; left < points.length; left += 1)
    for (let right = left + 1; right < points.length; right += 1) {
      if (right === left + 1 || (left === 0 && right === points.length - 1)) continue
      if (
        segmentsIntersect(
          points[left]!,
          points[(left + 1) % points.length]!,
          points[right]!,
          points[(right + 1) % points.length]!
        )
      )
        return true
    }
  return false
}

function validSpatialGeometry(geometry: SpatialGeometry): boolean {
  if (geometry.kind === 'CIRCLE')
    return isAbsolutePoint(geometry.center) && isBoundedDistance(geometry.radius)
  if (
    geometry.points.length < 3 ||
    geometry.points.some((point) => !isAbsolutePoint(point)) ||
    new Set(geometry.points.map((point) => `${point.x}:${point.y}`)).size !== geometry.points.length
  )
    return false
  const doubledArea = geometry.points.reduce((area, point, index) => {
    const next = geometry.points[(index + 1) % geometry.points.length]!
    return area + point.x * next.y - next.x * point.y
  }, 0)
  return (
    Number.isFinite(doubledArea) &&
    Math.abs(doubledArea) > Number.EPSILON &&
    !nonAdjacentPolygonEdgesIntersect(geometry.points)
  )
}

function validSpatialToken(token: SpatialSceneToken): boolean {
  return (
    isAbsolutePoint(token.position) &&
    isBoundedDistance(token.width) &&
    isBoundedDistance(token.height)
  )
}

function validSpatialEffect(effect: SpatialEffectInstance, tokenIds: ReadonlySet<string>): boolean {
  const anchorValid =
    (effect.anchorKind === 'FIXED' &&
      effect.sourceTokenId === null &&
      effect.geometry.frame === 'SCENE_ABSOLUTE') ||
    (effect.anchorKind === 'TOKEN' &&
      effect.sourceTokenId !== null &&
      effect.geometry.frame === 'TOKEN_LOCAL' &&
      tokenIds.has(effect.sourceTokenId))
  return (
    anchorValid &&
    validSpatialGeometry(effect.geometry.shape) &&
    effect.triggerModes.length > 0 &&
    effect.movementKinds.length > 0
  )
}

/** Scene token positions are the centers of their occupied footprints. */
function sceneTokenAnchor(token: Pick<SceneToken, 'position'>): ScenePoint {
  return { ...token.position }
}

function translateSpatialGeometry(geometry: SpatialGeometry, origin: ScenePoint): SpatialGeometry {
  return geometry.kind === 'CIRCLE'
    ? {
        kind: 'CIRCLE',
        center: {
          x: geometry.center.x + origin.x,
          y: geometry.center.y + origin.y
        },
        radius: geometry.radius
      }
    : {
        kind: 'POLYGON',
        points: geometry.points.map((point) => ({
          x: point.x + origin.x,
          y: point.y + origin.y
        }))
      }
}

/** Returns null for an invalid descriptor or a missing token anchor; callers fail closed. */
export function effectiveSpatialGeometry(
  effect: Pick<SpatialEffectInstance, 'anchorKind' | 'geometry' | 'sourceTokenId'>,
  sceneTokens: readonly SpatialSceneToken[]
): SpatialGeometry | null {
  if (
    !validSpatialGeometry(effect.geometry.shape) ||
    sceneTokens.some((token) => !validSpatialToken(token))
  )
    return null
  if (effect.anchorKind === 'FIXED')
    return effect.geometry.frame === 'SCENE_ABSOLUTE' && effect.sourceTokenId === null
      ? effect.geometry.shape
      : null
  if (effect.geometry.frame !== 'TOKEN_LOCAL' || !effect.sourceTokenId) return null
  const source = sceneTokens.find((token) => token.id === effect.sourceTokenId)
  if (!source) return null
  const translated = translateSpatialGeometry(effect.geometry.shape, sceneTokenAnchor(source))
  return validSpatialGeometry(translated) ? translated : null
}

function footprint(token: SpatialSceneToken, center = sceneTokenAnchor(token)): Footprint {
  return { center, halfHeight: token.height / 2, halfWidth: token.width / 2 }
}

function pointInFootprint(point: ScenePoint, value: Footprint): boolean {
  return (
    point.x >= value.center.x - value.halfWidth - EPSILON &&
    point.x <= value.center.x + value.halfWidth + EPSILON &&
    point.y >= value.center.y - value.halfHeight - EPSILON &&
    point.y <= value.center.y + value.halfHeight + EPSILON
  )
}

function footprintCorners(value: Footprint): ScenePoint[] {
  return [
    {
      x: value.center.x - value.halfWidth,
      y: value.center.y - value.halfHeight
    },
    {
      x: value.center.x + value.halfWidth,
      y: value.center.y - value.halfHeight
    },
    {
      x: value.center.x + value.halfWidth,
      y: value.center.y + value.halfHeight
    },
    {
      x: value.center.x - value.halfWidth,
      y: value.center.y + value.halfHeight
    }
  ]
}

function pointInPolygon(point: ScenePoint, points: readonly ScenePoint[]): boolean {
  let inside = false
  for (let index = 0; index < points.length; index += 1) {
    const from = points[index]!
    const to = points[(index + 1) % points.length]!
    if (segmentsIntersect(point, point, from, to)) return true
    if (from.y > point.y === to.y > point.y) continue
    const crossing = ((to.x - from.x) * (point.y - from.y)) / (to.y - from.y) + from.x
    if (point.x <= crossing) inside = !inside
  }
  return inside
}

function footprintIntersectsSpatialGeometry(value: Footprint, geometry: SpatialGeometry): boolean {
  if (geometry.kind === 'CIRCLE') {
    const closestX = Math.max(
      value.center.x - value.halfWidth,
      Math.min(geometry.center.x, value.center.x + value.halfWidth)
    )
    const closestY = Math.max(
      value.center.y - value.halfHeight,
      Math.min(geometry.center.y, value.center.y + value.halfHeight)
    )
    return (
      Math.hypot(geometry.center.x - closestX, geometry.center.y - closestY) <=
      geometry.radius + EPSILON
    )
  }
  const corners = footprintCorners(value)
  if (corners.some((corner) => pointInPolygon(corner, geometry.points))) return true
  if (geometry.points.some((point) => pointInFootprint(point, value))) return true
  return corners.some((from, index) => {
    const to = corners[(index + 1) % corners.length]!
    return geometry.points.some((edgeFrom, edge) =>
      segmentsIntersect(from, to, edgeFrom, geometry.points[(edge + 1) % geometry.points.length]!)
    )
  })
}

/** Full-footprint containment fact for current spatial/perception evaluation. */
export function spatialGeometryIntersectsTokenFootprint(input: {
  geometry: SpatialGeometry
  position?: ScenePoint
  token: SpatialSceneToken
}): boolean {
  if (!validSpatialGeometry(input.geometry) || !validSpatialToken(input.token)) return false
  return footprintIntersectsSpatialGeometry(
    footprint(input.token, input.position ?? sceneTokenAnchor(input.token)),
    input.geometry
  )
}

/**
 * A point-origin area in Scene units. A sphere, circle or cylinder is a radius. A cube's point of
 * origin is the center of its bottom face (SRD: on one of its faces), so on the flat Scene the cube
 * is centered on the picked point.
 */
export type SpatialPointAreaShape =
  | { readonly kind: 'RADIUS'; readonly radius: number }
  | { readonly kind: 'CUBE'; readonly edgeLength: number }

/** An authored length; one with `scaling` depends on a level and has no fixed Scene size. */
interface AuthoredPointAreaLength {
  readonly amount: number
  readonly unit: LengthUnitCode
  readonly scaling?: unknown
}

/** A point-origin area as authored: a sphere, cylinder or circle is a radius, a cube is its edge. */
export type AuthoredPointArea =
  | { readonly kind: 'RADIUS'; readonly radius: AuthoredPointAreaLength }
  | { readonly kind: 'CUBE'; readonly edgeLength: AuthoredPointAreaLength }

function coordinateLength(length: AuthoredPointAreaLength, grid: SceneGrid): number | null {
  if (length.scaling !== undefined || !(length.amount > 0)) return null
  try {
    return sceneDistanceAsCoordinateLength(grid, lengthMeasurementInSceneUnits(length, grid))
  } catch {
    return null
  }
}

/**
 * The authored area in Scene coordinates. Null for a size that is scaled, empty or unmeasurable on
 * this Scene. A cylinder's height is not modeled (the Scene is flat).
 */
export function pointAreaInSceneCoordinates(
  area: AuthoredPointArea,
  grid: SceneGrid
): SpatialPointAreaShape | null {
  if (area.kind === 'CUBE') {
    const edgeLength = coordinateLength(area.edgeLength, grid)
    return edgeLength === null ? null : { kind: 'CUBE', edgeLength }
  }
  const radius = coordinateLength(area.radius, grid)
  return radius === null ? null : { kind: 'RADIUS', radius }
}

/**
 * The tokens whose footprint touches a point-origin area, sorted by id. A cylinder's height is not
 * modeled: the Scene is flat. An invalid shape or token catches nothing (fails closed).
 */
export function spatialTokensInsidePointArea(input: {
  origin: ScenePoint
  shape: SpatialPointAreaShape
  tokens: readonly SpatialSceneToken[]
}): string[] {
  const { origin, shape } = input
  const geometry: SpatialGeometry =
    shape.kind === 'RADIUS'
      ? { kind: 'CIRCLE', center: origin, radius: shape.radius }
      : {
          kind: 'POLYGON',
          points: [
            { x: origin.x - shape.edgeLength / 2, y: origin.y - shape.edgeLength / 2 },
            { x: origin.x + shape.edgeLength / 2, y: origin.y - shape.edgeLength / 2 },
            { x: origin.x + shape.edgeLength / 2, y: origin.y + shape.edgeLength / 2 },
            { x: origin.x - shape.edgeLength / 2, y: origin.y + shape.edgeLength / 2 }
          ]
        }
  return input.tokens
    .filter((token) => spatialGeometryIntersectsTokenFootprint({ geometry, token }))
    .map((token) => token.id)
    .sort()
}

function interpolate(from: ScenePoint, to: ScenePoint, progress: number): ScenePoint {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress
  }
}

function segmentIntersectionProgress(
  from: ScenePoint,
  to: ScenePoint,
  edgeFrom: ScenePoint,
  edgeTo: ScenePoint
): number | null {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const ex = edgeTo.x - edgeFrom.x
  const ey = edgeTo.y - edgeFrom.y
  const denominator = dx * ey - dy * ex
  if (Math.abs(denominator) < EPSILON) return null
  const rx = edgeFrom.x - from.x
  const ry = edgeFrom.y - from.y
  const progress = (rx * ey - ry * ex) / denominator
  const edgeProgress = (rx * dy - ry * dx) / denominator
  return progress >= -EPSILON &&
    progress <= 1 + EPSILON &&
    edgeProgress >= -EPSILON &&
    edgeProgress <= 1 + EPSILON
    ? Math.max(0, Math.min(1, progress))
    : null
}

function circleIntersectionTimes(
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
    .filter((value) => value >= -EPSILON && value <= 1 + EPSILON)
    .map((value) => Math.max(0, Math.min(1, value)))
}

function candidateTimesForCircle(
  from: ScenePoint,
  to: ScenePoint,
  shape: Extract<SpatialGeometry, { kind: 'CIRCLE' }>,
  moving: Pick<Footprint, 'halfHeight' | 'halfWidth'>
): number[] {
  const times = [0, 1]
  const dx = to.x - from.x
  const dy = to.y - from.y
  const minX = shape.center.x - moving.halfWidth
  const maxX = shape.center.x + moving.halfWidth
  const minY = shape.center.y - moving.halfHeight
  const maxY = shape.center.y + moving.halfHeight
  for (const x of [minX - shape.radius, maxX + shape.radius]) {
    if (Math.abs(dx) <= EPSILON) continue
    const progress = (x - from.x) / dx
    const y = from.y + dy * progress
    if (progress >= -EPSILON && progress <= 1 + EPSILON && y >= minY && y <= maxY)
      times.push(Math.max(0, Math.min(1, progress)))
  }
  for (const y of [minY - shape.radius, maxY + shape.radius]) {
    if (Math.abs(dy) <= EPSILON) continue
    const progress = (y - from.y) / dy
    const x = from.x + dx * progress
    if (progress >= -EPSILON && progress <= 1 + EPSILON && x >= minX && x <= maxX)
      times.push(Math.max(0, Math.min(1, progress)))
  }
  for (const x of [minX, maxX])
    for (const y of [minY, maxY])
      times.push(...circleIntersectionTimes(from, to, { x, y }, shape.radius))
  return times
}

function candidateTimesForPolygon(
  from: ScenePoint,
  to: ScenePoint,
  shape: Extract<SpatialGeometry, { kind: 'POLYGON' }>,
  moving: Pick<Footprint, 'halfHeight' | 'halfWidth'>
): number[] {
  const times = [0, 1]
  const offsets = [
    { x: -moving.halfWidth, y: -moving.halfHeight },
    { x: moving.halfWidth, y: -moving.halfHeight },
    { x: moving.halfWidth, y: moving.halfHeight },
    { x: -moving.halfWidth, y: moving.halfHeight }
  ]
  for (const offset of offsets) {
    const cornerFrom = { x: from.x + offset.x, y: from.y + offset.y }
    const cornerTo = { x: to.x + offset.x, y: to.y + offset.y }
    for (let edge = 0; edge < shape.points.length; edge += 1) {
      const progress = segmentIntersectionProgress(
        cornerFrom,
        cornerTo,
        shape.points[edge]!,
        shape.points[(edge + 1) % shape.points.length]!
      )
      if (progress !== null) times.push(progress)
    }
  }
  const dx = to.x - from.x
  const dy = to.y - from.y
  for (const vertex of shape.points) {
    for (const x of [vertex.x - moving.halfWidth, vertex.x + moving.halfWidth]) {
      if (Math.abs(dx) <= EPSILON) continue
      const progress = (x - from.x) / dx
      const y = from.y + dy * progress
      if (
        progress >= -EPSILON &&
        progress <= 1 + EPSILON &&
        Math.abs(y - vertex.y) <= moving.halfHeight + EPSILON
      )
        times.push(Math.max(0, Math.min(1, progress)))
    }
    for (const y of [vertex.y - moving.halfHeight, vertex.y + moving.halfHeight]) {
      if (Math.abs(dy) <= EPSILON) continue
      const progress = (y - from.y) / dy
      const x = from.x + dx * progress
      if (
        progress >= -EPSILON &&
        progress <= 1 + EPSILON &&
        Math.abs(x - vertex.x) <= moving.halfWidth + EPSILON
      )
        times.push(Math.max(0, Math.min(1, progress)))
    }
  }
  return times
}

function candidateTimes(
  from: ScenePoint,
  to: ScenePoint,
  geometry: SpatialGeometry,
  moving: Pick<Footprint, 'halfHeight' | 'halfWidth'>
): number[] {
  const values =
    geometry.kind === 'CIRCLE'
      ? candidateTimesForCircle(from, to, geometry, moving)
      : candidateTimesForPolygon(from, to, geometry, moving)
  return values
    .sort((left, right) => left - right)
    .filter((value, index, all) => index === 0 || Math.abs(value - all[index - 1]!) > EPSILON)
}

function candidateContact(input: {
  readonly geometry: SpatialGeometry
  readonly path: readonly ScenePoint[]
  readonly token: SpatialSceneToken
  readonly trigger: 'ENTER' | 'EXIT'
}): { contact: ScenePoint; pathDistance: number } | null {
  let totalDistance = 0
  for (let index = 1; index < input.path.length; index += 1) {
    const from = input.path[index - 1]!
    const to = input.path[index]!
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    const times = candidateTimes(from, to, input.geometry, footprint(input.token))
    for (let timeIndex = 0; timeIndex < times.length; timeIndex += 1) {
      const progress = times[timeIndex]!
      const prior = times[timeIndex - 1] ?? 0
      const next = times[timeIndex + 1] ?? 1
      const before = footprintIntersectsSpatialGeometry(
        footprint(input.token, interpolate(from, to, (prior + progress) / 2)),
        input.geometry
      )
      const after = footprintIntersectsSpatialGeometry(
        footprint(input.token, interpolate(from, to, (progress + next) / 2)),
        input.geometry
      )
      if (
        (input.trigger === 'ENTER' && !before && after) ||
        (input.trigger === 'EXIT' && before && !after)
      )
        return {
          contact: interpolate(from, to, progress),
          pathDistance: totalDistance + length * progress
        }
    }
    totalDistance += length
  }
  return null
}

function movementTrigger(input: {
  readonly geometry: SpatialGeometry
  readonly kind: SpatialMovementKind
  readonly path: readonly ScenePoint[]
  readonly token: SpatialSceneToken
}): {
  contact: ScenePoint
  pathDistance: number
  trigger: SpatialTriggerMode
} | null {
  const first = input.path[0]
  const last = input.path.at(-1)
  if (!first || !last) return null
  const start = footprintIntersectsSpatialGeometry(footprint(input.token, first), input.geometry)
  const end = footprintIntersectsSpatialGeometry(footprint(input.token, last), input.geometry)
  if (input.kind === 'TELEPORT') {
    if (input.path.length !== 2) return null
    const totalDistance = Math.hypot(last.x - first.x, last.y - first.y)
    if (!Number.isFinite(totalDistance)) return null
    if (start && !end) return { contact: first, pathDistance: 0, trigger: 'EXIT' }
    if (!start && end) return { contact: last, pathDistance: totalDistance, trigger: 'ENTER' }
    return null
  }
  if (!start) {
    const contact = candidateContact({ ...input, trigger: 'ENTER' })
    return contact ? { ...contact, trigger: end ? 'ENTER' : 'CROSS' } : null
  }
  if (!end) {
    const contact = candidateContact({ ...input, trigger: 'EXIT' })
    return contact ? { ...contact, trigger: 'EXIT' } : null
  }
  return null
}

function relativeSourcePath(
  target: SpatialSceneToken,
  sourcePath: readonly ScenePoint[]
): ScenePoint[] | null {
  const anchor = sceneTokenAnchor(target)
  const path = sourcePath.map((source) => ({
    x: anchor.x - source.x,
    y: anchor.y - source.y
  }))
  return path.every(isRelativePoint) ? path : null
}

function pathPointAtDistance(path: readonly ScenePoint[], distance: number): ScenePoint | null {
  let remaining = distance
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1]!
    const to = path[index]!
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    if (length === 0) continue
    if (remaining <= length + EPSILON) {
      const progress = Math.max(0, Math.min(1, remaining / length))
      return interpolate(from, to, progress)
    }
    remaining -= length
  }
  return remaining <= EPSILON ? (path.at(-1) ?? null) : null
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

/**
 * Collect full-footprint path crossings against stationary token footprints. This reports geometry
 * only; callers own relationship, movement-kind, action-economy, and rules-policy decisions.
 */
export function collectTokenFootprintPathCrossings(input: {
  readonly movingToken: SpatialSceneToken
  readonly path: readonly ScenePoint[]
  readonly stationaryTokens: readonly SpatialSceneToken[]
}): TokenFootprintPathCrossing[] {
  const stationaryIds = new Set(input.stationaryTokens.map((token) => token.id))
  if (
    !validSpatialToken(input.movingToken) ||
    input.path.length < 2 ||
    !input.path.every(isAbsolutePoint) ||
    Math.abs(input.path[0]!.x - input.movingToken.position.x) > EPSILON ||
    Math.abs(input.path[0]!.y - input.movingToken.position.y) > EPSILON ||
    stationaryIds.size !== input.stationaryTokens.length ||
    stationaryIds.has(input.movingToken.id) ||
    input.stationaryTokens.some((token) => !validSpatialToken(token))
  )
    return []

  const start = input.path[0]!
  const end = input.path.at(-1)!
  return input.stationaryTokens
    .flatMap((stationaryToken): TokenFootprintPathCrossing[] => {
      const geometry: SpatialGeometry = {
        kind: 'POLYGON',
        points: footprintCorners(footprint(stationaryToken))
      }
      const movingFootprint = footprint(input.movingToken)
      const stationaryFootprint = footprint(stationaryToken)
      const overlaps = (position: ScenePoint) =>
        Math.abs(position.x - stationaryFootprint.center.x) <
          movingFootprint.halfWidth + stationaryFootprint.halfWidth - EPSILON &&
        Math.abs(position.y - stationaryFootprint.center.y) <
          movingFootprint.halfHeight + stationaryFootprint.halfHeight - EPSILON
      if (overlaps(start) || overlaps(end)) return []
      let entry: { contact: ScenePoint; pathDistance: number } | null = null
      let exit: { contact: ScenePoint; pathDistance: number } | null = null
      let totalDistance = 0
      for (let index = 1; index < input.path.length; index += 1) {
        const from = input.path[index - 1]!
        const to = input.path[index]!
        const length = Math.hypot(to.x - from.x, to.y - from.y)
        const times = candidateTimes(from, to, geometry, movingFootprint)
        for (let timeIndex = 1; timeIndex < times.length; timeIndex += 1) {
          const intervalStart = times[timeIndex - 1]!
          const intervalEnd = times[timeIndex]!
          if (intervalEnd - intervalStart <= EPSILON) continue
          if (overlaps(interpolate(from, to, (intervalStart + intervalEnd) / 2))) {
            if (!entry)
              entry = {
                contact: interpolate(from, to, intervalStart),
                pathDistance: totalDistance + length * intervalStart
              }
            exit = {
              contact: interpolate(from, to, intervalEnd),
              pathDistance: totalDistance + length * intervalEnd
            }
          } else if (entry && exit) {
            return [
              {
                entry: entry.contact,
                entryPathDistance: entry.pathDistance,
                exit: exit.contact,
                exitPathDistance: exit.pathDistance,
                stationaryTokenId: stationaryToken.id
              }
            ]
          }
        }
        totalDistance += length
      }
      return entry && exit && entry.pathDistance + EPSILON < exit.pathDistance
        ? [
            {
              entry: entry.contact,
              entryPathDistance: entry.pathDistance,
              exit: exit.contact,
              exitPathDistance: exit.pathDistance,
              stationaryTokenId: stationaryToken.id
            }
          ]
        : []
    })
    .sort(
      (left, right) =>
        left.entryPathDistance - right.entryPathDistance ||
        compareText(left.stationaryTokenId, right.stationaryTokenId)
    )
}

/**
 * Collect deterministic full-footprint contact facts. It does not decide
 * eligibility, execute an effect, or mutate scene state.
 */
export function collectSpatialMovementCandidates(input: {
  readonly actorIdByTokenId: ReadonlyMap<string, string>
  readonly effects: readonly SpatialEffectInstance[]
  readonly movementKind: SpatialMovementKind
  readonly path: readonly ScenePoint[]
  readonly tokens: readonly SpatialSceneToken[]
  readonly movingTokenId: string
}): SpatialMovementCandidate[] {
  const movingToken = input.tokens.find((token) => token.id === input.movingTokenId)
  const tokenIds = new Set(input.tokens.map((token) => token.id))
  if (
    !movingToken ||
    !input.actorIdByTokenId.get(movingToken.id) ||
    input.path.length < 2 ||
    !input.path.every(isAbsolutePoint) ||
    input.tokens.some((token) => !validSpatialToken(token)) ||
    (input.movementKind === 'TELEPORT' && input.path.length !== 2)
  )
    return []
  const candidates: SpatialMovementCandidate[] = []
  for (const effect of input.effects) {
    if (!validSpatialEffect(effect, tokenIds) || !effect.movementKinds.includes(input.movementKind))
      continue
    const sourceMoved =
      effect.anchorKind === 'TOKEN' && effect.sourceTokenId === input.movingTokenId
    const targets = sourceMoved
      ? input.tokens.filter(
          (token) => token.id !== input.movingTokenId && input.actorIdByTokenId.has(token.id)
        )
      : [movingToken]
    for (const target of targets) {
      const targetActorId = input.actorIdByTokenId.get(target.id)
      if (!targetActorId) continue
      const geometry = sourceMoved
        ? effect.geometry.frame === 'TOKEN_LOCAL'
          ? effect.geometry.shape
          : null
        : effectiveSpatialGeometry(effect, input.tokens)
      if (!geometry) continue
      const path = sourceMoved ? relativeSourcePath(target, input.path) : input.path
      if (!path) continue
      const trigger = movementTrigger({
        geometry,
        kind: input.movementKind,
        path,
        token: target
      })
      if (!trigger || !effect.triggerModes.includes(trigger.trigger)) continue
      const contact = sourceMoved
        ? pathPointAtDistance(input.path, trigger.pathDistance)
        : trigger.contact
      if (!contact || !isAbsolutePoint(contact) || !Number.isFinite(trigger.pathDistance)) continue
      candidates.push({
        contact,
        effectId: effect.effectId,
        pathDistance: trigger.pathDistance,
        sourceActorId: effect.sourceActorId,
        sourceMoved,
        targetActorId,
        trigger: trigger.trigger
      })
    }
  }
  const unique = new Map<string, SpatialMovementCandidate>()
  for (const candidate of candidates) {
    const key = `${candidate.effectId}:${candidate.targetActorId}:${candidate.trigger}`
    const existing = unique.get(key)
    if (!existing || candidate.pathDistance < existing.pathDistance) unique.set(key, candidate)
  }
  return [...unique.values()].sort(
    (left, right) =>
      left.pathDistance - right.pathDistance ||
      compareText(left.effectId, right.effectId) ||
      compareText(left.targetActorId, right.targetActorId) ||
      compareText(left.trigger, right.trigger)
  )
}
