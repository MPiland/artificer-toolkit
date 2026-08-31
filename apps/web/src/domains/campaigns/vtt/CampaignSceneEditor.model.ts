import type {
  CampaignSceneStateDto,
  SceneDefinitionDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { projectSceneForViewer } from '@artificer-toolkit/shared/vtt'

export function createEditorSceneState(
  scene: SceneDefinitionDto,
  previewUserId: string | null
): CampaignSceneStateDto {
  const doorStates: CampaignSceneStateDto['doorStates'] = {}
  for (const barrier of scene.barriers) {
    if (barrier.kind === 'DOOR') doorStates[barrier.id] = barrier.initialState
  }
  const materialized: CampaignSceneStateDto = {
    ...structuredClone(scene),
    annotations: structuredClone(scene.annotations),
    definitionId: scene.id,
    definitionVersion: scene.version,
    doorStates,
    fogLayers: [],
    id: scene.id,
    measurements: [],
    tokens: structuredClone(scene.tokens)
  }
  return previewUserId
    ? projectSceneForViewer(materialized, { role: 'PLAYER', userId: previewUserId })
    : materialized
}

export function updateSceneEditorDraft(
  current: SceneDefinitionDto,
  change: (scene: SceneDefinitionDto) => SceneDefinitionDto,
  frozen: boolean
): SceneDefinitionDto {
  return frozen ? current : change(current)
}
