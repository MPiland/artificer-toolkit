import { describe, expect, it } from 'vitest'
import {
  createLiveSceneCreationCommand,
  createLiveSceneObjectDraft,
  createLiveSceneObjectRemoveCommand,
  createLiveSceneObjectUpsertCommand,
  listLiveSceneObjectOptions
} from './CampaignLiveSceneObjectEditor.model'
import { createSceneObject, type SceneCreationKind } from './SceneObjectCreator.model'
import { tabletopLiveScene as scene } from './CampaignTabletop.stories.fixtures'
import {
  sceneDefinitionDtoSchema,
  type SceneDefinitionDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { validated } from '../../../test/validatedFixture'

describe('CampaignLiveSceneObjectEditor model', () => {
  it('builds one editable draft and one versioned command for every live object kind', () => {
    const options = listLiveSceneObjectOptions(scene)

    expect(new Set(options.map((option) => option.selection.section))).toEqual(
      new Set(['ANNOTATION', 'BARRIER', 'DARKNESS', 'LIGHT', 'TOKEN'])
    )

    for (const option of options) {
      const draft = createLiveSceneObjectDraft(scene, option.selection)
      expect(draft).not.toBeNull()
      if (!draft) continue

      const upsert = createLiveSceneObjectUpsertCommand({
        draft,
        expectedSceneVersion: 17,
        scene,
        selection: option.selection
      })
      const remove = createLiveSceneObjectRemoveCommand({
        expectedSceneVersion: 17,
        scene,
        selection: option.selection
      })

      expect(upsert).toMatchObject({
        expectedSceneVersion: 17,
        sceneId: scene.id
      })
      expect(remove).toMatchObject({
        expectedSceneVersion: 17,
        sceneId: scene.id
      })
    }
  })

  it('fails closed when the selected object is no longer present', () => {
    expect(
      createLiveSceneObjectDraft(scene, {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        section: 'TOKEN'
      })
    ).toBeNull()
  })

  it.each([
    ['WALL', 'UPSERT_SCENE_BARRIER'],
    ['DOOR', 'UPSERT_SCENE_BARRIER'],
    ['WINDOW', 'UPSERT_SCENE_BARRIER'],
    ['ONE_WAY', 'UPSERT_SCENE_BARRIER'],
    ['TERRAIN', 'UPSERT_SCENE_BARRIER'],
    ['LIGHT', 'UPSERT_SCENE_LIGHT'],
    ['DARKNESS', 'UPSERT_SCENE_DARKNESS'],
    ['TOKEN', 'UPSERT_SCENE_TOKEN'],
    ['ANNOTATION', 'UPSERT_SCENE_ANNOTATION']
  ] satisfies ReadonlyArray<readonly [SceneCreationKind, string]>)(
    'creates one authoritative %s command from the DOM creator',
    (kind, expectedType) => {
      const before = sceneDefinition()
      const next = createSceneObject(before, kind, { x: 40, y: 50 }, 25)

      expect(
        createLiveSceneCreationCommand({
          before,
          expectedSceneVersion: scene.version,
          next,
          scene
        })
      ).toMatchObject({
        expectedSceneVersion: scene.version,
        sceneId: scene.id,
        type: expectedType
      })
    }
  )
})

function sceneDefinition(): SceneDefinitionDto {
  return validated(sceneDefinitionDtoSchema)({
    annotations: scene.annotations,
    ambientIllumination: scene.ambientIllumination,
    daylight: scene.daylight,
    barriers: scene.barriers,
    campaignId: scene.campaignId,
    darknessZones: scene.darknessZones,
    fogMode: scene.fogMode,
    grid: scene.grid,
    id: scene.definitionId,
    lights: scene.lights,
    map: scene.map,
    name: scene.name,
    tokens: scene.tokens,
    version: scene.definitionVersion,
    visionRevealMode: scene.visionRevealMode
  })
}
