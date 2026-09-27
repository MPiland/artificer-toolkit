import { z, lazySchema } from '../zod.js'
import { uuidSchema, versionSchema } from '../api/campaignContractSchemas.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { inventoryHeldItemSchema } from '../shared/inventoryItem.js'
import { currencySystemDtoSchema, currencyDenominationDtoSchema } from '../api/campaignInventory.js'

export const campaignStoredCurrencySystemSchema = lazySchema(() =>
  z.extend(z.omit(currencySystemDtoSchema, { denominations: true }), { campaignId: uuidSchema })
)

export const campaignStoredCurrencyDenominationSchema = lazySchema(() =>
  z.extend(currencyDenominationDtoSchema, {
    campaignId: uuidSchema,
    systemId: uuidSchema,
    sortOrder: z.number().check(z.int()).check(z.gte(0)).check(z.lte(4))
  })
)

export const campaignStoredPartyInventorySchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    vehicleId: z.optional(uuidSchema),
    version: versionSchema
  })
)

export const campaignStoredPartyItemSchema = lazySchema(() =>
  z.extend(inventoryHeldItemSchema, {
    campaignId: uuidSchema,
    vehicleId: z.optional(uuidSchema),
    cleanupJobId: z.optional(uuidSchema)
  })
)

export const campaignStoredPartyCurrencyGroupSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    vehicleId: z.optional(uuidSchema),
    cleanupJobId: z.optional(uuidSchema),
    id: uuidSchema,
    containerId: z.nullable(uuidSchema)
  })
)

export const campaignStoredPartyCurrencySchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    vehicleId: z.optional(uuidSchema),
    cleanupJobId: z.optional(uuidSchema),
    id: uuidSchema,
    groupId: z.optional(uuidSchema),
    denominationId: postgresUuidSchema,
    campaignCurrencySystemId: z.optional(uuidSchema),
    amount: z
      .number()
      .check(z.int())
      .check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER))
      .check(z.nonnegative()),
    containerId: z.nullable(uuidSchema)
  })
)
