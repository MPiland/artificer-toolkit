import { z } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'

export const sceneVisionRevisionSchema = z.strictObject({
  scope: z.enum(['SYSTEM', 'CAMPAIGN', 'SESSION', 'CHARACTER']),
  id: postgresUuidSchema,
  revision: postgresUuidSchema
})

export type SceneVisionRevision = z.infer<typeof sceneVisionRevisionSchema>
