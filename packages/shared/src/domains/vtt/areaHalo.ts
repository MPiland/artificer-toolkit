import type { ScenePoint } from './scene.js'
import {
  pointCubeOutline,
  wallOutline,
  type SpatialGeometry,
  type SpatialPointAreaShape,
  type SpatialWallAreaShape
} from './spatial.js'

const EPSILON = 1e-8

/**
 * The Scene geometry within `reach` of an area (D223): its circle, cube, wall or ring grown by
 * `reach` on every side (a wall also past its ends). A cube's or wall's corners stay square, so the
 * halo reaches slightly past `reach` there. A ring whose hole `reach` closes becomes a circle.
 * Null for a wall of no length.
 */
export function expandedAreaGeometry(
  origin: ScenePoint,
  shape: SpatialPointAreaShape | SpatialWallAreaShape,
  reach: number
): SpatialGeometry | null {
  switch (shape.kind) {
    case 'RADIUS':
      return { kind: 'CIRCLE', center: origin, radius: shape.radius + reach }
    case 'CUBE':
      return { kind: 'POLYGON', points: pointCubeOutline(origin, shape.edgeLength + 2 * reach) }
    case 'RING': {
      const innerRadius = shape.innerRadius - reach
      const outerRadius = shape.outerRadius + reach
      return innerRadius > EPSILON
        ? { kind: 'RING', center: origin, outerRadius, innerRadius }
        : { kind: 'CIRCLE', center: origin, radius: outerRadius }
    }
    case 'WALL': {
      const length = Math.hypot(shape.to.x - origin.x, shape.to.y - origin.y)
      if (!(length > EPSILON)) return null
      const along = { x: (shape.to.x - origin.x) / length, y: (shape.to.y - origin.y) / length }
      const points = wallOutline(
        { x: origin.x - along.x * reach, y: origin.y - along.y * reach },
        { x: shape.to.x + along.x * reach, y: shape.to.y + along.y * reach },
        shape.thickness + 2 * reach
      )
      return points && { kind: 'POLYGON', points }
    }
  }
}
