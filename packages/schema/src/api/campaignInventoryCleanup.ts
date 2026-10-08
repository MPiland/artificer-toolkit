import { z, lazySchema, lazySchemaParts } from '../zod.js'
import { uuidSchema } from './campaignContractSchemas.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { campaignListInputSchema, campaignListPageSchema } from './campaignList.js'

const pendingFields = lazySchemaParts(() => ({
  jobId: uuidSchema,
  status: z.enum(['RUNNING', 'FAILED'])
}))
export const campaignInventoryCleanupScopeSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ ...pendingFields(), kind: z.literal('CARGO') }),
    z.strictObject({
      ...pendingFields(),
      kind: z.literal('CURRENCY'),
      campaignCurrencySystemId: z.nullable(uuidSchema),
      denominationId: postgresUuidSchema
    })
  ])
)
export const campaignInventoryPendingCleanupSchema = lazySchema(() =>
  z.array(campaignInventoryCleanupScopeSchema).check(z.maxLength(48))
)
export type CampaignInventoryCleanupScope = z.infer<typeof campaignInventoryCleanupScopeSchema>
export const campaignInventoryCleanupListInputSchema = lazySchema(() =>
  z.extend(campaignListInputSchema, {
    campaignId: uuidSchema,
    vehicleId: z.optional(uuidSchema)
  })
)
const campaignInventoryCleanupNoticeSchema = lazySchema(() =>
  z.strictObject({
    ...pendingFields(),
    retryReady: z.boolean()
  })
)
export const campaignInventoryCleanupPageSchema = lazySchema(() =>
  z.extend(campaignListPageSchema, {
    page: z.array(campaignInventoryCleanupNoticeSchema).check(z.maxLength(48))
  })
)
export const campaignInventoryCleanupRetryInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    jobId: uuidSchema
  })
)
export type CampaignInventoryCleanupPage = z.infer<typeof campaignInventoryCleanupPageSchema>
