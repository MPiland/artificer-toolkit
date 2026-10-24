import { describe, expect, it } from 'vitest'
import {
  sceneDefinitionDtoSchema,
  type SceneDefinitionDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { createEditorSceneState, updateSceneEditorDraft } from './CampaignSceneEditor.model'
import { validated } from '../../../test/validatedFixture'

const ids = {
  annotation: '00000000-0000-4000-8000-000000000001',
  asset: '00000000-0000-4000-8000-000000000002',
  campaign: '00000000-0000-4000-8000-000000000003',
  controlledToken: '00000000-0000-4000-8000-000000000007',
  door: '00000000-0000-4000-8000-000000000004',
  scene: '00000000-0000-4000-8000-000000000005',
  token: '00000000-0000-4000-8000-000000000006'
} as const

function scene(): SceneDefinitionDto {
  return validated(sceneDefinitionDtoSchema)({
    annotations: [
      {
        id: ids.annotation,
        position: { x: 10, y: 10 },
        text: 'GM note',
        visibility: 'GM_ONLY'
      }
    ],
    barriers: [
      {
        a: { x: 20, y: 0 },
        b: { x: 20, y: 20 },
        blocksLightWhenClosed: true,
        blocksMovementWhenClosed: true,
        id: ids.door,
        initialState: 'OPEN',
        kind: 'DOOR',
        openAngleDegrees: -90
      }
    ],
    ambientIllumination: 'BRIGHT',
    daylight: false,
    campaignId: ids.campaign,
    darknessZones: [],
    fogMode: 'SHARED_PARTY',
    visionRevealMode: 'ON_DROP',
    grid: { kind: 'GRIDLESS', pixelsPerUnit: 5, unit: 'FEET' },
    id: ids.scene,
    lights: [],
    map: { assetId: ids.asset, height: 100, tileManifestAssetId: null, width: 100 },
    name: 'Prepared scene',
    tokens: [
      {
        assetId: null,
        controlledByUserIds: [],
        height: 10,
        hidden: true,
        id: ids.token,
        label: 'Hidden token',
        locked: false,
        position: { x: 5, y: 5 },
        rotationDegrees: 0,
        senses: [],
        vision: null,
        width: 10
      },
      {
        assetId: null,
        controlledByUserIds: [ids.campaign],
        height: 10,
        hidden: false,
        id: ids.controlledToken,
        label: 'Controlled token',
        locked: false,
        position: { x: 30, y: 30 },
        rotationDegrees: 0,
        senses: [],
        vision: null,
        width: 10
      }
    ],
    version: 2
  })
}

describe('Campaign scene editor model', () => {
  it('materializes door presentation and filters hidden editor content in player preview', () => {
    const owner = createEditorSceneState(scene(), null)
    const player = createEditorSceneState(scene(), ids.campaign)

    expect(owner.doorStates).toEqual({ [ids.door]: 'OPEN' })
    expect(owner.barriers[0]).toMatchObject({ openAngleDegrees: -90 })
    expect(owner.annotations).toHaveLength(1)
    expect(owner.tokens).toHaveLength(2)
    expect(player.annotations).toEqual([])
    expect(player.barriers).toEqual([])
    expect(player.tokens.map((token) => token.id)).toEqual([ids.controlledToken])
  })

  it('does not apply editor mutations while a save is pending', () => {
    const current = scene()
    const rename = (draft: SceneDefinitionDto) => ({ ...draft, name: 'Changed after save' })

    expect(updateSceneEditorDraft(current, rename, true)).toBe(current)
    expect(updateSceneEditorDraft(current, rename, false).name).toBe('Changed after save')
  })

  it('supports a focused inspector edit and removal through the shared draft', () => {
    const current = scene()
    const removeDoor = (draft: SceneDefinitionDto) => ({
      ...draft,
      barriers: draft.barriers.filter((barrier) => barrier.id !== ids.door),
      tokens: draft.tokens.map((token) =>
        token.id === ids.token ? { ...token, label: 'Hidden warden' } : token
      )
    })

    expect(updateSceneEditorDraft(current, removeDoor, true)).toBe(current)
    expect(updateSceneEditorDraft(current, removeDoor, false)).toMatchObject({
      barriers: [],
      tokens: [{ label: 'Hidden warden' }, { label: 'Controlled token' }]
    })
  })
})
