import { canonicalizeJson, checksumSceneCurrentProjection } from '@artificer-toolkit/db'
import { encounterSceneStateDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import {
  replaySceneEvents,
  type EncounterSceneState,
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
  projection: EncounterSceneState
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

export function replayEncounterSceneProjection(input: {
  definition: SceneDefinition
  encounterId: string
  events: readonly SceneEvent[]
  sceneId: string
}): EncounterSceneState {
  return encounterSceneStateDtoSchema.parse(
    replaySceneEvents(input.definition, input.encounterId, input.sceneId, input.events)
  )
}

export function assertEncounterSceneProjectionReplay(input: {
  definition: SceneDefinition
  encounterId: string
  events: readonly SceneEvent[]
  projection: EncounterSceneState
  sceneId: string
}): EncounterSceneState {
  const replayed = replayEncounterSceneProjection(input)
  const persisted = encounterSceneStateDtoSchema.parse(input.projection)
  if (canonicalizeJson(replayed) !== canonicalizeJson(persisted)) {
    throw new EncounterConflictError('Encounter scene projection does not match its event replay.')
  }
  return replayed
}
