import { describe, expect, it } from 'vitest'
import type { SceneLight } from '@artificer-toolkit/shared/vtt'
import { convertSceneLightKind, sceneBarrierLabel } from './CampaignSceneObjectInspector.model'

const pointLight: SceneLight = {
  brightRadius: 10,
  color: '#ffffff',
  dimRadius: 20,
  id: '00000000-0000-4000-8000-000000000001',
  intensity: 0.8,
  kind: 'POINT',
  position: { x: 1, y: 2 }
}

describe('Campaign scene object inspector model', () => {
  it('converts a selected point light to a cone without changing its common properties', () => {
    expect(convertSceneLightKind(pointLight, 'CONE')).toMatchObject({
      angleDegrees: 90,
      brightRadius: 10,
      directionDegrees: 0,
      kind: 'CONE'
    })
  })

  it('uses a readable label for a selected barrier', () => {
    expect(
      sceneBarrierLabel({
        a: { x: 0, y: 0 },
        b: { x: 1, y: 1 },
        blockedDirection: 'LEFT_TO_RIGHT',
        blocksLight: true,
        blocksMovement: true,
        id: '00000000-0000-4000-8000-000000000002',
        kind: 'ONE_WAY'
      })
    ).toBe('one way')
  })
})
