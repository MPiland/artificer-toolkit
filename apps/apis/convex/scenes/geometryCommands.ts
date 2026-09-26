import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  sceneGeometryFinishInputSchema,
  sceneGeometryCommandResultSchema,
  type SceneGeometryCommandResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import { internalMutation } from '../lib/mutations'
import type { MutationCtx } from '../_generated/server'
import type { readGeometrySave } from './geometryDocuments'
import { publishSceneGeometry } from './geometryPublication'

type SceneGeometryFinishInput = ReturnType<typeof sceneGeometryFinishInputSchema.parse>
type SceneGeometrySaveRead = Awaited<ReturnType<typeof readGeometrySave>>

/** Publishes a Scene change without Encounter rules; the room commits bound movement (D43). */
export async function finishSceneGeometry(
  ctx: MutationCtx,
  args: SceneGeometryFinishInput,
  previouslyRead?: SceneGeometrySaveRead
): Promise<SceneGeometryCommandResult> {
  return publishSceneGeometry(ctx, args, null, previouslyRead)
}

export const finish = internalMutation({
  args: zodToConvexFields(sceneGeometryFinishInputSchema.shape),
  returns: zodToConvex(sceneGeometryCommandResultSchema),
  handler: finishSceneGeometry
})
