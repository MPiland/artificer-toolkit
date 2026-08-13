import { z } from 'zod'

import { postgresUuidSchema } from '../shared/postgresUuid.js'
import {
  jsonSchema,
  timestampSchema,
  uuidSchema,
  versionSchema
} from './campaignContractSchemas.js'

export const currencyDenominationDtoSchema = z.strictObject({
  id: uuidSchema,
  label: z.string().trim().min(1).max(80),
  abbreviation: z.string().trim().min(1).max(16),
  scaleInReference: z.number().int().safe().positive()
})
const currencyDenominationInputSchema = currencyDenominationDtoSchema
  .omit({ id: true })
  .extend({ id: uuidSchema.optional() })
export const currencySystemDtoSchema = z.strictObject({
  id: uuidSchema,
  label: z.string().trim().min(1).max(80),
  isReference: z.boolean(),
  denominations: z.array(currencyDenominationDtoSchema).min(1).max(5),
  version: versionSchema
})
export const saveCampaignCurrencySystemInputSchema = z.strictObject({
  campaignId: uuidSchema,
  systemId: uuidSchema.optional(),
  label: z.string().trim().min(1).max(80),
  isReference: z.boolean(),
  denominations: z.array(currencyDenominationInputSchema).min(1).max(5),
  expectedVersion: versionSchema.optional()
})
export const deleteCampaignCurrencySystemInputSchema = z.strictObject({
  campaignId: uuidSchema,
  systemId: uuidSchema,
  expectedVersion: versionSchema
})

export const inventoryOwnerRefDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('CHARACTER'), characterId: uuidSchema }),
  z.strictObject({ kind: z.literal('CAMPAIGN'), campaignId: uuidSchema }),
  z.strictObject({ kind: z.literal('VEHICLE'), vehicleId: uuidSchema })
])
export const inventoryItemDtoSchema = z.strictObject({
  id: uuidSchema,
  label: z.string().trim().min(1).max(120),
  quantity: z.number().int().safe().positive(),
  containerId: uuidSchema.nullable(),
  isContainer: z.boolean()
})
export const inventoryCurrencyDtoSchema = z.strictObject({
  kind: z.enum(['RULESET', 'CAMPAIGN']),
  denominationId: postgresUuidSchema,
  label: z.string().trim().min(1).max(80),
  abbreviation: z.string().trim().min(1).max(16),
  amount: z.number().int().safe().nonnegative(),
  containerId: uuidSchema.nullable()
})
export const inventoryDtoSchema = z.strictObject({
  owner: inventoryOwnerRefDtoSchema,
  version: versionSchema,
  items: z.array(inventoryItemDtoSchema),
  currencies: z.array(inventoryCurrencyDtoSchema)
})
export const getCampaignInventoryInputSchema = z.strictObject({
  campaignId: uuidSchema,
  owner: inventoryOwnerRefDtoSchema
})
export const transferCampaignInventoryInputSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('ITEM'),
    campaignId: uuidSchema,
    source: inventoryOwnerRefDtoSchema,
    destination: inventoryOwnerRefDtoSchema,
    itemId: uuidSchema,
    amount: z.number().int().safe().positive(),
    expectedSourceVersion: versionSchema,
    expectedDestinationVersion: versionSchema,
    idempotencyKey: uuidSchema
  }),
  z.strictObject({
    kind: z.literal('CURRENCY'),
    campaignId: uuidSchema,
    source: inventoryOwnerRefDtoSchema,
    destination: inventoryOwnerRefDtoSchema,
    denominationId: postgresUuidSchema,
    amount: z.number().int().safe().positive(),
    expectedSourceVersion: versionSchema,
    expectedDestinationVersion: versionSchema,
    idempotencyKey: uuidSchema
  })
])
export const campaignInventoryTransferResultDtoSchema = z.strictObject({
  eventId: uuidSchema
})
const inventoryMutationVersionFields = {
  campaignId: uuidSchema,
  expectedOwnerVersion: versionSchema,
  idempotencyKey: uuidSchema
}
export const campaignPartyInventoryMutationInputSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    ...inventoryMutationVersionFields,
    kind: z.literal('ITEM_ADD'),
    equipmentId: postgresUuidSchema,
    quantity: z.number().int().safe().positive()
  }),
  z.strictObject({
    ...inventoryMutationVersionFields,
    kind: z.literal('ITEM_UPDATE'),
    itemId: uuidSchema,
    quantity: z.number().int().safe().positive()
  }),
  z.strictObject({
    ...inventoryMutationVersionFields,
    kind: z.literal('ITEM_CONSUME'),
    itemId: uuidSchema,
    amount: z.number().int().safe().positive()
  }),
  z.strictObject({
    ...inventoryMutationVersionFields,
    kind: z.literal('ITEM_REMOVE'),
    itemId: uuidSchema
  }),
  z.strictObject({
    ...inventoryMutationVersionFields,
    kind: z.literal('CURRENCY_ADJUST'),
    denominationId: postgresUuidSchema,
    amount: z
      .number()
      .int()
      .safe()
      .refine((value) => value !== 0)
  })
])
export const campaignPartyInventoryMutationResultDtoSchema = z.strictObject({
  eventId: uuidSchema
})
export const listCampaignInventoryAuditInputSchema = z.strictObject({
  campaignId: uuidSchema,
  cursor: uuidSchema.optional(),
  limit: z.number().int().min(1).max(100).default(50)
})
export const campaignInventoryAuditEventDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  actorUserId: uuidSchema.nullable(),
  subjectCharacterId: uuidSchema.nullable(),
  kind: z.string().trim().min(1).max(80),
  visibility: z.literal('OWNER'),
  payload: jsonSchema,
  createdAt: timestampSchema
})
export const campaignInventoryAuditPageDtoSchema = z.strictObject({
  events: z.array(campaignInventoryAuditEventDtoSchema),
  nextCursor: uuidSchema.nullable()
})

export type CurrencySystemDto = z.infer<typeof currencySystemDtoSchema>
export type SaveCampaignCurrencySystemInput = z.input<typeof saveCampaignCurrencySystemInputSchema>
export type InventoryOwnerRefDto = z.infer<typeof inventoryOwnerRefDtoSchema>
export type InventoryDto = z.infer<typeof inventoryDtoSchema>
export type TransferCampaignInventoryInput = z.input<typeof transferCampaignInventoryInputSchema>
export type CampaignInventoryTransferResultDto = z.infer<
  typeof campaignInventoryTransferResultDtoSchema
>
export type CampaignPartyInventoryMutationInput = z.input<
  typeof campaignPartyInventoryMutationInputSchema
>
export type ListCampaignInventoryAuditInput = z.input<typeof listCampaignInventoryAuditInputSchema>
export type CampaignInventoryAuditEventDto = z.infer<typeof campaignInventoryAuditEventDtoSchema>
export type CampaignInventoryAuditPageDto = z.infer<typeof campaignInventoryAuditPageDtoSchema>
