import type {
  CampaignSceneStateDto,
  SceneCommandInputDto,
  SceneDefinitionDto
} from '@artificer-toolkit/schema/api/vttScenes'

type LiveSceneObjectSection = 'ANNOTATION' | 'BARRIER' | 'DARKNESS' | 'LIGHT' | 'TOKEN'

export interface LiveSceneObjectSelection {
  id: string
  section: LiveSceneObjectSection
}

interface LiveSceneObjectOption {
  label: string
  selection: LiveSceneObjectSelection
  value: string
}

export function listLiveSceneObjectOptions(scene: CampaignSceneStateDto): LiveSceneObjectOption[] {
  return [
    ...scene.tokens.map((token) => option('TOKEN', token.id, `Token · ${token.label}`)),
    ...scene.barriers.map((barrier, index) =>
      option(
        'BARRIER',
        barrier.id,
        `Barrier ${index + 1} · ${barrier.kind.replace('_', ' ').toLowerCase()}`
      )
    ),
    ...scene.lights.map((light, index) =>
      option('LIGHT', light.id, `Light ${index + 1} · ${light.kind.toLowerCase()}`)
    ),
    ...scene.darknessZones.map((zone, index) =>
      option('DARKNESS', zone.id, `Darkness zone ${index + 1}`)
    ),
    ...scene.annotations.map((annotation, index) =>
      option('ANNOTATION', annotation.id, `Note ${index + 1} · ${annotation.text}`)
    )
  ]
}

export function createLiveSceneObjectDraft(
  scene: CampaignSceneStateDto,
  selection: LiveSceneObjectSelection
): SceneDefinitionDto | null {
  const draft: SceneDefinitionDto = {
    annotations: [],
    ambientIllumination: scene.ambientIllumination,
    barriers: [],
    campaignId: scene.campaignId,
    daylight: scene.daylight,
    darknessZones: [],
    fogMode: scene.fogMode,
    grid: scene.grid,
    id: scene.definitionId,
    lights: [],
    map: scene.map,
    name: scene.name,
    tokens: [],
    version: scene.definitionVersion,
    visionRevealMode: scene.visionRevealMode
  }

  switch (selection.section) {
    case 'ANNOTATION': {
      const annotation = scene.annotations.find((candidate) => candidate.id === selection.id)
      return annotation ? { ...draft, annotations: [annotation] } : null
    }
    case 'BARRIER': {
      const barrier = scene.barriers.find((candidate) => candidate.id === selection.id)
      return barrier ? { ...draft, barriers: [barrier] } : null
    }
    case 'DARKNESS': {
      const zone = scene.darknessZones.find((candidate) => candidate.id === selection.id)
      return zone ? { ...draft, darknessZones: [zone] } : null
    }
    case 'LIGHT': {
      const light = scene.lights.find((candidate) => candidate.id === selection.id)
      return light ? { ...draft, lights: [light] } : null
    }
    case 'TOKEN': {
      const token = scene.tokens.find((candidate) => candidate.id === selection.id)
      return token ? { ...draft, tokens: [token] } : null
    }
  }
}

export function createLiveSceneObjectUpsertCommand({
  draft,
  expectedSceneVersion,
  scene,
  selection
}: {
  draft: SceneDefinitionDto
  expectedSceneVersion: number
  scene: CampaignSceneStateDto
  selection: LiveSceneObjectSelection
}): SceneCommandInputDto | null {
  const base = commandBase(scene, expectedSceneVersion)
  switch (selection.section) {
    case 'ANNOTATION': {
      const annotation = draft.annotations[0]
      return annotation ? { ...base, annotation, type: 'UPSERT_SCENE_ANNOTATION' } : null
    }
    case 'BARRIER': {
      const barrier = draft.barriers[0]
      return barrier ? { ...base, barrier, type: 'UPSERT_SCENE_BARRIER' } : null
    }
    case 'DARKNESS': {
      const zone = draft.darknessZones[0]
      return zone ? { ...base, type: 'UPSERT_SCENE_DARKNESS', zone } : null
    }
    case 'LIGHT': {
      const light = draft.lights[0]
      return light ? { ...base, light, type: 'UPSERT_SCENE_LIGHT' } : null
    }
    case 'TOKEN': {
      const token = draft.tokens[0]
      return token ? { ...base, token, type: 'UPSERT_SCENE_TOKEN' } : null
    }
  }
}

export function createLiveSceneObjectRemoveCommand({
  expectedSceneVersion,
  scene,
  selection
}: {
  expectedSceneVersion: number
  scene: CampaignSceneStateDto
  selection: LiveSceneObjectSelection
}): SceneCommandInputDto {
  const base = commandBase(scene, expectedSceneVersion)
  switch (selection.section) {
    case 'ANNOTATION':
      return { ...base, annotationId: selection.id, type: 'REMOVE_SCENE_ANNOTATION' }
    case 'BARRIER':
      return { ...base, barrierId: selection.id, type: 'REMOVE_SCENE_BARRIER' }
    case 'DARKNESS':
      return { ...base, type: 'REMOVE_SCENE_DARKNESS', zoneId: selection.id }
    case 'LIGHT':
      return { ...base, lightId: selection.id, type: 'REMOVE_SCENE_LIGHT' }
    case 'TOKEN':
      return { ...base, tokenId: selection.id, type: 'REMOVE_SCENE_TOKEN' }
  }
}

export function createLiveSceneCreationCommand({
  before,
  next,
  expectedSceneVersion,
  scene
}: {
  before: SceneDefinitionDto
  next: SceneDefinitionDto
  expectedSceneVersion: number
  scene: CampaignSceneStateDto
}): SceneCommandInputDto | null {
  const base = commandBase(scene, expectedSceneVersion)
  const annotation = next.annotations.find(
    (item) => !before.annotations.some((prior) => prior.id === item.id)
  )
  if (annotation) return { ...base, annotation, type: 'UPSERT_SCENE_ANNOTATION' }
  const barrier = next.barriers.find(
    (item) => !before.barriers.some((prior) => prior.id === item.id)
  )
  if (barrier) return { ...base, barrier, type: 'UPSERT_SCENE_BARRIER' }
  const zone = next.darknessZones.find(
    (item) => !before.darknessZones.some((prior) => prior.id === item.id)
  )
  if (zone) return { ...base, type: 'UPSERT_SCENE_DARKNESS', zone }
  const light = next.lights.find((item) => !before.lights.some((prior) => prior.id === item.id))
  if (light) return { ...base, light, type: 'UPSERT_SCENE_LIGHT' }
  const token = next.tokens.find((item) => !before.tokens.some((prior) => prior.id === item.id))
  return token ? { ...base, token, type: 'UPSERT_SCENE_TOKEN' } : null
}

function commandBase(scene: CampaignSceneStateDto, expectedSceneVersion: number) {
  return {
    commandId: crypto.randomUUID(),
    expectedSceneVersion,
    sceneId: scene.id
  }
}

function option(section: LiveSceneObjectSection, id: string, label: string): LiveSceneObjectOption {
  return { label, selection: { id, section }, value: `${section}:${id}` }
}
