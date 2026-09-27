import { z, lazySchema } from '../zod.js'

import { campaignSceneStateDtoSchema } from '../api/vttScenes.js'
import { projectionChecksumSchema, projectionIdentifierSchema } from './identity.js'

const nonNegativeStreamVersionSchema = lazySchema(() => z.number().check(z.int()).check(z.gte(0)))

export const SCENE_CURRENT_PROJECTION_SCHEMA_VERSION = 2

export const sceneCurrentProjectionSchema = lazySchema(() =>
  z
    .strictObject({
      sceneId: projectionIdentifierSchema,
      streamVersion: nonNegativeStreamVersionSchema,
      projectionSchemaVersion: z.literal(SCENE_CURRENT_PROJECTION_SCHEMA_VERSION),
      projectionChecksum: projectionChecksumSchema,
      projection: campaignSceneStateDtoSchema
    })
    .check(
      z.superRefine((value, context) => {
        if (value.projection.id !== value.sceneId) {
          context.addIssue({
            code: 'custom',
            message: 'Scene projection identity must match its aggregate identity.',
            path: ['projection', 'id']
          })
        }
        if (value.projection.version !== value.streamVersion) {
          context.addIssue({
            code: 'custom',
            message: 'Scene projection version must match its aggregate stream version.',
            path: ['projection', 'version']
          })
        }
      })
    )
)

export type SceneCurrentProjection = z.infer<typeof sceneCurrentProjectionSchema>
