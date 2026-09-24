import { publishPreparedMovementResponse } from './movementResolutionPublication.helper'
import { publishPreparedSpatialTerminal } from './spatialPublication.helper'
import { publishPreparedSpatialPending } from './spatialPendingPublication.helper'
import { verifyPreparedUninterruptedMovement } from './spatialCommit.helper'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  sceneGeometryCommandResultSchema,
  type SceneGeometryCommandResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import { internalMutation } from '../lib/mutations'
import type { MutationCtx } from '../_generated/server'
import type { readGeometrySave } from './geometryDocuments'
import { publishSceneGeometry } from './geometryPublication'

type SceneGeometryFinishInput = ReturnType<typeof sceneSpatialPrepareInputSchema.parse>
type SceneGeometrySaveRead = Awaited<ReturnType<typeof readGeometrySave>>

export async function finishSceneGeometry(
  ctx: MutationCtx,
  args: SceneGeometryFinishInput,
  previouslyRead?: SceneGeometrySaveRead
): Promise<SceneGeometryCommandResult> {
  return publishSceneGeometry(
    ctx,
    args,
    {
      publishPreparedMovementResponse,
      publishPreparedSpatialPending,
      publishPreparedSpatialTerminal,
      verifyPreparedUninterruptedMovement
    },
    previouslyRead
  )
}

export const finish = internalMutation({
  args: zodToConvexFields(sceneSpatialPrepareInputSchema.shape),
  returns: zodToConvex(sceneGeometryCommandResultSchema),
  handler: finishSceneGeometry
})
