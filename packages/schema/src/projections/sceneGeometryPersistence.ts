import { z } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { projectionChecksumSchema } from './identity.js'
import { sceneNativeGeometryCommandInputSchema } from '../api/sceneGeometry.js'
import {
  sceneSessionVisionScopeSchema,
  sceneSessionVisionCharacterRevisionsSchema
} from '../api/sceneSessionVision.js'

export const sceneStoredGeometrySaveSchema = z.strictObject({
  id: postgresUuidSchema,
  sceneId: postgresUuidSchema,
  commandId: postgresUuidSchema,
  actorUserId: postgresUuidSchema,
  input: sceneNativeGeometryCommandInputSchema,
  inputChecksum: projectionChecksumSchema,
  spatialPreparationJson: z.optional(z.string()),
  spatialPreparationChecksum: z.optional(projectionChecksumSchema),
  movementResolution: z.optional(
    z.strictObject({
      commandJson: z.string(),
      commandChecksum: projectionChecksumSchema,
      pendingSnapshotJson: z.string(),
      pendingSnapshotChecksum: projectionChecksumSchema
    })
  ),
  snapshotVersion: z.number().check(z.int()).check(z.nonnegative()),
  sessionVision: z.optional(sceneSessionVisionScopeSchema),
  characterRevisions: z.optional(sceneSessionVisionCharacterRevisionsSchema),
  status: z.enum(['RECEIVING', 'PUBLISHED', 'EXPIRED']),
  expiresAt: z.number().check(z.int()).check(z.nonnegative()),
  fogSaves: z
    .array(
      z.strictObject({
        saveId: postgresUuidSchema,
        ownerUserId: z.nullable(postgresUuidSchema)
      })
    )
    .check(z.maxLength(101))
})

export type SceneStoredGeometrySave = z.infer<typeof sceneStoredGeometrySaveSchema>
