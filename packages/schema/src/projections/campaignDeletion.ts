import { campaignDeletionStatusSchema } from '../api/campaignDeletion.js'
import { uuidSchema } from '../api/campaignContractSchemas.js'
import { z, lazySchema } from '../zod.js'

export const campaignDeletionJobSchema = lazySchema(() =>
  z.extend(campaignDeletionStatusSchema, {
    ownerUserId: uuidSchema,
    stage: z.optional(z.enum(['DRAIN_ROOM', 'ADMISSION', 'CHARACTERS', 'MEMBERSHIPS', 'PURGE'])),
    liveAuthority: z.optional(z.nullable(z.object({ epoch: uuidSchema }))),
    retryAttempt: z.optional(z.number().check(z.int()).check(z.minimum(0)).check(z.maximum(6))),
    phase: z.number().check(z.int()).check(z.nonnegative()),
    revision: z.number().check(z.int()).check(z.nonnegative()),
    createdAt: z.string()
  })
)
