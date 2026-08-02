import { z } from 'zod'
import {
  authoringModeKindSchema,
  authoringSelectionKindSchema,
  equipmentCategoryCodeSchema,
  equipmentPropertyCodeSchema
} from './enums.js'
import { characterFacetDtoSchema } from './facet.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredReferenceCollectionSchema
} from './authoredLimits.js'

export const startingEquipmentCurrencyDtoSchema = z.object({
  currencyId: authoredIdentifierSchema,
  amount: z.number().int()
})

const startingEquipmentEquipmentItemBaseDtoSchema = z.object({
  id: authoredIdentifierSchema,
  order: z.number().int(),
  startingEquipmentKind: z.literal('EQUIPMENT'),
  category: equipmentCategoryCodeSchema.optional(),
  properties: authoredReferenceCollectionSchema(equipmentPropertyCodeSchema).optional(),
  selectionKind: authoringSelectionKindSchema
})

const grantedEquipmentItemDtoSchema = startingEquipmentEquipmentItemBaseDtoSchema
  .extend({
    selectionKind: z.literal(authoringSelectionKindSchema.enum.GRANTED),
    quantity: z.number().int(),
    authoringModeKind: authoringModeKindSchema.optional()
  })
  .and(
    z.union([
      z.object({
        authoringModeKind: z.literal(authoringModeKindSchema.enum.ALL).optional()
      }),
      z.object({
        authoringModeKind: z.literal(authoringModeKindSchema.enum.SELECTED),
        equipmentIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
      })
    ])
  )

const chosenEquipmentItemDtoSchema = startingEquipmentEquipmentItemBaseDtoSchema
  .extend({
    selectionKind: z.literal(authoringSelectionKindSchema.enum.CHOSEN),
    count: z.number().int(),
    authoringModeKind: authoringModeKindSchema.optional()
  })
  .and(
    z.union([
      z.object({
        authoringModeKind: z.literal(authoringModeKindSchema.enum.ALL).optional()
      }),
      z.object({
        authoringModeKind: z.literal(authoringModeKindSchema.enum.SELECTED),
        equipmentIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
      })
    ])
  )

const startingEquipmentCurrencyItemDtoSchema = z.object({
  id: authoredIdentifierSchema,
  order: z.number().int(),
  startingEquipmentKind: z.literal('CURRENCY'),
  currencies: authoredNestedCollectionSchema(startingEquipmentCurrencyDtoSchema)
})

export const startingEquipmentItemDtoSchema = z.union([
  startingEquipmentCurrencyItemDtoSchema,
  grantedEquipmentItemDtoSchema,
  chosenEquipmentItemDtoSchema
])

export const startingEquipmentOptionDtoSchema = z.object({
  id: authoredIdentifierSchema,
  order: z.number().int(),
  eligibility: characterFacetDtoSchema.optional(),
  items: authoredNestedCollectionSchema(startingEquipmentItemDtoSchema)
})

export const startingEquipmentGroupDtoSchema = z.object({
  id: authoredIdentifierSchema,
  order: z.number().int(),
  options: authoredNestedCollectionSchema(startingEquipmentOptionDtoSchema)
})

export const startingEquipmentSetDtoSchema = z.object({
  id: authoredIdentifierSchema,
  order: z.number().int(),
  groups: authoredNestedCollectionSchema(startingEquipmentGroupDtoSchema)
})

export const startingEquipmentDtoSchema = z.object({
  id: authoredIdentifierSchema,
  sets: authoredNestedCollectionSchema(startingEquipmentSetDtoSchema)
})

export type StartingEquipmentDto = z.infer<typeof startingEquipmentDtoSchema>
