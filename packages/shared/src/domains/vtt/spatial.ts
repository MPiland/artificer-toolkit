import type { LengthUnitCode } from '../core/measurement.js'
import { measureScenePathDistance, sceneDistanceAsCoordinateLength } from './geometry.js'
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
/**
 * The turn boundary at which a creature standing in an effect is caught: the start or end of its
 * own turn, or the start of the effect source's turn.
 */
export type SpatialTurnTrigger = 'START_OF_TURN' | 'END_OF_TURN' | 'START_OF_SOURCE_TURN'

export type SpatialGeometry =
  | {
      readonly kind: 'CIRCLE'
      readonly center: ScenePoint
      readonly radius: number
    }
  /** A hollow circle (D154): a creature is in it when it overlaps the outer circle and is not wholly inside the inner one. */
  | {
      readonly kind: 'RING'
      readonly center: ScenePoint
      readonly outerRadius: number
      readonly innerRadius: number
    }
  | { readonly kind: 'POLYGON'; readonly points: readonly ScenePoint[] }

export interface SpatialPersistedGeometry {
  readonly frame: SpatialGeometryFrame
  readonly shape: SpatialGeometry
}

/**
 * Whether an effect can catch a creature at all: the one membership question every trigger asks
 * (movement ENTER, EXIT and CROSS today; turn-stage triggers and movement cost must ask it too).
 */
export function spatialEffectAffects(
  effect: Pick<SpatialEffectInstance, 'unaffectedActorIds' | 'suppressed'>,
  actorId: string
): boolean {
  return !effect.suppressed && !effect.unaffectedActorIds?.includes(actorId)
}

/** How often a zone has caught one creature on one turn; the Run keeps it, keyed by {@link zoneApplicationKey}. */
export interface ZoneApplicationsEntry {
  readonly turnSequence: number
  readonly count: number
}

export type ZoneApplications = Readonly<Record<string, ZoneApplicationsEntry>>

export function zoneApplicationKey(effectId: string, actorId: string): string {
  return `${effectId}:${actorId}`
}

function zoneApplicationsSpent(
  applications: ZoneApplications | undefined,
  turnSequence: number,
  key: string
): number {
  const entry = applications?.[key]
  return entry?.turnSequence === turnSequence ? entry.count : 0
}

/**
 * The applications after a turn's zone triggers settled. An entry from an earlier turn counts as
 * unspent and is dropped here, so the map never outgrows one turn's triggers.
 */
export function recordZoneApplications(
  applications: ZoneApplications | undefined,
  turnSequence: number,
  applied: readonly { readonly effectId: string; readonly targetActorId: string }[]
): ZoneApplications | undefined {
  if (!applied.length) return applications
  const next: Record<string, ZoneApplicationsEntry> = {}
  for (const [key, entry] of Object.entries(applications ?? {}))
    if (entry.turnSequence === turnSequence) next[key] = entry
  for (const { effectId, targetActorId } of applied) {
    const key = zoneApplicationKey(effectId, targetActorId)
    next[key] = { turnSequence, count: (next[key]?.count ?? 0) + 1 }
  }
  return next
}

/** A system-neutral spatial instance after its source has been resolved. */
export interface SpatialEffectInstance {
  readonly effectId: string
  readonly sourceActorId: string | null
  readonly sourceTokenId: string | null
  readonly anchorKind: SpatialAnchorKind
  readonly geometry: SpatialPersistedGeometry
  readonly triggerModes: readonly SpatialTriggerMode[]
  /** Turn boundaries at which a creature inside is caught; absent for none. */
  readonly turnTriggers?: readonly SpatialTurnTrigger[]
  readonly movementKinds: readonly SpatialMovementKind[]
  /** A voluntary mover moving carefully crosses the field at double cost and makes no entry save. */
  readonly bypassAtHalfSpeed?: boolean
  /** What moving through the effect costs a creature it catches, as a multiplier (D154); absent for 1. */
  readonly movementCostMultiplier?: number
  /** Creatures the effect never catches (designated by the caster at cast). */
  readonly unaffectedActorIds?: readonly string[]
  /** How many times the effect may catch one creature in one turn; absent for no limit. */
  readonly maxApplicationsPerTurn?: number
  /** At a turn boundary, catches only a creature whose whole space is inside the area. */
  readonly requiresFullyWithin?: boolean
  /** Catches no one while it rests, still drawn: a Creature's passive zone whose source is defeated (D144). */
  readonly suppressed?: boolean
  /** Catches a creature inside it that hits the effect's source with a melee attack (D153). */
  readonly retaliatesMeleeHits?: boolean
  /**
   * Catches a mover once for each whole step (Scene distance units, measured as movement is) it
   * travels while overlapping the area, where that step completes, instead of once on entry
   * (D156). Absent for entry only.
   */
  readonly distanceStep?: number
}

/** The space a token occupies. */
export type SpatialTokenFootprint = Pick<SceneToken, 'height' | 'position' | 'width'>

export type SpatialSceneToken = SpatialTokenFootprint & Pick<SceneToken, 'id'>

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
  /** The 1-based whole step it completes, for an effect that catches per distance moved. */
  readonly step?: number
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
  if (geometry.kind === 'RING')
    return (
      isAbsolutePoint(geometry.center) &&
      isBoundedDistance(geometry.innerRadius) &&
      isBoundedDistance(geometry.outerRadius) &&
      geometry.innerRadius < geometry.outerRadius
    )
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

function validSpatialToken(token: SpatialTokenFootprint): boolean {
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
    (effect.triggerModes.length > 0 ||
      (effect.turnTriggers?.length ?? 0) > 0 ||
      effect.retaliatesMeleeHits === true) &&
    effect.movementKinds.length > 0 &&
    (effect.distanceStep === undefined ||
      (Number.isFinite(effect.distanceStep) && effect.distanceStep > 0))
  )
}

/** Scene token positions are the centers of their occupied footprints. */
function sceneTokenAnchor(token: Pick<SceneToken, 'position'>): ScenePoint {
  return { ...token.position }
}

