import { z } from '../zod.js'
import { uuidSchema } from './campaignContractSchemas.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { campaignListInputSchema, campaignListPageSchema } from './campaignList.js'

const pendingFields = {
  jobId: uuidSchema,
  status: z.enum(['RUNNING', 'FAILED'])
}
export const campaignInventoryCleanupScopeSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...pendingFields, kind: z.literal('CARGO') }),
  z.strictObject({
    ...pendingFields,
    kind: z.literal('CURRENCY'),
    campaignCurrencySystemId: z.nullable(uuidSchema),
    denominationId: postgresUuidSchema
  })
])
export const campaignInventoryPendingCleanupSchema = z
  .array(campaignInventoryCleanupScopeSchema)
  .check(z.maxLength(48))
export type CampaignInventoryCleanupScope = z.infer<typeof campaignInventoryCleanupScopeSchema>
export const campaignInventoryCleanupListInputSchema = z.extend(campaignListInputSchema, {
  campaignId: uuidSchema,
  vehicleId: z.optional(uuidSchema)
})
export const campaignInventoryCleanupNoticeSchema = z.strictObject({
  ...pendingFields,
  retryReady: z.boolean()
})
export const campaignInventoryCleanupPageSchema = z.extend(campaignListPageSchema, {
  page: z.array(campaignInventoryCleanupNoticeSchema).check(z.maxLength(48))
})
export const campaignInventoryCleanupRetryInputSchema = z.strictObject({
  campaignId: uuidSchema,
  jobId: uuidSchema
})
export type CampaignInventoryCleanupNotice = z.infer<typeof campaignInventoryCleanupNoticeSchema>
export type CampaignInventoryCleanupPage = z.infer<typeof campaignInventoryCleanupPageSchema>
