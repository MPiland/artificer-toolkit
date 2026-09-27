import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from './postgresUuid.js'

/** Held Equipment travels with its instance data between Character, party and Vehicle custody. */
export const inventoryHeldItemSchema = lazySchema(() =>
  z.strictObject({
    id: postgresUuidSchema,
    equipmentId: postgresUuidSchema,
    quantity: z.number().check(z.int()).check(z.gte(1), z.lte(Number.MAX_SAFE_INTEGER)),
    containerId: z.nullable(postgresUuidSchema),
    customName: z.optional(z.string()),
    notes: z.optional(z.string()),
    retainedRulesJson: z.optional(z.string())
  })
)
export type InventoryHeldItem = z.infer<typeof inventoryHeldItemSchema>
