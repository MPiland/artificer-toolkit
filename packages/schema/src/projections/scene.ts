import { z } from 'zod'

import { encounterSceneStateDtoSchema } from '../api/vttScenes.js'
import {
  projectionChecksumSchema,
  projectionIdentifierSchema,
  projectionSchemaVersionSchema
} from './identity.js'

const nonNegativeStreamVersionSchema = z.number().int().min(0)

export const SCENE_CURRENT_PROJECTION_SCHEMA_VERSION = 1

export const sceneCurrentProjectionSchema = z
  .strictObject({
    sceneId: projectionIdentifierSchema,
    streamVersion: nonNegativeStreamVersionSchema,
    projectionSchemaVersion: projectionSchemaVersionSchema,
    projectionChecksum: projectionChecksumSchema,
    projection: encounterSceneStateDtoSchema
  })
  .superRefine((value, context) => {
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

export type SceneCurrentProjection = z.infer<typeof sceneCurrentProjectionSchema>
