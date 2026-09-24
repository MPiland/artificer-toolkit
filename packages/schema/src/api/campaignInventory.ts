import { z } from '../zod.js'

import { postgresUuidSchema } from '../shared/postgresUuid.js'
import {
  jsonSchema,
  timestampSchema,
  uuidSchema,
  versionSchema
} from './campaignContractSchemas.js'

export const currencyDenominationDtoSchema = z.strictObject({
  id: uuidSchema,
  label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(80)),
  abbreviation: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(16)),
  scaleInReference: z
    .number()
    .check(z.int())
    .check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER))
    .check(z.positive())
})
const currencyDenominationInputSchema = z.extend(
  z.omit(currencyDenominationDtoSchema, { id: true }),
  { id: z.optional(uuidSchema) }
)
export const currencySystemDtoSchema = z.strictObject({
  id: uuidSchema,
  label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(80)),
  isReference: z.boolean(),
  denominations: z.array(currencyDenominationDtoSchema).check(z.minLength(1)).check(z.maxLength(5)),
  version: versionSchema
})
export const saveCampaignCurrencySystemInputSchema = z.strictObject({
  campaignId: uuidSchema,
  systemId: z.optional(uuidSchema),
  label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(80)),
  isReference: z.boolean(),
  denominations: z
    .array(currencyDenominationInputSchema)
    .check(z.minLength(1))
    .check(z.maxLength(5)),
  expectedVersion: z.optional(versionSchema)
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
  label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(120)),
  quantity: z
    .number()
    .check(z.int())
    .check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER))
    .check(z.positive()),
  containerId: z.nullable(uuidSchema),
  isContainer: z.boolean()
})
export const inventoryCurrencyDtoSchema = z.strictObject({
  kind: z.optional(z.enum(['RULESET', 'CAMPAIGN'])),
  campaignCurrencySystemId: z.optional(uuidSchema),
  denominationId: postgresUuidSchema,
  label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(80)),
  abbreviation: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(16)),
  amount: z
    .number()
    .check(z.int())
    .check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER))
    .check(z.nonnegative()),
  containerId: z.nullable(uuidSchema)
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

export const campaignInventoryOwnerVersionDtoSchema = z.pick(inventoryDtoSchema, {
  owner: true,
  version: true
})
export const campaignInventoryTransferOwnersInputSchema = z.strictObject({
  campaignId: uuidSchema,
  source: inventoryOwnerRefDtoSchema,
  destination: inventoryOwnerRefDtoSchema
})
export const campaignInventoryTransferVersionsDtoSchema = z.strictObject({
  sourceVersion: versionSchema,
  destinationVersion: versionSchema
})
export type CampaignInventoryOwnerVersionDto = z.infer<
  typeof campaignInventoryOwnerVersionDtoSchema
>
export type CampaignInventoryTransferVersionsDto = z.infer<
  typeof campaignInventoryTransferVersionsDtoSchema
>

export const transferCampaignInventoryInputSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('ITEM'),
    campaignId: uuidSchema,
    source: inventoryOwnerRefDtoSchema,
    destination: inventoryOwnerRefDtoSchema,
    itemId: uuidSchema,
    amount: z
      .number()
      .check(z.int())
      .check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER))
      .check(z.positive()),
    expectedSourceVersion: versionSchema,
    expectedDestinationVersion: versionSchema,
    idempotencyKey: uuidSchema
  }),
  z.strictObject({
    kind: z.literal('CURRENCY'),
    campaignCurrencySystemId: z.optional(z.nullable(uuidSchema)),
    campaignId: uuidSchema,
    source: inventoryOwnerRefDtoSchema,
    destination: inventoryOwnerRefDtoSchema,
    denominationId: postgresUuidSchema,
    amount: z
      .number()
      .check(z.int())
      .check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER))
      .check(z.positive()),
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
  vehicleId: z.optional(uuidSchema),
  expectedOwnerVersion: versionSchema,
  idempotencyKey: uuidSchema
}
export const campaignPartyInventoryMutationInputSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    ...inventoryMutationVersionFields,
    kind: z.literal('ITEM_ADD'),
    containerId: z.optional(z.nullable(uuidSchema)),
    equipmentId: postgresUuidSchema,
    quantity: z
      .number()
      .check(z.int())
      .check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER))
      .check(z.positive())
  }),
  z.strictObject({
    ...inventoryMutationVersionFields,
    kind: z.literal('ITEM_UPDATE'),
    containerId: z.optional(z.nullable(uuidSchema)),
    itemId: uuidSchema,
    quantity: z
      .number()
      .check(z.int())
      .check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER))
      .check(z.positive())
  }),
  z.strictObject({
    ...inventoryMutationVersionFields,
    kind: z.literal('ITEM_CONSUME'),
    itemId: uuidSchema,
    amount: z
      .number()
      .check(z.int())
      .check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER))
      .check(z.positive())
  }),
  z.strictObject({
    ...inventoryMutationVersionFields,
    kind: z.literal('ITEM_REMOVE'),
    itemId: uuidSchema
  }),
  z.strictObject({
    ...inventoryMutationVersionFields,
    kind: z.literal('CURRENCY_ADJUST'),
    containerId: z.optional(z.nullable(uuidSchema)),
    campaignCurrencySystemId: z.optional(z.nullable(uuidSchema)),
    denominationId: postgresUuidSchema,
    amount: z
      .number()
      .check(z.int())
      .check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER))
      .check(z.refine((value) => value !== 0))
  }),
  z.strictObject({
    ...inventoryMutationVersionFields,
    kind: z.literal('CURRENCY_MOVE'),
    campaignCurrencySystemId: z.optional(z.nullable(uuidSchema)),
    denominationId: postgresUuidSchema,
    fromContainerId: z.nullable(uuidSchema),
    toContainerId: z.nullable(uuidSchema),
    amount: z.number().check(z.int()).check(z.gte(1), z.lte(Number.MAX_SAFE_INTEGER))
  })
])
export const campaignPartyInventoryMutationResultDtoSchema = z.strictObject({
  eventId: uuidSchema
})
export const listCampaignInventoryAuditInputSchema = z.strictObject({
  campaignId: uuidSchema,
  cursor: z.optional(uuidSchema),
  limit: z._default(z.number().check(z.int()).check(z.gte(1)).check(z.lte(100)), 50)
})
export const campaignInventoryAuditEventDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  actorUserId: z.nullable(uuidSchema),
  subjectCharacterId: z.nullable(uuidSchema),
  kind: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(80)),
  visibility: z.literal('OWNER'),
  payload: jsonSchema,
  createdAt: timestampSchema
})
export const campaignInventoryAuditPageDtoSchema = z.strictObject({
  events: z.array(campaignInventoryAuditEventDtoSchema),
  nextCursor: z.nullable(uuidSchema)
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
