import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { scenePointDtoSchema, sceneUndoLastMoveCommandInputDtoSchema } from './vttScenes.js'
import { scenePresentationFenceSchema } from './sceneGeometry.js'

export const sceneUndoExecuteInputSchema = lazySchema(() =>
  z.strictObject({
    input: sceneUndoLastMoveCommandInputDtoSchema,
    presentation: z.optional(scenePresentationFenceSchema)
  })
)

export const sceneUndoCommandResultSchema = lazySchema(() =>
  z.strictObject({
    commandId: postgresUuidSchema,
    sceneId: postgresUuidSchema,
    version: z.number().check(z.int()).check(z.positive()),
    replayed: z.boolean(),
    occurrence: z.null(),
    delta: z.strictObject({
      kind: z.literal('TOKEN_MOVE_UNDONE'),
      tokenId: postgresUuidSchema,
      position: scenePointDtoSchema,
      undoneCommandId: postgresUuidSchema
    }),
    restoredFogOwners: z.array(z.nullable(postgresUuidSchema)).check(z.maxLength(101))
  })
)

export type SceneUndoExecuteInput = z.infer<typeof sceneUndoExecuteInputSchema>
export type SceneUndoCommandResult = z.infer<typeof sceneUndoCommandResultSchema>
