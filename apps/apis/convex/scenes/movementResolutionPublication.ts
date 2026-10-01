import type { sceneGeometryFinishInputSchema } from '@artificer-toolkit/schema/api/sceneGeometry'
import type { EncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/api/encounters'
import {
  publishMovementResponse as publishSharedMovementResponse,
  type MovementResponsePublicationCallbacks as SharedMovementResponsePublicationCallbacks
} from '@artificer-toolkit/encounter-persistence/movementResolutionPublication'
import type { MutationCtx } from '../_generated/server'
import { readGeometrySave } from './geometryDocuments'
import { readResponse, type Geometry } from './movementResolutionDocuments'
import { encounterWriteTransaction } from '../encounters/encounterPorts'

type MovementResponsePublicationCallbacks = {
  commit: (
    ctx: MutationCtx,
    request: ReturnType<typeof sceneGeometryFinishInputSchema.parse>,
    response: Awaited<ReturnType<typeof readResponse>>
  ) => ReturnType<SharedMovementResponsePublicationCallbacks['commit']>
  project: SharedMovementResponsePublicationCallbacks['project']
}

/** The caller publishes the matching token and fog in this same mutation. */
export async function publishMovementResponse(
  ctx: MutationCtx,
  request: ReturnType<typeof sceneGeometryFinishInputSchema.parse>,
  geometry: Geometry | null,
  callbacks: MovementResponsePublicationCallbacks
): Promise<{ occurrence: EncounterRuleOccurrenceSummaryDto }> {
  return publishSharedMovementResponse(encounterWriteTransaction(ctx), request, geometry, {
    readGeometrySave: (saveId) => readGeometrySave(ctx, saveId),
    readSceneReceipt: (sceneId, commandId) =>
      ctx.db
        .query('sceneLiveCommands')
        .withIndex('by_sceneId_commandId', (q) =>
          q.eq('sceneId', sceneId).eq('commandId', commandId)
        )
        .unique(),
    readResponse: (saveId, geometry) => readResponse(ctx, saveId, geometry),
    commit: (request, response) => callbacks.commit(ctx, request, response),
    project: callbacks.project
  })
}
