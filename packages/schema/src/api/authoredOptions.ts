import { z, lazySchema } from '../zod.js'
import { projectionChecksumSchema } from '../projections/identity.js'
import { authoredReferenceCollectionSchema } from '../shared/authoredLimits.js'
import { equipmentCategoryCodeSchema, equipmentPropertyCodeSchema } from '../shared/enums.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'

export const authoredEquipmentOptionsInputSchema = lazySchema(() =>
  z.strictObject({
    systemId: z.pipe(
      postgresUuidSchema,
      z.transform((value) => value.toLowerCase())
    ),
    excludeVariants: z.optional(z.boolean())
  })
)

export const authoredEquipmentOptionsSchema = lazySchema(() =>
  z
    .array(
      z.strictObject({
        value: postgresUuidSchema,
        label: z.string()
      })
    )
    .check(z.maxLength(500))
)

// Server-derived search facts, not a second editable Equipment document.
export const authoredEquipmentOptionFactsSchema = lazySchema(() =>
  z.strictObject({
    checksum: projectionChecksumSchema,
    category: equipmentCategoryCodeSchema,
    properties: authoredReferenceCollectionSchema(equipmentPropertyCodeSchema),
    // Optional while existing roots receive the current effective selector projection.
    builder: z.optional(
      z.strictObject({
        version: z.literal(1),
        parentEquipmentId: z.nullable(postgresUuidSchema),
        category: equipmentCategoryCodeSchema.check(z.refine((value) => value !== 'VARIANT')),
        properties: authoredReferenceCollectionSchema(equipmentPropertyCodeSchema),
        isContainer: z.boolean(),
        maxStack: z.optional(z.number().check(z.int()).check(z.positive())),
        requiresAttunement: z.boolean()
      })
    )
  })
)

export type AuthoredEquipmentOptionFacts = z.infer<typeof authoredEquipmentOptionFactsSchema>
