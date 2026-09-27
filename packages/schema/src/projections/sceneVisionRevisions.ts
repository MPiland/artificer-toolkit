import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'

export const sceneVisionRevisionSchema = lazySchema(() =>
  z.strictObject({
    scope: z.enum(['SYSTEM', 'CAMPAIGN', 'PLAY', 'CHARACTER']),
    id: postgresUuidSchema,
    revision: postgresUuidSchema
  })
)

export type SceneVisionRevision = z.infer<typeof sceneVisionRevisionSchema>
