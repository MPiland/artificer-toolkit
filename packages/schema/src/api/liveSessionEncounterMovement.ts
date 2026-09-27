import { z } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'

/** The stored geometry command supplies the authority and version fences for every raw read. */
export const liveSessionMovementCaptureScopeSchema = z.strictObject({
  encounterId: postgresUuidSchema,
  saveId: postgresUuidSchema,
  baseTokenOrdinal: z.nullable(z.number().check(z.int()).check(z.nonnegative()))
})

export type LiveSessionMovementCaptureScope = z.infer<typeof liveSessionMovementCaptureScopeSchema>
