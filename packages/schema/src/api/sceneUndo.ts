import { z } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { scenePointDtoSchema, sceneUndoLastMoveCommandInputDtoSchema } from './vttScenes.js'
import { sceneGeometrySessionInputSchema } from './sceneGeometry.js'

const version = z.number().check(z.int()).check(z.nonnegative())

export const sceneUndoExecuteInputSchema = z.strictObject({
  input: sceneUndoLastMoveCommandInputDtoSchema,
  session: z.optional(sceneGeometrySessionInputSchema)
})

export const sceneUndoCommandResultSchema = z.strictObject({
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

export const sceneUndoPrepareInputSchema = z.extend(sceneUndoExecuteInputSchema, {
  cursor: z.nullable(z.string())
})
export const sceneUndoPrepareResultSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('REPLAY'), result: sceneUndoCommandResultSchema }),
  z.strictObject({
    kind: z.literal('READY'),
    targetCommandId: postgresUuidSchema,
    beforeVersion: version
  }),
  z.strictObject({ kind: z.literal('NEXT'), cursor: z.string() })
])
export const sceneUndoFinishInputSchema = z.extend(sceneUndoExecuteInputSchema, {
  targetCommandId: postgresUuidSchema
})

export type SceneUndoExecuteInput = z.infer<typeof sceneUndoExecuteInputSchema>
export type SceneUndoCommandResult = z.infer<typeof sceneUndoCommandResultSchema>
export type SceneUndoPrepareInput = z.infer<typeof sceneUndoPrepareInputSchema>
export type SceneUndoPrepareResult = z.infer<typeof sceneUndoPrepareResultSchema>
export type SceneUndoFinishInput = z.infer<typeof sceneUndoFinishInputSchema>
