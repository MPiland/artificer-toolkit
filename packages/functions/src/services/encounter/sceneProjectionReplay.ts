import { canonicalizeJson, checksumSceneCurrentProjection } from '@artificer-toolkit/db'
import { campaignSceneStateDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import {
  replaySceneEvents,
  type CampaignSceneState,
  type SceneDefinition,
  type SceneEvent
} from '@artificer-toolkit/shared/vtt'
import {
  SCENE_CURRENT_PROJECTION_SCHEMA_VERSION,
  sceneCurrentProjectionSchema,
  type SceneCurrentProjection
} from '@artificer-toolkit/schema/projections/scene'

import { EncounterConflictError } from './encounterErrors.js'

export function compileSceneCurrentProjection(
  projection: CampaignSceneState
): SceneCurrentProjection {
  const candidate = sceneCurrentProjectionSchema.parse({
    sceneId: projection.id,
    streamVersion: projection.version,
    projectionSchemaVersion: SCENE_CURRENT_PROJECTION_SCHEMA_VERSION,
    projectionChecksum: '0'.repeat(64),
    projection
  })
  return sceneCurrentProjectionSchema.parse({
    ...candidate,
    projectionChecksum: checksumSceneCurrentProjection(candidate)
  })
}

export function replayCampaignSceneProjection(input: {
  definition: SceneDefinition
  events: readonly SceneEvent[]
  sceneId: string
}): CampaignSceneState {
  return campaignSceneStateDtoSchema.parse(
    replaySceneEvents(input.definition, input.sceneId, input.events)
  )
}

export function assertCampaignSceneProjectionReplay(input: {
  definition: SceneDefinition
  events: readonly SceneEvent[]
  projection: CampaignSceneState
  sceneId: string
}): CampaignSceneState {
  const replayed = replayCampaignSceneProjection(input)
  const persisted = campaignSceneStateDtoSchema.parse(input.projection)
  if (canonicalizeJson(replayed) !== canonicalizeJson(persisted)) {
    throw new EncounterConflictError('Encounter scene projection does not match its event replay.')
  }
  return replayed
}
