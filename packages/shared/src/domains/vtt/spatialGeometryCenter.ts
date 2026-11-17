import type { ScenePoint } from './scene.js'
import type { SpatialGeometry } from './spatial.js'

/** The point a geometry is centered on: its circle's or ring's center, or its outline's vertex average. */
export function spatialGeometryCenter(shape: SpatialGeometry): ScenePoint {
  if (shape.kind !== 'POLYGON') return shape.center
  const sum = shape.points.reduce(
    (total, point) => ({ x: total.x + point.x, y: total.y + point.y }),
    { x: 0, y: 0 }
  )
  return { x: sum.x / shape.points.length, y: sum.y / shape.points.length }
}

/** The geometry moved whole so it is centered on `center`: its size and orientation unchanged. */
export function spatialGeometryCenteredAt<Shape extends SpatialGeometry>(
  shape: Shape,
  center: ScenePoint
): Shape | { kind: 'POLYGON'; points: ScenePoint[] } {
  if (shape.kind !== 'POLYGON') return { ...shape, center }
  const from = spatialGeometryCenter(shape)
  return {
    kind: 'POLYGON',
    points: shape.points.map((point) => ({
      x: point.x + center.x - from.x,
      y: point.y + center.y - from.y
    }))
  }
}
