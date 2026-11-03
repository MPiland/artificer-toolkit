import { uuidSchema } from './campaignContractSchemas.js'
import { z, lazySchema } from '../zod.js'

export const campaignDeletionStatusInputSchema = lazySchema(() =>
  z.strictObject({ campaignId: uuidSchema })
)
export const campaignDeletionStatusSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    expectedVersion: z.number().check(z.int()).check(z.nonnegative()),
    status: z.enum(['DELETING', 'FAILED', 'DELETED']),
    error: z.nullable(z.literal('Campaign cleanup failed. Retry deletion to resume.')),
    updatedAt: z.string()
  })
)
export type CampaignDeletionStatus = z.infer<typeof campaignDeletionStatusSchema>
