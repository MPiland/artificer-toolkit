import { z, lazySchema } from '../zod.js'
import { timestampSchema, uuidSchema } from '../api/campaignContractSchemas.js'

export const campaignStoredClockSegmentSchema = lazySchema(() =>
  z.strictObject({
    id: uuidSchema,
    campaignId: uuidSchema,
    startedAt: timestampSchema,
    stoppedAt: z.nullable(timestampSchema),
    startAbsoluteMinute: z.number().check(z.int()).check(z.nonnegative()),
    endAbsoluteMinute: z.nullable(z.number().check(z.int()).check(z.nonnegative()))
  })
)

export const campaignStoredClockRecoverySchema = lazySchema(() =>
  z.strictObject({
    id: uuidSchema,
    campaignId: uuidSchema,
    boundaryAbsoluteMinute: z.number().check(z.int()),
    boundaryKind: z.enum(['DAWN', 'DUSK', 'DAILY']),
    characterId: uuidSchema,
    resourceKey: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(240)),
    eventId: uuidSchema,
    createdAt: timestampSchema
  })
)

/** A boundary the clock left unrecovered for a Character in combat, until the GM decides. */
export const campaignStoredClockRecoveryPromptSchema = lazySchema(() =>
  z.strictObject({
    id: uuidSchema,
    campaignId: uuidSchema,
    characterId: uuidSchema,
    boundaryAbsoluteMinute: z.number().check(z.int()),
    boundaryKind: z.enum(['DAWN', 'DUSK', 'DAILY']),
    createdAt: timestampSchema
  })
)
