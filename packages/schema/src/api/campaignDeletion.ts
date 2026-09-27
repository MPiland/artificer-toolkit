import { z } from 'zod'
import { uuidSchema } from './campaignContractSchemas.js'
import { lazySchema } from '../zod.js'

export const campaignDeletionStatusInputSchema = lazySchema(() =>
  z.strictObject({ campaignId: uuidSchema })
)
export const campaignDeletionStatusSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    expectedVersion: z.number().int().nonnegative(),
    status: z.enum(['DELETING', 'FAILED', 'DELETED']),
    error: z.nullable(z.literal('Campaign cleanup failed. Retry deletion to resume.')),
    updatedAt: z.string()
  })
)
export type CampaignDeletionStatus = z.infer<typeof campaignDeletionStatusSchema>
