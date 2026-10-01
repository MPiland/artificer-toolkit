import type { sceneGeometryFinishInputSchema } from '@artificer-toolkit/schema/api/sceneGeometry'
import type { EncounterProjectionCharacterStates } from '@artificer-toolkit/schema/projections/encounterProjectionInput'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounters'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { publishSpatialPending as publishSharedSpatialPending } from '@artificer-toolkit/encounter-persistence/spatialPendingPublication'
import type { MutationCtx } from '../_generated/server'
import { readGeometrySave } from './geometryDocuments'
import type { readSpatialSceneGeometry } from './spatialGeometry'
import { encounterWriteTransaction } from '../encounters/encounterPorts'

type SceneSpatialPrepareInput = ReturnType<typeof sceneGeometryFinishInputSchema.parse>
type SpatialPendingGeometry = Awaited<ReturnType<typeof readSpatialSceneGeometry>>

export type SpatialPendingPublicationCallbacks<TSettlement> = {
  evaluateInitial: (
    ctx: MutationCtx,
    request: SceneSpatialPrepareInput,
    identity: Pick<SceneSpatialPreparation, 'occurrenceId' | 'occurredAt'>,
    retained: Extract<SceneSpatialPreparation['outcome'], { kind: 'PENDING' }>,
    geometry: SpatialPendingGeometry
  ) => Promise<{ outcome: SceneSpatialPreparation['outcome']; settlements: readonly TSettlement[] }>
  settle: (
    ctx: MutationCtx,
    settlements: readonly TSettlement[]
  ) => Promise<{
    mechanicsChanged: boolean
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

/** The caller commits the matching token and clipped fog in this same mutation. */
export async function publishSpatialPending<TSettlement>(
  ctx: MutationCtx,
  request: ReturnType<typeof sceneGeometryFinishInputSchema.parse>,
  geometry: Awaited<ReturnType<typeof readSpatialSceneGeometry>> | null,
  callbacks: SpatialPendingPublicationCallbacks<TSettlement>
) {
  return publishSharedSpatialPending<TSettlement, SpatialPendingGeometry>(
    encounterWriteTransaction(ctx),
    request,
    geometry,
    {
      readGeometrySave: (saveId) => readGeometrySave(ctx, saveId),
      evaluateInitial: (request, identity, retained, geometry) =>
        callbacks.evaluateInitial(ctx, request, identity, retained, geometry),
      settle: (settlements) => callbacks.settle(ctx, settlements),
      project: callbacks.project
    }
  )
}
