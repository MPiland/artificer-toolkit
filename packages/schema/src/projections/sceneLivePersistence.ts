import { z } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { projectionChecksumSchema } from './identity.js'
import {
  sceneLiveEntityChangeSchema,
  sceneLiveCountsSchema,
  sceneLiveCollectionSchema
} from '../api/sceneLiveState.js'
import {
  sceneLiveCommandInputDtoSchema,
  sceneCommandResultDtoSchema,
  sceneDefinitionSettingsDtoSchema
} from '../api/vttScenes.js'
import {
  sceneGeometryCommandResultSchema,
  sceneNativeGeometryCommandInputSchema
} from '../api/sceneGeometry.js'
import { sceneFogPatchInputSchema, sceneFogCommandResultSchema } from '../api/sceneFog.js'
import { sceneUndoExecuteInputSchema, sceneUndoCommandResultSchema } from '../api/sceneUndo.js'

export const sceneStoredLiveStateSchema = z.strictObject({
  sceneId: postgresUuidSchema,
  version: z.number().check(z.int()).check(z.positive()),
  fogLayerCount: z.number().check(z.int()).check(z.gte(0)).check(z.lte(101)),
  nextFogOrdinal: z.number().check(z.int()).check(z.nonnegative()),
  settings: z.strictObject({
    ambientIllumination: z.strictObject({
      value: sceneDefinitionSettingsDtoSchema.shape.ambientIllumination,
      version: z.number().check(z.int()).check(z.nonnegative())
    }),
    visionRevealMode: z.strictObject({
      value: sceneDefinitionSettingsDtoSchema.shape.visionRevealMode,
      version: z.number().check(z.int()).check(z.nonnegative())
    })
  }),
  counts: sceneLiveCountsSchema,
  nextOrdinals: z.record(
    sceneLiveCollectionSchema,
    z.number().check(z.int()).check(z.nonnegative())
  )
})
export const sceneStoredLiveEntitySchema = z.extend(sceneLiveEntityChangeSchema, {
  sceneId: postgresUuidSchema,
  checksum: projectionChecksumSchema
})
const commandIdentity = {
  sceneId: postgresUuidSchema,
  commandId: postgresUuidSchema,
  actorUserId: postgresUuidSchema,
  inputChecksum: projectionChecksumSchema,
  resultChecksum: projectionChecksumSchema,
  undoneCommandId: z.optional(postgresUuidSchema)
}
export const sceneStoredInlineCommandSchema = z.strictObject({
  ...commandIdentity,
  encoding: z.literal('INLINE'),
  input: sceneLiveCommandInputDtoSchema,
  result: sceneCommandResultDtoSchema
})
export const sceneStoredFogCommandSchema = z.strictObject({
  ...commandIdentity,
  encoding: z.literal('FOG_PATCH'),
  input: sceneFogPatchInputSchema,
  result: sceneFogCommandResultSchema
})
export const sceneStoredGeometryCommandSchema = z.strictObject({
  ...commandIdentity,
  encoding: z.literal('GEOMETRY'),
  input: sceneNativeGeometryCommandInputSchema,
  result: sceneGeometryCommandResultSchema
})
export const sceneStoredUndoCommandSchema = z.strictObject({
  ...commandIdentity,
  encoding: z.literal('UNDO'),
  input: sceneUndoExecuteInputSchema.shape.input,
  result: sceneUndoCommandResultSchema
})
export const sceneStoredLiveCommandSchema = z.discriminatedUnion('encoding', [
  sceneStoredInlineCommandSchema,
  sceneStoredFogCommandSchema,
  sceneStoredGeometryCommandSchema,
  sceneStoredUndoCommandSchema
])
