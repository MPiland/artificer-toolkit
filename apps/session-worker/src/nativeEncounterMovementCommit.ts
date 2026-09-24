import {
  liveSessionMovementBeginInputSchema,
  type LiveSessionMovementBeginInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterMovement'
import {
  liveSessionMovementPrepareInputSchema,
  liveSessionMovementCommitInputSchema,
  type LiveSessionMovementPrepareInput,
  type LiveSessionMovementCommitInput
} from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import {
  sceneGeometryBeginResultSchema,
  sceneGeometryCommandResultSchema
} from '@artificer-toolkit/schema/api/sceneGeometry'
import { sceneSpatialPreparationSchema } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { requestNativeLiveSession, type NativeLiveSessionEnvironment } from './nativeSceneClient.js'

export function beginNativeLiveMovement(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
  input: LiveSessionMovementBeginInput
) {
  return requestNativeLiveSession(
    environment,
    accessToken,
    '/live-sessions/encounter-movement-begin',
    liveSessionMovementBeginInputSchema.parse(input),
    (body) => sceneGeometryBeginResultSchema.parse(body)
  )
}

export function stageNativeLiveMovement(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
  input: LiveSessionMovementPrepareInput
) {
  return requestNativeLiveSession(
    environment,
    accessToken,
    '/live-sessions/encounter-movement-prepare',
    liveSessionMovementPrepareInputSchema.parse(input),
    (body) => sceneSpatialPreparationSchema.parse(body)
  )
}

export function commitNativeLiveMovement(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
  input: LiveSessionMovementCommitInput
) {
  return requestNativeLiveSession(
    environment,
    accessToken,
    '/live-sessions/encounter-movement',
    liveSessionMovementCommitInputSchema.parse(input),
    (body) => sceneGeometryCommandResultSchema.parse(body)
  )
}
