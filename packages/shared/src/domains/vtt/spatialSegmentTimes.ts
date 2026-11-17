import type { ScenePoint } from './scene.js'
import type { SpatialGeometry } from './spatial.js'

export const EPSILON = 1e-8

/** A footprint's half extents; a point moves with zero extents. */
type FootprintExtent = { readonly halfHeight: number; readonly halfWidth: number }

/** The point `progress` (0 to 1) of the way along the segment. */
export function interpolate(from: ScenePoint, to: ScenePoint, progress: number): ScenePoint {
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
  moving: FootprintExtent
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
  moving: FootprintExtent
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

/**
 * The progress values (0 to 1, sorted, distinct) along a straight segment at which a footprint of
 * the given extents may start or stop overlapping the geometry, including both ends. Between two
 * neighbors the overlap does not change, so one midpoint sample decides each stretch.
 */
export function candidateTimes(
  from: ScenePoint,
  to: ScenePoint,
  geometry: SpatialGeometry,
  moving: FootprintExtent
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
