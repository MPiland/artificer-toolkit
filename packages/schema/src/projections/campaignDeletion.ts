import { z } from 'zod'
import { campaignDeletionStatusSchema } from '../api/campaignDeletion.js'
import { uuidSchema } from '../api/campaignContractSchemas.js'

export const campaignDeletionJobSchema = campaignDeletionStatusSchema.extend({
  ownerUserId: uuidSchema,
  stage: z.enum(['DRAIN_ROOM', 'ADMISSION', 'CHARACTERS', 'MEMBERSHIPS', 'PURGE']).optional(),
  liveAuthority: z.object({ sessionId: uuidSchema, epoch: uuidSchema }).nullable().optional(),
  retryAttempt: z.number().int().min(0).max(6).optional(),
  phase: z.number().int().nonnegative(),
  revision: z.number().int().nonnegative(),
  createdAt: z.string()
})
