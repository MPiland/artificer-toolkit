import { sceneGeometryFinishInputSchema } from '@artificer-toolkit/schema/api/sceneGeometry'
import type { EncounterProjectionCharacterStates } from '@artificer-toolkit/schema/projections/encounterProjectionInput'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounters'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import type { SceneToken } from '@artificer-toolkit/shared/vtt/scene'
import { publishSpatialTerminal as publishEncounterSpatialTerminal } from '@artificer-toolkit/encounter-persistence/spatialTerminalPublication'
import type { MutationCtx } from '../_generated/server'
import { readGeometrySave } from './geometryDocuments'
import { encounterWriteTransaction } from '../encounters/encounterPorts'

type SceneSpatialPrepareInput = ReturnType<typeof sceneGeometryFinishInputSchema.parse>
type SpatialTerminalGeometry = {
  sceneTokens: readonly SceneToken[]
  actorIdByTokenId: ReadonlyMap<string, string>
}

export type SpatialTerminalPublicationCallbacks = {
  settle: (
    ctx: MutationCtx,
    saveId: string,
    geometry: SpatialTerminalGeometry,
    request?: SceneSpatialPrepareInput
  ) => Promise<{
    result: Extract<SceneSpatialPreparation['outcome'], { kind: 'TERMINAL' }>['result']
    characterTransitions: readonly {
      characterId: string
      beforeStreamVersion: number
      afterStreamVersion: number
    }[]
  }>
  project: (
    state: EncounterRunState,
    actors: EncounterRunActorState[],
    characterStates: EncounterProjectionCharacterStates
  ) => EncounterCommandResultDto['projection']
}

/** The parent must publish the prepared Scene/token/fog changes in this same mutation. */
export async function publishSpatialTerminal(
  ctx: MutationCtx,
  saveId: string,
  geometry: SpatialTerminalGeometry,
  request: SceneSpatialPrepareInput | undefined,
  callbacks: SpatialTerminalPublicationCallbacks
) {
  return publishEncounterSpatialTerminal(
    encounterWriteTransaction(ctx),
    saveId,
    geometry,
    request,
    {
      readGeometrySave: (saveId) => readGeometrySave(ctx, saveId),
      settle: (saveId, geometry, request) => callbacks.settle(ctx, saveId, geometry, request),
      project: callbacks.project
    }
  )
}
