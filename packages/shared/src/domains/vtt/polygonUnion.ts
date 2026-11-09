import polygonClipping, { type MultiPolygon } from 'polygon-clipping'
import type { ScenePolygon } from './scene.js'

function toMultiPolygon(polygon: ScenePolygon): MultiPolygon {
  return [[polygon.points.map((point) => [point.x, point.y])]]
}

export function unionScenePolygons(polygons: readonly ScenePolygon[]): MultiPolygon {
  if (polygons.length === 0) return []
  const [first, ...rest] = polygons
  if (!first) return []
  return polygonClipping.union(toMultiPolygon(first), ...rest.map(toMultiPolygon))
}