function translateSpatialGeometry(geometry: SpatialGeometry, origin: ScenePoint): SpatialGeometry {
  return geometry.kind !== 'POLYGON'
    ? {
        ...geometry,
        center: {
          x: geometry.center.x + origin.x,
          y: geometry.center.y + origin.y
        }
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

function footprint(token: SpatialTokenFootprint, center = sceneTokenAnchor(token)): Footprint {
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

/** How far `point` is from the nearest point of the footprint; zero inside or on it. */
function distanceFromFootprint(value: Footprint, point: ScenePoint): number {
  const closestX = Math.max(
    value.center.x - value.halfWidth,
    Math.min(point.x, value.center.x + value.halfWidth)
  )
  const closestY = Math.max(
    value.center.y - value.halfHeight,
    Math.min(point.y, value.center.y + value.halfHeight)
  )
  return Math.hypot(point.x - closestX, point.y - closestY)
}

/**
 * The area a simple polygon (convex or concave) shares with the footprint: the polygon clipped
 * against the footprint's four half-planes (Sutherland–Hodgman), then the shoelace area. A concave
 * subject can leave zero-width bridges in the clip, which add no area.
 */
function polygonFootprintOverlapArea(points: readonly ScenePoint[], value: Footprint): number {
  const { center, halfWidth, halfHeight } = value
  const inwardDistances = [
    (point: ScenePoint) => point.x - (center.x - halfWidth),
    (point: ScenePoint) => center.x + halfWidth - point.x,
    (point: ScenePoint) => point.y - (center.y - halfHeight),
    (point: ScenePoint) => center.y + halfHeight - point.y
  ]
  const clipped = inwardDistances.reduce<readonly ScenePoint[]>(
    (polygon, distance) =>
      polygon.flatMap((current, index) => {
        const previous = polygon[(index + polygon.length - 1) % polygon.length]!
        const [currentDistance, previousDistance] = [distance(current), distance(previous)]
        const crossing =
          currentDistance >= 0 !== previousDistance >= 0
            ? [
                interpolate(
                  previous,
                  current,
                  previousDistance / (previousDistance - currentDistance)
                )
              ]
            : []
        return currentDistance >= 0 ? [...crossing, current] : crossing
      }),
    points
  )
  return (
    Math.abs(
      clipped.reduce((twiceArea, from, index) => {
        const to = clipped[(index + 1) % clipped.length]!
        return twiceArea + from.x * to.y - to.x * from.y
      }, 0)
    ) / 2
  )
}

/**
 * The one overlap rule of areas and zones: a footprint shares positive area with the geometry, and
 * touching its edge or a corner never counts (user ruling 2026-10-14, D103). A polygon may be any
 * simple polygon, convex or concave.
 */
function footprintOverlapsSpatialGeometry(value: Footprint, geometry: SpatialGeometry): boolean {
  if (geometry.kind === 'CIRCLE')
    return distanceFromFootprint(value, geometry.center) < geometry.radius - EPSILON
  if (geometry.kind === 'RING')
    return (
      distanceFromFootprint(value, geometry.center) < geometry.outerRadius - EPSILON &&
      !footprintWithinCircle(value, geometry.center, geometry.innerRadius)
    )
  return polygonFootprintOverlapArea(geometry.points, value) > EPSILON
}

/** A circle is convex, so holding the four corners holds the footprint. */
function footprintWithinCircle(value: Footprint, center: ScenePoint, radius: number): boolean {
  return footprintCorners(value).every(
    (corner) => Math.hypot(corner.x - center.x, corner.y - center.y) <= radius + EPSILON
  )
}

/**
 * Whether the footprint lies entirely inside the geometry; its edges may lie on the boundary. A
 * ring holds it inside its outer circle when it shares no area with the inner one; a polygon
 * (convex or concave) holds it when their shared area is the whole footprint.
 */
function footprintWithinSpatialGeometry(value: Footprint, geometry: SpatialGeometry): boolean {
  if (geometry.kind === 'CIRCLE')
    return footprintWithinCircle(value, geometry.center, geometry.radius)
  if (geometry.kind === 'RING')
    return (
      footprintWithinCircle(value, geometry.center, geometry.outerRadius) &&
      distanceFromFootprint(value, geometry.center) >= geometry.innerRadius - EPSILON
    )
  return (
    polygonFootprintOverlapArea(geometry.points, value) >=
    4 * value.halfWidth * value.halfHeight - EPSILON
  )
}

/**
 * Whether the token's whole footprint shares area with the geometry, for current spatial and
 * perception evaluation. Touching the geometry's edge or a corner is not in it. An invalid
 * geometry or token is in nothing (fails closed).
 */
export function spatialGeometryOverlapsTokenFootprint(input: {
  geometry: SpatialGeometry
  position?: ScenePoint
  token: SpatialSceneToken
}): boolean {
  if (!validSpatialGeometry(input.geometry) || !validSpatialToken(input.token)) return false
  return footprintOverlapsSpatialGeometry(
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

/** An authored length in Scene coordinates. Null for a length that is scaled or empty. */
export function authoredLengthInSceneCoordinates(
  length: AuthoredPointAreaLength,
  grid: SceneGrid
): number | null {
  if (length.scaling !== undefined || !(length.amount > 0)) return null
  return sceneDistanceAsCoordinateLength(grid, lengthMeasurementInSceneUnits(length, grid))
}

/**
 * The authored area in Scene coordinates. Null for a size that is scaled or empty. A cylinder's
 * height is not modeled (the Scene is flat).
 */
export function pointAreaInSceneCoordinates(
  area: AuthoredPointArea,
  grid: SceneGrid
): SpatialPointAreaShape | null {
  if (area.kind === 'CUBE') {
    const edgeLength = authoredLengthInSceneCoordinates(area.edgeLength, grid)
    return edgeLength === null ? null : { kind: 'CUBE', edgeLength }
  }
  const radius = authoredLengthInSceneCoordinates(area.radius, grid)
  return radius === null ? null : { kind: 'RADIUS', radius }
}

/** The square a point cube covers: it is centered on the picked point. */
export function pointCubeOutline(origin: ScenePoint, edgeLength: number): ScenePoint[] {
  const half = edgeLength / 2
  return [
    { x: origin.x - half, y: origin.y - half },
    { x: origin.x + half, y: origin.y - half },
    { x: origin.x + half, y: origin.y + half },
    { x: origin.x - half, y: origin.y + half }
  ]
}

/**
 * A directed area in Scene units. Its point of origin lies on the caster's footprint and it extends
 * toward `toward`. A cone is as wide as it is long and a line is a rectangle centered on its axis.
 * A cube extends one full edge out from the side of the footprint `toward` mostly faces, with its
 * face flush against that side: the origin picks where along the side the face sits, on the Scene
 * grid's lines (`gridOrigin` plus whole `cellSize` steps), so the cube stays on the grid and never
 * starts inside the caster's space.
 */
export type SpatialDirectedAreaShape =
  | { readonly kind: 'CONE'; readonly length: number; readonly toward: ScenePoint }
  | {
      readonly kind: 'LINE'
      readonly length: number
      readonly width: number
      readonly toward: ScenePoint
    }
  | {
      readonly kind: 'CUBE_FROM_SIDE'
      readonly edgeLength: number
      readonly cellSize: number
      readonly gridOrigin: ScenePoint
      readonly toward: ScenePoint
    }

/** A directed area's size before it is aimed: its shape without the direction. */
export type SpatialDirectedAreaSize = SpatialDirectedAreaShape extends infer Shape
  ? Shape extends SpatialDirectedAreaShape
    ? Omit<Shape, 'toward'>
    : never
  : never

/**
 * A zone's wall in Scene units (D154), placed from the area's origin: a straight wall from the
 * origin to `to`, `thickness` wide and centered on that segment, or a ring around the origin.
 */
export type SpatialWallAreaShape =
  | { readonly kind: 'WALL'; readonly to: ScenePoint; readonly thickness: number }
  | { readonly kind: 'RING'; readonly outerRadius: number; readonly innerRadius: number }

export type SpatialAreaShape =
  | SpatialPointAreaShape
  | SpatialDirectedAreaShape
  | SpatialWallAreaShape

const DIRECTED_AREA_KINDS: ReadonlySet<string> = new Set<SpatialDirectedAreaShape['kind']>([
  'CONE',
  'LINE',
  'CUBE_FROM_SIDE'
])

/** Narrows a shape, or a size before it is aimed, to its directed members. */
export function isDirectedAreaShape<Shape extends SpatialAreaShape | SpatialDirectedAreaSize>(
  shape: Shape
): shape is Extract<Shape, { readonly kind: SpatialDirectedAreaShape['kind'] }> {
  return DIRECTED_AREA_KINDS.has(shape.kind)
}

/**
 * The rectangle a straight wall covers: `thickness` wide, centered on the segment from `from` to
 * `to`. Null for a wall of no length.
 */
export function wallOutline(
  from: ScenePoint,
  to: ScenePoint,
  thickness: number
): ScenePoint[] | null {
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  if (!(length > EPSILON)) return null
  const half = thickness / 2
  const normal = { x: (-(to.y - from.y) / length) * half, y: ((to.x - from.x) / length) * half }
  return [
    { x: from.x + normal.x, y: from.y + normal.y },
    { x: to.x + normal.x, y: to.y + normal.y },
    { x: to.x - normal.x, y: to.y - normal.y },
    { x: from.x - normal.x, y: from.y - normal.y }
  ]
}

/**
 * The Scene geometry an area that is not directed covers from its origin: a circle, the square of a
 * cube centered on it, a wall's rectangle or a ring. Null for a wall of no length.
 */
export function undirectedAreaGeometry(
  origin: ScenePoint,
  shape: SpatialPointAreaShape | SpatialWallAreaShape
): SpatialGeometry | null {
  switch (shape.kind) {
    case 'RADIUS':
      return { kind: 'CIRCLE', center: origin, radius: shape.radius }
    case 'CUBE':
      return { kind: 'POLYGON', points: pointCubeOutline(origin, shape.edgeLength) }
    case 'RING':
      return ringGeometry(origin, shape)
    case 'WALL': {
      const points = wallOutline(origin, shape.to, shape.thickness)
      return points && { kind: 'POLYGON', points }
    }
  }
}

/** The side of a zone's wall its band reaches (D154): of travel along a straight wall, or of a ring. */
export type SpatialWallSide = 'LEFT' | 'RIGHT' | 'INSIDE' | 'OUTSIDE'

/**
 * The Scene geometry a zone's band covers (D154): its wall plus `distance` on `side`. Beside a
 * straight wall it is the wall's rectangle widened on that side, where the right of travel from the
 * origin to `to` is the side of {@link wallOutline}'s first edge (Scene y grows downward). Inside a
 * ring it fills toward the center (a circle once it reaches it); outside, it widens the ring. Null
 * for a side the wall does not have, or a wall of no length.
 */
export function wallSideBandGeometry(
  origin: ScenePoint,
  shape: SpatialWallAreaShape,
  side: SpatialWallSide,
  distance: number
): SpatialGeometry | null {
  if (shape.kind === 'RING') {
    if (side === 'OUTSIDE')
      return { ...ringGeometry(origin, shape), outerRadius: shape.outerRadius + distance }
    if (side !== 'INSIDE') return null
    const innerRadius = shape.innerRadius - distance
    return innerRadius > EPSILON
      ? { ...ringGeometry(origin, shape), innerRadius }
      : { kind: 'CIRCLE', center: origin, radius: shape.outerRadius }
  }
  if (side !== 'LEFT' && side !== 'RIGHT') return null
  const { to } = shape
  const length = Math.hypot(to.x - origin.x, to.y - origin.y)
  if (!(length > EPSILON)) return null
  const half = shape.thickness / 2
  const [near, far] = side === 'RIGHT' ? [half + distance, -half] : [half, -half - distance]
  const unit = { x: -(to.y - origin.y) / length, y: (to.x - origin.x) / length }
  const offset = (point: ScenePoint, by: number) => ({
    x: point.x + unit.x * by,
    y: point.y + unit.y * by
  })
  return {
    kind: 'POLYGON',
    points: [offset(origin, near), offset(to, near), offset(to, far), offset(origin, far)]
  }
}

function ringGeometry(
  center: ScenePoint,
  shape: Extract<SpatialWallAreaShape, { kind: 'RING' }>
): Extract<SpatialGeometry, { kind: 'RING' }> {
  return {
    kind: 'RING',
    center,
    outerRadius: shape.outerRadius,
    innerRadius: shape.innerRadius
  }
}

/** A zone's wall as authored (D154): a straight wall's longest length or a ring's widest outer radius, and its thickness. */
export type AuthoredWallArea =
  | {
      readonly kind: 'WALL'
      readonly maxLength: AuthoredPointAreaLength
      readonly thickness: AuthoredPointAreaLength
    }
  | {
      readonly kind: 'RING'
      readonly maxOuterRadius: AuthoredPointAreaLength
      readonly thickness: AuthoredPointAreaLength
    }

/** The authored wall's bounds in Scene coordinates: its longest size and its thickness. Null for a size that is scaled or empty. */
export function wallAreaBoundsInSceneCoordinates(
  area: AuthoredWallArea,
  grid: SceneGrid
): { readonly maximum: number; readonly thickness: number } | null {
  const maximum = authoredLengthInSceneCoordinates(
    area.kind === 'WALL' ? area.maxLength : area.maxOuterRadius,
    grid
  )
  const thickness = authoredLengthInSceneCoordinates(area.thickness, grid)
  return maximum === null || thickness === null ? null : { maximum, thickness }
}

/** A directed area as authored. A line with no authored width is 5 feet wide (one square). */
export type AuthoredDirectedArea =
  | { readonly kind: 'CONE'; readonly length: AuthoredPointAreaLength }
  | {
      readonly kind: 'LINE'
      readonly length: AuthoredPointAreaLength
      readonly width?: AuthoredPointAreaLength
    }
  | { readonly kind: 'CUBE_FROM_SIDE'; readonly edgeLength: AuthoredPointAreaLength }

const FIVE_FEET: AuthoredPointAreaLength = { amount: 5, unit: 'FEET' }

/** The authored directed area's size in Scene coordinates. Null for a size that is scaled or empty. */
export function directedAreaSizeInSceneCoordinates(
  area: AuthoredDirectedArea,
  grid: SceneGrid
): SpatialDirectedAreaSize | null {
  if (area.kind === 'CUBE_FROM_SIDE') {
    const edgeLength = authoredLengthInSceneCoordinates(area.edgeLength, grid)
    // A gridless Scene has no cells, so the cube snaps to the 5 ft squares of the rules from (0, 0).
    const [cellSize, gridOrigin] =
      grid.kind === 'GRIDLESS'
        ? [authoredLengthInSceneCoordinates(FIVE_FEET, grid), { x: 0, y: 0 }]
        : [grid.cellSize, grid.origin]
    return edgeLength === null || cellSize === null
      ? null
      : { kind: 'CUBE_FROM_SIDE', edgeLength, cellSize, gridOrigin }
  }
  const length = authoredLengthInSceneCoordinates(area.length, grid)
  if (length === null) return null
  if (area.kind === 'CONE') return { kind: 'CONE', length }
  const width = authoredLengthInSceneCoordinates(area.width ?? FIVE_FEET, grid)
  return width === null ? null : { kind: 'LINE', length, width }
}

/** The authored directed area in Scene coordinates, aimed at `toward`; null for an unusable size. */
export function directedAreaInSceneCoordinates(
  area: AuthoredDirectedArea,
  toward: ScenePoint,
  grid: SceneGrid
): SpatialDirectedAreaShape | null {
  const size = directedAreaSizeInSceneCoordinates(area, grid)
  return size && { ...size, toward }
}

/**
 * The cube that extends from the side of `caster` the direction mostly faces, on the grid. Its face
 * is flush against that side and starts on one of the Scene's grid lines, in a place that still
 * shares some of the side with the caster. The places run in order along the side and where the
 * origin lies picks one: each place owns an equal share of the side.
 */
function cubeFromSideOutline(
  caster: SpatialTokenFootprint,
  origin: ScenePoint,
  shape: Extract<SpatialDirectedAreaShape, { kind: 'CUBE_FROM_SIDE' }>
): ScenePoint[] {
  const space = footprint(caster)
  const faceX = Math.abs(shape.toward.x - origin.x) >= Math.abs(shape.toward.y - origin.y)
  const out = Math.sign(faceX ? shape.toward.x - origin.x : shape.toward.y - origin.y)
  // `depth` runs out from the side the cube is on and `slide` along it.
  const [depthHalf, slideHalf] = faceX
    ? [space.halfWidth, space.halfHeight]
    : [space.halfHeight, space.halfWidth]
  const [depthCenter, slideCenter, slideOrigin, gridLine] = faceX
    ? [space.center.x, space.center.y, origin.y, shape.gridOrigin.y]
    : [space.center.y, space.center.x, origin.x, shape.gridOrigin.x]
  const { edgeLength, cellSize } = shape
  const sideLength = slideHalf * 2
  const sideStart = slideCenter - slideHalf
  // The grid lines a face may start on share positive length with the side: past `sideStart -
  // edgeLength` and before the side's end.
  const first = Math.floor((sideStart - edgeLength - gridLine) / cellSize + EPSILON) + 1
  const last = Math.ceil((sideStart + sideLength - gridLine) / cellSize - EPSILON) - 1
  const along = Math.min(Math.max((slideOrigin - sideStart) / sideLength, 0), 1)
  const place = Math.min(Math.floor(along * (last - first + 1)), last - first)
  const start = gridLine + (first + place) * cellSize
  const near = depthCenter + out * depthHalf
  const far = near + out * edgeLength
  const corner = (depth: number, slide: number): ScenePoint =>
    faceX ? { x: depth, y: slide } : { x: slide, y: depth }
  return [
    corner(near, start),
    corner(far, start),
    corner(far, start + edgeLength),
    corner(near, start + edgeLength)
  ]
}

/**
 * The polygon a directed area covers, in order around its edge, for a caster whose space is
 * `caster`. Null when `toward` is the origin (no direction) or a size is not a positive finite
 * number.
 */
export function directedAreaOutline(
  origin: ScenePoint,
  shape: SpatialDirectedAreaShape,
  caster: SpatialTokenFootprint
): ScenePoint[] | null {
  const dx = shape.toward.x - origin.x
  const dy = shape.toward.y - origin.y
  const distance = Math.hypot(dx, dy)
  const length = shape.kind === 'CUBE_FROM_SIDE' ? shape.edgeLength : shape.length
  const width = shape.kind === 'LINE' ? shape.width : length
  const sizes = shape.kind === 'CUBE_FROM_SIDE' ? [length, shape.cellSize] : [length, width]
  if (!(distance > EPSILON) || !sizes.every((size) => Number.isFinite(size) && size > 0))
    return null
  if (shape.kind === 'CUBE_FROM_SIDE')
    return validSpatialToken(caster) ? cubeFromSideOutline(caster, origin, shape) : null
  const axis = { x: dx / distance, y: dy / distance }
  const across = { x: -axis.y, y: axis.x }
  const far = { x: origin.x + axis.x * length, y: origin.y + axis.y * length }
  const beside = (point: ScenePoint, offset: number): ScenePoint => ({
    x: point.x + across.x * offset,
    y: point.y + across.y * offset
  })
  if (shape.kind === 'CONE') return [origin, beside(far, width / 2), beside(far, -width / 2)]
  return [
    beside(origin, width / 2),
    beside(far, width / 2),
    beside(far, -width / 2),
    beside(origin, -width / 2)
  ]
}

/** How far past the origin the direction is sampled to see whether it leaves the footprint. */
const ORIGIN_STEP = 1e-3

/**
 * Whether a directed area may start at `origin` for a caster whose space is `token`: the origin
 * lies on the edge or a corner of the footprint, the direction leaves the footprint (pointing
 * along an edge or into the space does not), and a cube's origin lies on the side its direction
 * faces. This is the one rule both the rules and the stage's aiming apply.
 */
export function isDirectedAreaOriginOnToken(input: {
  token: SpatialTokenFootprint
  origin: ScenePoint
  shape: SpatialDirectedAreaShape
}): boolean {
  const { token, origin, shape } = input
  const dx = shape.toward.x - origin.x
  const dy = shape.toward.y - origin.y
  const distance = Math.hypot(dx, dy)
  if (!validSpatialToken(token) || !(distance > EPSILON)) return false
  const space = footprint(token)
  const onEdge =
    pointInFootprint(origin, space) &&
    (Math.abs(origin.x - space.center.x) >= space.halfWidth - EPSILON ||
      Math.abs(origin.y - space.center.y) >= space.halfHeight - EPSILON)
  if (!onEdge) return false
  if (shape.kind !== 'CUBE_FROM_SIDE')
    return !pointInFootprint(
      { x: origin.x + (dx / distance) * ORIGIN_STEP, y: origin.y + (dy / distance) * ORIGIN_STEP },
      space
    )
  const [position, edge] =
    Math.abs(dx) >= Math.abs(dy)
      ? [origin.x - space.center.x, space.halfWidth * Math.sign(dx)]
      : [origin.y - space.center.y, space.halfHeight * Math.sign(dy)]
  return Math.abs(position - edge) <= EPSILON
}

/**
 * The point on the edge of `token`'s footprint nearest `point`: a point outside snaps to the
 * footprint, one inside to the nearest side. This is where the stage places a directed area's origin.
 */
export function nearestFootprintEdgePoint(
  token: SpatialTokenFootprint,
  point: ScenePoint
): ScenePoint {
  const { center, halfWidth, halfHeight } = footprint(token)
  const [left, right, top, bottom] = [
    center.x - halfWidth,
    center.x + halfWidth,
    center.y - halfHeight,
    center.y + halfHeight
  ]
  const clamped = {
    x: Math.min(Math.max(point.x, left), right),
    y: Math.min(Math.max(point.y, top), bottom)
  }
  if (clamped.x !== point.x || clamped.y !== point.y) return clamped
  return [
    { gap: point.x - left, edge: { x: left, y: point.y } },
    { gap: right - point.x, edge: { x: right, y: point.y } },
    { gap: point.y - top, edge: { x: point.x, y: top } },
    { gap: bottom - point.y, edge: { x: point.x, y: bottom } }
  ].reduce((nearest, side) => (side.gap < nearest.gap ? side : nearest)).edge
}

/**
 * The tokens whose footprint shares area with an area, sorted by id: touching its edge or a corner
 * of it never catches (user ruling 2026-10-14, D103). A cylinder's height is not modeled: the Scene
 * is flat. A directed area starts on the caster's own space, so it needs `casterTokenId` among
 * `tokens` (an invariant: it throws without) and never catches that token; a point area ignores the
 * caster. An invalid shape or token catches nothing (fails closed).
 */
export function spatialTokensInsideArea(input: {
  origin: ScenePoint
  shape: SpatialAreaShape
  tokens: readonly SpatialSceneToken[]
  casterTokenId?: string | null
}): string[] {
  const { origin, shape } = input
  const catches = (tokens: readonly SpatialSceneToken[], area: SpatialGeometry) =>
    tokens
      .filter(
        (token) =>
          validSpatialToken(token) && footprintOverlapsSpatialGeometry(footprint(token), area)
      )
      .map((token) => token.id)
      .sort()
  if (isDirectedAreaShape(shape)) {
    const caster = input.tokens.find((token) => token.id === input.casterTokenId)
    if (!caster) throw new Error('A directed area needs the caster’s token.')
    const outline = directedAreaOutline(origin, shape, caster)
    if (!outline) return []
    return catches(
      input.tokens.filter((token) => token !== caster),
      { kind: 'POLYGON', points: outline }
    )
  }
  const area = undirectedAreaGeometry(origin, shape)
  return area && validSpatialGeometry(area) ? catches(input.tokens, area) : []
}

/**
 * The tokens within `radius` of the caster's space, sorted by id, never the caster's own: "within N
 * feet of you" is measured from the edge of the space, not its center (D114). A footprint is caught
 * when it shares area with the space grown by `radius`, a rounded rectangle, which is the D103 rule
 * of {@link spatialTokensInsideArea} (touching never catches) applied to that grown space: the two
 * rectangles are closer than `radius`. `casterTokenId` must be among `tokens` (an invariant: it
 * throws without). An invalid radius or token catches nothing (fails closed).
 */
export function spatialTokensWithinSpaceRadius(input: {
  radius: number
  tokens: readonly SpatialSceneToken[]
  casterTokenId?: string | null
}): string[] {
  const caster = input.tokens.find((token) => token.id === input.casterTokenId)
  if (!caster) throw new Error('A caster-centered area needs the caster’s token.')
  if (!validSpatialToken(caster) || !(input.radius > 0) || !Number.isFinite(input.radius)) return []
  const space = footprint(caster)
  return input.tokens
    .filter((token) => token !== caster && validSpatialToken(token))
    .filter((token) => {
      const other = footprint(token)
      return (
        Math.hypot(
          Math.max(
            0,
            Math.abs(other.center.x - space.center.x) - space.halfWidth - other.halfWidth
          ),
          Math.max(
            0,
            Math.abs(other.center.y - space.center.y) - space.halfHeight - other.halfHeight
          )
        ) <
        input.radius - EPSILON
      )
    })
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
  shape: { readonly center: ScenePoint; readonly radius: number },
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
      : geometry.kind === 'RING'
        ? [
            ...candidateTimesForCircle(
              from,
              to,
              { center: geometry.center, radius: geometry.outerRadius },
              moving
            ),
            ...candidateTimesForCircle(
              from,
              to,
              { center: geometry.center, radius: geometry.innerRadius },
              moving
            ),
            // The footprint leaves the inner circle wholly when a corner crosses it.
            ...[-1, 1].flatMap((sx) =>
              [-1, 1].flatMap((sy) => {
                const offset = { x: sx * moving.halfWidth, y: sy * moving.halfHeight }
                return circleIntersectionTimes(
                  { x: from.x + offset.x, y: from.y + offset.y },
                  { x: to.x + offset.x, y: to.y + offset.y },
                  geometry.center,
                  geometry.innerRadius
                )
              })
            )
          ]
        : candidateTimesForPolygon(from, to, geometry, moving)
  return values
    .sort((left, right) => left - right)
    .filter((value, index, all) => index === 0 || Math.abs(value - all[index - 1]!) > EPSILON)
}

/**
 * The fraction (0 to 1) of the straight segment during which the token's footprint overlaps any of
 * the geometries, by the same overlap rule that raises an ENTER contact.
 */
export function spatialSegmentShareInside(input: {
  readonly geometries: readonly SpatialGeometry[]
  readonly token: SpatialTokenFootprint
  readonly from: ScenePoint
  readonly to: ScenePoint
}): number {
  return segmentSpans({ ...input, zones: input.geometries.map((geometry) => ({ geometry })) })
    .filter(({ inside }) => inside.length > 0)
    .reduce((share, span) => share + span.share, 0)
}

/**
 * The multiplier a straight segment's movement costs on average (D154): each stretch costs the
 * highest of `floor` (the terrain multiplier) and the multipliers of the zones the footprint
 * overlaps there, by the overlap rule that raises an ENTER contact. Multipliers never stack.
 */
export function spatialSegmentMovementMultiplier(input: {
  readonly zones: readonly { readonly geometry: SpatialGeometry; readonly multiplier: number }[]
  readonly token: SpatialTokenFootprint
  readonly from: ScenePoint
  readonly to: ScenePoint
  readonly floor: number
}): number {
  const spans = segmentSpans(input)
  if (!spans.length) return input.floor
  return spans.reduce(
    (total, { share, inside }) =>
      total + share * Math.max(input.floor, ...inside.map(({ multiplier }) => multiplier)),
    0
  )
}

/** A zone that changes what moving through it costs (D154): its area, multiplier and whom it spares. */
export type SpatialMovementCostZone = Pick<
  SpatialEffectInstance,
  'anchorKind' | 'geometry' | 'sourceTokenId' | 'unaffectedActorIds' | 'suppressed'
> & { readonly multiplier: number }

/**
 * The per-segment multiplier a mover's walk pays inside zones (D154), for
 * `measureScenePathMovementCost`; undefined when no zone slows the mover. A zone slows only a mover
 * it catches ({@link spatialEffectAffects}), and never the token it moves with: Spirit Guardians
 * does not slow its caster, while a wall the caster placed does.
 */
export function zoneMovementSegmentMultiplier(input: {
  readonly zones: readonly SpatialMovementCostZone[]
  readonly mover: { readonly actorId: string; readonly tokenId: string }
  readonly tokens: readonly SpatialSceneToken[]
  /** A grappler dragging a creature not two sizes smaller pays double on top (D105). */
  readonly dragDoublesCost?: boolean
}): ((from: ScenePoint, to: ScenePoint, floor: number) => number) | undefined {
  const { mover, tokens } = input
  const token = tokens.find(({ id }) => id === mover.tokenId)
  const zones = input.zones.flatMap((zone) => {
    if (
      zone.multiplier <= 1 ||
      !spatialEffectAffects(zone, mover.actorId) ||
      (zone.anchorKind === 'TOKEN' && zone.sourceTokenId === mover.tokenId)
    )
      return []
    const geometry = effectiveSpatialGeometry(zone, tokens)
    return geometry ? [{ geometry, multiplier: zone.multiplier }] : []
  })
  const zoned: ((from: ScenePoint, to: ScenePoint, floor: number) => number) | undefined =
    token && zones.length
      ? (from, to, floor) => spatialSegmentMovementMultiplier({ zones, token, from, to, floor })
      : undefined
  return input.dragDoublesCost
    ? (from, to, floor) => (zoned?.(from, to, floor) ?? floor) * 2
    : zoned
}

/**
 * A straight segment cut where the footprint enters or leaves any zone, each stretch with its share
 * of the segment and the zones the footprint overlaps there. Empty for an invalid token.
 */
function segmentSpans<Zone extends { readonly geometry: SpatialGeometry }>(input: {
  readonly zones: readonly Zone[]
  readonly token: SpatialTokenFootprint
  readonly from: ScenePoint
  readonly to: ScenePoint
}): { share: number; inside: Zone[] }[] {
  const zones = input.zones.filter(({ geometry }) => validSpatialGeometry(geometry))
  if (!validSpatialToken(input.token)) return []
  const moving = footprint(input.token)
  const times = [
    ...new Set([
      0,
      1,
      ...zones.flatMap(({ geometry }) => candidateTimes(input.from, input.to, geometry, moving))
    ])
  ].sort((left, right) => left - right)
  return times.slice(1).map((end, index) => {
    const start = times[index]!
    const midpoint = footprint(input.token, interpolate(input.from, input.to, (start + end) / 2))
    return {
      share: end - start,
      inside: zones.filter(({ geometry }) => footprintOverlapsSpatialGeometry(midpoint, geometry))
    }
  })
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
      const before = footprintOverlapsSpatialGeometry(
        footprint(input.token, interpolate(from, to, (prior + progress) / 2)),
        input.geometry
      )
      const after = footprintOverlapsSpatialGeometry(
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
  const start = footprintOverlapsSpatialGeometry(footprint(input.token, first), input.geometry)
  const end = footprintOverlapsSpatialGeometry(footprint(input.token, last), input.geometry)
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

/**
 * Where along the path each whole `step` the token travels overlapping the geometry completes,
 * counted from the path's start whether it begins inside or outside. Distance inside is measured
 * as movement is on the Scene's grid (D154), each segment's measure shared by the stretch the
 * footprint overlaps. A last step short by no more than a tenth of a step completes where the
 * overlap ends.
 */
function distanceStepContacts(input: {
  readonly geometry: SpatialGeometry
  readonly path: readonly ScenePoint[]
  /** The mover's own path, whose grid measure the steps count. */
  readonly measuredPath: readonly ScenePoint[]
  readonly grid: SceneGrid
  readonly token: SpatialSceneToken
  readonly step: number
}): { pathDistance: number; step: number }[] {
  const contacts: { pathDistance: number; step: number }[] = []
  let travelled = 0
  let measuredBefore = 0
  let inside = 0
  let lastInsideEnd = 0
  for (let index = 1; index < input.path.length; index += 1) {
    const from = input.path[index - 1]!
    const to = input.path[index]!
    const length = Math.hypot(to.x - from.x, to.y - from.y)
    const measuredTo = measureScenePathDistance(input.grid, input.measuredPath.slice(0, index + 1))
    const measured = measuredTo - measuredBefore
    measuredBefore = measuredTo
    let progress = 0
    for (const span of segmentSpans({
      zones: [{ geometry: input.geometry }],
      token: input.token,
      from,
      to
    })) {
      const spanStart = travelled + length * progress
      progress += span.share
      const spanMeasure = measured * span.share
      if (!span.inside.length || spanMeasure <= EPSILON) continue
      while (inside + spanMeasure + EPSILON >= (contacts.length + 1) * input.step) {
        const step = contacts.length + 1
        const share = (step * input.step - inside) / spanMeasure
        contacts.push({ pathDistance: spanStart + length * span.share * share, step })
      }
      inside += spanMeasure
      lastInsideEnd = spanStart + length * span.share
    }
    travelled += length
  }
  if (inside + input.step / 10 + EPSILON >= (contacts.length + 1) * input.step)
    contacts.push({ pathDistance: lastInsideEnd, step: contacts.length + 1 })
  return contacts
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

/** The order a move settles its candidates in: along the path, then by a stable identity. */
export function compareSpatialMovementCandidates(
  left: SpatialMovementCandidate,
  right: SpatialMovementCandidate
): number {
  return (
    left.pathDistance - right.pathDistance ||
    compareText(left.effectId, right.effectId) ||
    compareText(left.targetActorId, right.targetActorId) ||
    compareText(left.trigger, right.trigger) ||
    (left.step ?? 0) - (right.step ?? 0)
  )
}

/**
 * Collect deterministic full-footprint contact facts: how the mover meets each effect (enters,
 * leaves or passes through). It does not decide which contacts an effect acts on (the rules
 * runtime's event table does), execute an effect, or mutate scene state.
 */
export function collectSpatialMovementCandidates(input: {
  readonly actorIdByTokenId: ReadonlyMap<string, string>
  readonly effects: readonly SpatialEffectInstance[]
  readonly movementKind: SpatialMovementKind
  readonly path: readonly ScenePoint[]
  /** The Scene's grid, which measures distance moved inside a zone acting per distance moved. */
  readonly grid: SceneGrid
  readonly tokens: readonly SpatialSceneToken[]
  readonly movingTokenId: string
  /** The voluntary mover chose to move carefully: fields that allow it raise no candidate. */
  readonly carefully?: boolean
  /** What the Run recorded for the current turn; effects with a per-turn limit stop catching at it. */
  readonly zoneApplications?: ZoneApplications
  readonly turnSequence: number
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
    if (input.carefully && effect.bypassAtHalfSpeed && input.movementKind === 'VOLUNTARY') continue
    const sourceMoved =
      effect.anchorKind === 'TOKEN' && effect.sourceTokenId === input.movingTokenId
    const targets = sourceMoved
      ? input.tokens.filter(
          (token) => token.id !== input.movingTokenId && input.actorIdByTokenId.has(token.id)
        )
      : [movingToken]
    for (const target of targets) {
      const targetActorId = input.actorIdByTokenId.get(target.id)
      if (!targetActorId || !spatialEffectAffects(effect, targetActorId)) continue
      const geometry = sourceMoved
        ? effect.geometry.frame === 'TOKEN_LOCAL'
          ? effect.geometry.shape
          : null
        : effectiveSpatialGeometry(effect, input.tokens)
      if (!geometry) continue
      const path = sourceMoved ? relativeSourcePath(target, input.path) : input.path
      if (!path) continue
      if (effect.distanceStep !== undefined) {
        if (input.movementKind === 'TELEPORT') continue
        for (const { pathDistance, step } of distanceStepContacts({
          geometry,
          path,
          measuredPath: input.path,
          grid: input.grid,
          token: target,
          step: effect.distanceStep
        })) {
          const contact = pathPointAtDistance(input.path, pathDistance)
          if (!contact || !isAbsolutePoint(contact)) continue
          candidates.push({
            contact,
            effectId: effect.effectId,
            pathDistance,
            sourceActorId: effect.sourceActorId,
            sourceMoved,
            targetActorId,
            trigger: 'ENTER',
            step
          })
        }
        continue
      }
      const trigger = movementTrigger({
        geometry,
        kind: input.movementKind,
        path,
        token: target
      })
      if (!trigger) continue
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
    const key = `${candidate.effectId}:${candidate.targetActorId}:${candidate.trigger}:${candidate.step ?? 0}`
    const existing = unique.get(key)
    if (!existing || candidate.pathDistance < existing.pathDistance) unique.set(key, candidate)
  }
  const limits = new Map(
    input.effects.map((effect) => [effect.effectId, effect.maxApplicationsPerTurn])
  )
  return [...unique.values()].sort(compareSpatialMovementCandidates).filter((candidate) => {
    const limit = limits.get(candidate.effectId)
    return (
      limit === undefined ||
      zoneApplicationsSpent(
        input.zoneApplications,
        input.turnSequence,
        zoneApplicationKey(candidate.effectId, candidate.targetActorId)
      ) < limit
    )
  })
}

export interface SpatialTurnCandidate {
  readonly effectId: string
  readonly sourceActorId: string | null
  readonly targetActorId: string
  readonly trigger: SpatialTurnTrigger
}

/**
 * The effects a creature stands in at a turn boundary: those whose area the target's footprint
 * currently shares area with (or lies wholly inside, for an effect that requires it), that do not
 * exempt it and whose per-turn limit is not spent. Like {@link collectSpatialMovementCandidates}
 * it only reports contact facts; whether an effect acts at `trigger` is the event table's.
 */
export function collectSpatialTurnCandidates(input: {
  readonly actorIdByTokenId: ReadonlyMap<string, string>
  readonly effects: readonly SpatialEffectInstance[]
  readonly targetTokenId: string
  readonly tokens: readonly SpatialSceneToken[]
  readonly trigger: SpatialTurnTrigger
  readonly zoneApplications?: ZoneApplications
  readonly turnSequence: number
}): SpatialTurnCandidate[] {
  const target = input.tokens.find((token) => token.id === input.targetTokenId)
  const targetActorId = input.actorIdByTokenId.get(input.targetTokenId)
  if (!target || !targetActorId || input.tokens.some((token) => !validSpatialToken(token)))
    return []
  const tokenIds = new Set(input.tokens.map((token) => token.id))
  return input.effects
    .filter((effect) => {
      if (
        !validSpatialEffect(effect, tokenIds) ||
        !spatialEffectAffects(effect, targetActorId) ||
        (effect.maxApplicationsPerTurn !== undefined &&
          zoneApplicationsSpent(
            input.zoneApplications,
            input.turnSequence,
            zoneApplicationKey(effect.effectId, targetActorId)
          ) >= effect.maxApplicationsPerTurn)
      )
        return false
      const geometry = effectiveSpatialGeometry(effect, input.tokens)
      if (!geometry) return false
      return effect.requiresFullyWithin
        ? footprintWithinSpatialGeometry(footprint(target), geometry)
        : spatialGeometryOverlapsTokenFootprint({ geometry, token: target })
    })
    .map((effect) => ({
      effectId: effect.effectId,
      sourceActorId: effect.sourceActorId,
      targetActorId,
      trigger: input.trigger
    }))
    .sort((left, right) => compareText(left.effectId, right.effectId))
}

export interface SpatialMeleeRetaliationCandidate {
  readonly effectId: string
  readonly sourceActorId: string
  readonly targetActorId: string
}

/**
 * The effects a melee hit's attacker stands in (D153): those anchored to the hit creature's token
 * whose area the attacker's footprint shares area with and that do not exempt it. The attacker is
 * the target of each. Like {@link collectSpatialTurnCandidates} it only reports contact facts;
 * whether an effect retaliates is the event table's.
 */
export function collectSpatialMeleeRetaliationCandidates(input: {
  readonly actorIdByTokenId: ReadonlyMap<string, string>
  readonly effects: readonly SpatialEffectInstance[]
  readonly attackerTokenId: string
  readonly hitTokenId: string
  readonly tokens: readonly SpatialSceneToken[]
}): SpatialMeleeRetaliationCandidate[] {
  const attacker = input.tokens.find((token) => token.id === input.attackerTokenId)
  const attackerActorId = input.actorIdByTokenId.get(input.attackerTokenId)
  const hitActorId = input.actorIdByTokenId.get(input.hitTokenId)
  if (
    !attacker ||
    !attackerActorId ||
    !hitActorId ||
    attackerActorId === hitActorId ||
    input.tokens.some((token) => !validSpatialToken(token))
  )
    return []
  const tokenIds = new Set(input.tokens.map((token) => token.id))
  return input.effects
    .filter((effect) => {
      if (
        effect.anchorKind !== 'TOKEN' ||
        effect.sourceTokenId !== input.hitTokenId ||
        effect.sourceActorId !== hitActorId ||
        !validSpatialEffect(effect, tokenIds) ||
        !spatialEffectAffects(effect, attackerActorId)
      )
        return false
      const geometry = effectiveSpatialGeometry(effect, input.tokens)
      return (
        geometry !== null && spatialGeometryOverlapsTokenFootprint({ geometry, token: attacker })
      )
    })
    .map((effect) => ({
      effectId: effect.effectId,
      sourceActorId: hitActorId,
      targetActorId: attackerActorId
    }))
    .sort((left, right) => compareText(left.effectId, right.effectId))
}
