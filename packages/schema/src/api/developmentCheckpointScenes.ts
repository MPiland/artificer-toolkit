import { z, lazySchema } from '../zod.js'
import { developmentCheckpointScopeSchema } from './developmentCheckpoint.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { projectionChecksumSchema } from '../projections/identity.js'
import { liveSessionCheckpointSceneSchemas } from './liveSessionCheckpointScenes.js'

export const developmentCheckpointSceneInputSchema = lazySchema(() =>
  z.strictObject({
    scope: developmentCheckpointScopeSchema,
    sceneId: postgresUuidSchema
  })
)
export const developmentCheckpointSceneInspectionSchema = lazySchema(() =>
  z.strictObject({
    digest: projectionChecksumSchema,
    version: z.number().check(z.int()).check(z.nonnegative()),
    presentationVersion: z.number().check(z.int()).check(z.nonnegative()),
    counts: z.record(
      z.enum(
        Object.keys(liveSessionCheckpointSceneSchemas) as [
          keyof typeof liveSessionCheckpointSceneSchemas,
          ...(keyof typeof liveSessionCheckpointSceneSchemas)[]
        ]
      ),
      z.number().check(z.int()).check(z.nonnegative())
    )
  })
)
export type DevelopmentCheckpointSceneInput = z.infer<typeof developmentCheckpointSceneInputSchema>
export type DevelopmentCheckpointSceneInspection = z.infer<
  typeof developmentCheckpointSceneInspectionSchema
>
