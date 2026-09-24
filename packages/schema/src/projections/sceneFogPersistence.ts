import { z } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { projectionChecksumSchema } from './identity.js'
import { sceneFogPatchInputSchema, sceneFogChunkReferenceSchema } from '../api/sceneFog.js'
import { sceneFogChunkDtoSchema } from '../api/vttScenes.js'

export const sceneStoredFogLayerSchema = z.strictObject({
  sceneId: postgresUuidSchema,
  ownerUserId: z.nullable(postgresUuidSchema),
  width: z.number().check(z.int()).check(z.gte(1)).check(z.lte(512)),
  height: z.number().check(z.int()).check(z.gte(1)).check(z.lte(512)),
  ordinal: z.number().check(z.int()).check(z.nonnegative()),
  version: z.number().check(z.int()).check(z.positive()),
  chunks: z.array(sceneFogChunkReferenceSchema).check(z.maxLength(256)),
  checksum: projectionChecksumSchema
})

export const sceneStoredFogSaveSchema = z.strictObject({
  id: postgresUuidSchema,
  sceneId: postgresUuidSchema,
  commandId: postgresUuidSchema,
  actorUserId: postgresUuidSchema,
  geometrySaveId: z.optional(postgresUuidSchema),
  input: sceneFogPatchInputSchema,
  inputChecksum: projectionChecksumSchema,
  status: z.enum(['RECEIVING', 'PUBLISHED', 'EXPIRED']),
  receivedChunks: z.number().check(z.int()).check(z.gte(0)).check(z.lte(256)),
  expiresAt: z.number().check(z.int()).check(z.nonnegative()),
  chunksRemoved: z.boolean(),
  previousLayer: z.optional(z.nullable(sceneStoredFogLayerSchema))
})
export const sceneStoredFogChunkSchema = z.strictObject({
  saveId: postgresUuidSchema,
  ordinal: z.number().check(z.int()).check(z.gte(0)).check(z.lte(255)),
  chunk: sceneFogChunkDtoSchema,
  checksum: projectionChecksumSchema
})
