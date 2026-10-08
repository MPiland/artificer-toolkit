import { z, lazySchema } from '../zod.js'
import { campaignInventoryPendingCleanupSchema } from './campaignInventoryCleanup.js'
import { campaignListInputSchema, campaignListPageSchema } from './campaignList.js'
import { uuidSchema } from './campaignContractSchemas.js'
import {
  inventoryDtoSchema,
  inventoryItemDtoSchema,
  inventoryCurrencyDtoSchema,
  currencySystemDtoSchema,
  campaignInventoryAuditPageDtoSchema,
  campaignInventoryAuditEventDtoSchema
} from './campaignInventory.js'

export const campaignPartyInventoryListInputSchema = lazySchema(() =>
  z.extend(campaignListInputSchema, {
    campaignId: uuidSchema
  })
)
export const campaignVehicleInventoryListInputSchema = lazySchema(() =>
  z.extend(campaignPartyInventoryListInputSchema, {
    vehicleId: uuidSchema
  })
)
const inventoryPageSchema = lazySchema(() =>
  z.extend(campaignListPageSchema, {
    ...z.pick(inventoryDtoSchema, { owner: true, version: true }).shape,
    pendingCleanup: z.optional(campaignInventoryPendingCleanupSchema)
  })
)
export const campaignPartyItemPageSchema = lazySchema(() =>
  z.extend(inventoryPageSchema, {
    page: z.array(inventoryItemDtoSchema).check(z.maxLength(48))
  })
)
export const campaignPartyCurrencyPageSchema = lazySchema(() =>
  z.extend(inventoryPageSchema, {
    page: z.array(inventoryCurrencyDtoSchema).check(z.maxLength(48))
  })
)
export type CampaignPartyInventoryListInput = z.infer<typeof campaignPartyInventoryListInputSchema>
export type CampaignVehicleInventoryListInput = z.infer<
  typeof campaignVehicleInventoryListInputSchema
>
export type CampaignPartyItemPage = z.infer<typeof campaignPartyItemPageSchema>
export type CampaignPartyCurrencyPage = z.infer<typeof campaignPartyCurrencyPageSchema>
export const campaignCurrencySystemPageSchema = lazySchema(() =>
  z.extend(campaignListPageSchema, {
    page: z.array(currencySystemDtoSchema).check(z.maxLength(48))
  })
)
export type CampaignCurrencySystemPage = z.infer<typeof campaignCurrencySystemPageSchema>

// Convex's transport cannot validate recursive JSON; retain the domain payload behind encoding.
const campaignInventoryAuditEventTransportSchema = lazySchema(() =>
  z.extend(z.omit(campaignInventoryAuditEventDtoSchema, { payload: true }), {
    payloadJson: z.string()
  })
)
export const campaignInventoryAuditPageTransportSchema = lazySchema(() =>
  z.extend(campaignInventoryAuditPageDtoSchema, {
    events: z.array(campaignInventoryAuditEventTransportSchema)
  })
)
export type CampaignInventoryAuditPageTransport = z.infer<
  typeof campaignInventoryAuditPageTransportSchema
>
export function decodeCampaignInventoryAuditPage(input: CampaignInventoryAuditPageTransport) {
  const result = campaignInventoryAuditPageTransportSchema.parse(input)
  return campaignInventoryAuditPageDtoSchema.parse({
    ...result,
    events: result.events.map(({ payloadJson, ...event }) => ({
      ...event,
      payload: JSON.parse(payloadJson) as unknown
    }))
  })
}
