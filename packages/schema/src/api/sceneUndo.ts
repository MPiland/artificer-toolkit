import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import {
  scenePointDtoSchema,
  sceneTokenFacingCommandInputDtoSchema,
  sceneUndoLastMoveCommandInputDtoSchema
} from './vttScenes.js'
import { scenePresentationFenceSchema } from './sceneGeometry.js'

export const sceneUndoExecuteInputSchema = lazySchema(() =>
  z.strictObject({
    input: sceneUndoLastMoveCommandInputDtoSchema,
    presentation: z.optional(scenePresentationFenceSchema)
  })
)

const tokenMoveUndoneSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('TOKEN_MOVE_UNDONE'),
    tokenId: postgresUuidSchema,
    position: scenePointDtoSchema,
    rotationDegrees: z.optional(sceneTokenFacingCommandInputDtoSchema.shape.rotationDegrees),
    undoneCommandId: postgresUuidSchema
  })
)

export const sceneUndoCommandResultSchema = lazySchema(() =>
  z.strictObject({
    commandId: postgresUuidSchema,
    sceneId: postgresUuidSchema,
    version: z.number().check(z.int()).check(z.positive()),
    replayed: z.boolean(),
    occurrence: z.null(),
    /** A drag's undo restores the mover, then each token it dragged, as one batch (D105). */
    delta: z.union([
      tokenMoveUndoneSchema,
      z.strictObject({
        kind: z.literal('BATCH'),
        deltas: z.array(tokenMoveUndoneSchema).check(z.minLength(2)).check(z.maxLength(102))
      })
    ]),
    restoredFogOwners: z.array(z.nullable(postgresUuidSchema)).check(z.maxLength(101))
  })
)

export type SceneUndoExecuteInput = z.infer<typeof sceneUndoExecuteInputSchema>
export type SceneUndoCommandResult = z.infer<typeof sceneUndoCommandResultSchema>
