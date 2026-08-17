import type { SceneDefinitionDto } from '@artificer-toolkit/schema/api/vttScenes'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import {
  createSceneAnnotation,
  createSceneBarrier,
  createSceneDarknessZone,
  createSceneLight,
  createSceneToken
} from './CampaignVttStage.model'

export type SceneCreationKind =
  | 'ANNOTATION'
  | 'DOOR'
  | 'DARKNESS'
  | 'LIGHT'
  | 'ONE_WAY'
  | 'TERRAIN'
  | 'TOKEN'
  | 'WALL'
  | 'WINDOW'

export function sceneCreationDefaults(scene: Pick<SceneDefinitionDto, 'grid' | 'map'>): {
  length: number
  x: number
  y: number
} {
  const size = scene.grid.kind === 'SQUARE' ? scene.grid.cellSize : scene.grid.pixelsPerUnit
  const x = Math.floor(scene.map.width / 2)
  const y = Math.floor(scene.map.height / 2)
  return {
    length: Math.max(1, Math.min(size, scene.map.width - x, scene.map.height - y)),
    x,
    y
  }
}

export function createSceneObject(
  scene: SceneDefinitionDto,
  kind: SceneCreationKind,
  point: ScenePoint,
  length: number
): SceneDefinitionDto {
  const origin = {
    x: Math.max(0, Math.min(scene.map.width - 1, point.x)),
    y: Math.max(0, Math.min(scene.map.height - 1, point.y))
  }
  const horizontalLength = Math.max(1, Math.min(length, scene.map.width - origin.x))
  const areaSize = Math.max(
    1,
    Math.min(length, scene.map.width - origin.x, scene.map.height - origin.y)
  )
  const end = { x: origin.x + horizontalLength, y: origin.y }
  switch (kind) {
    case 'WALL':
    case 'DOOR':
    case 'WINDOW':
    case 'ONE_WAY':
    case 'TERRAIN':
      return { ...scene, barriers: [...scene.barriers, createSceneBarrier(kind, origin, end)] }
    case 'LIGHT':
      return { ...scene, lights: [...scene.lights, createSceneLight(origin)] }
    case 'DARKNESS': {
      const zone = createSceneDarknessZone(origin, {
        x: origin.x + areaSize,
        y: origin.y + areaSize
      })
      return zone ? { ...scene, darknessZones: [...scene.darknessZones, zone] } : scene
    }
    case 'TOKEN':
      return {
        ...scene,
        tokens: [...scene.tokens, createSceneToken(scene.grid, scene.tokens.length, origin)]
      }
    case 'ANNOTATION':
      return {
        ...scene,
        annotations: [...scene.annotations, createSceneAnnotation(scene.annotations.length, origin)]
      }
  }
}
