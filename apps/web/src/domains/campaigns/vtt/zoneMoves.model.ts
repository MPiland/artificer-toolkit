import type { SpatialGeometry } from '@artificer-toolkit/shared/vtt'
import { spatialGeometryCenter } from '@artificer-toolkit/shared/vtt/spatialGeometryCenter'
import type { VttAreaSize } from './vttSceneRenderer.model'

/**
 * The circle that covers a placed zone, centered where the zone is: what the stage draws around the
 * destination while the caster picks where the moved zone will be centered (QUALITY-15.T3y8).
 */
export function zoneFootprintAreaSize(shape: SpatialGeometry): VttAreaSize {
  if (shape.kind === 'CIRCLE') return { kind: 'RADIUS', radius: shape.radius }
  if (shape.kind === 'RING') return { kind: 'RADIUS', radius: shape.outerRadius }
  const center = spatialGeometryCenter(shape)
  return {
    kind: 'RADIUS',
    radius: Math.max(
      ...shape.points.map((point) => Math.hypot(point.x - center.x, point.y - center.y))
    )
  }
}
