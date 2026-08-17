import type { SceneBarrier, SceneLight } from '@artificer-toolkit/shared/vtt'

export function convertSceneLightKind(light: SceneLight, kind: 'CONE' | 'POINT'): SceneLight {
  if (kind === 'POINT') {
    return {
      brightRadius: light.brightRadius,
      color: light.color,
      dimRadius: light.dimRadius,
      id: light.id,
      intensity: light.intensity,
      kind,
      position: light.position
    }
  }
  return {
    ...light,
    angleDegrees: light.kind === 'CONE' ? light.angleDegrees : 90,
    directionDegrees: light.kind === 'CONE' ? light.directionDegrees : 0,
    kind
  }
}

export function sceneBarrierLabel(barrier: SceneBarrier): string {
  return barrier.kind.replace('_', ' ').toLowerCase()
}
