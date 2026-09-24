import { z } from '../zod.js'
import {
  combatPerceptionChannelDtoSchema,
  combatPerceptionIlluminationDtoSchema,
  combatPerceptionObscurementDtoSchema
} from '../shared/combatPerception.js'
import { spatialPointDtoSchema } from '../shared/spatialFacts.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { projectionChecksumSchema } from '../projections/identity.js'
import { sceneGridDtoSchema } from './vttScenes.js'
import { sceneGeometryFinishInputSchema } from './sceneGeometry.js'
import { sceneLiveStateHeaderSchema } from './sceneLiveState.js'

const footprint = z.strictObject({
  position: spatialPointDtoSchema,
  width: z.number().check(z.positive()),
  height: z.number().check(z.positive())
})

export const sceneMovementPerceptionRequestSchema = z.strictObject({
  key: projectionChecksumSchema,
  observer: footprint,
  subject: footprint
})

export const sceneMovementPerceptionCaptureSchema = z.strictObject({
  sceneId: postgresUuidSchema,
  sceneVersion: z.number().check(z.int()).check(z.nonnegative()),
  grid: sceneGridDtoSchema,
  header: sceneLiveStateHeaderSchema,
  requests: z.array(sceneMovementPerceptionRequestSchema)
})

export const sceneMovementPerceptionEnvironmentSchema = z.strictObject({
  key: projectionChecksumSchema,
  environment: z.strictObject({
    distance: z.number().check(z.nonnegative()),
    lineOfEffect: z.boolean(),
    sharedSurface: z.boolean(),
    illumination: combatPerceptionIlluminationDtoSchema,
    obscurement: combatPerceptionObscurementDtoSchema,
    invisibleChannels: z.array(combatPerceptionChannelDtoSchema).check(z.maxLength(4)),
    suppressedChannels: z.array(combatPerceptionChannelDtoSchema).check(z.maxLength(4))
  })
})

/** Internal action evidence; the public movement command cannot supply these facts. */
export const sceneSpatialPrepareInputSchema = z.extend(sceneGeometryFinishInputSchema, {
  perceptionEnvironments: z.optional(z.array(sceneMovementPerceptionEnvironmentSchema))
})

export type SceneMovementPerceptionCapture = z.infer<typeof sceneMovementPerceptionCaptureSchema>
export type SceneMovementPerceptionEnvironment = z.infer<
  typeof sceneMovementPerceptionEnvironmentSchema
>
