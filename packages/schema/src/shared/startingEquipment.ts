import { z } from '../zod.js'
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
  amount: z.number().check(z.int())
})

const startingEquipmentEquipmentItemBaseDtoSchema = z.object({
  id: authoredIdentifierSchema,
  order: z.number().check(z.int()),
  startingEquipmentKind: z.literal('EQUIPMENT'),
  category: z.optional(equipmentCategoryCodeSchema),
  properties: z.optional(authoredReferenceCollectionSchema(equipmentPropertyCodeSchema)),
  selectionKind: authoringSelectionKindSchema
})

const grantedEquipmentItemDtoSchema = z.intersection(
  z.extend(startingEquipmentEquipmentItemBaseDtoSchema, {
    selectionKind: z.literal(authoringSelectionKindSchema._zod.def.entries.GRANTED),
    quantity: z.number().check(z.int()),
    authoringModeKind: z.optional(authoringModeKindSchema)
  }),
  z.union([
    z.object({
      authoringModeKind: z.optional(z.literal(authoringModeKindSchema._zod.def.entries.ALL))
    }),
    z.object({
      authoringModeKind: z.literal(authoringModeKindSchema._zod.def.entries.SELECTED),
      equipmentIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
    })
  ])
)

const chosenEquipmentItemDtoSchema = z.intersection(
  z.extend(startingEquipmentEquipmentItemBaseDtoSchema, {
    selectionKind: z.literal(authoringSelectionKindSchema._zod.def.entries.CHOSEN),
    count: z.number().check(z.int()),
    authoringModeKind: z.optional(authoringModeKindSchema)
  }),
  z.union([
    z.object({
      authoringModeKind: z.optional(z.literal(authoringModeKindSchema._zod.def.entries.ALL))
    }),
    z.object({
      authoringModeKind: z.literal(authoringModeKindSchema._zod.def.entries.SELECTED),
      equipmentIds: authoredReferenceCollectionSchema(authoredIdentifierSchema)
    })
  ])
)

const startingEquipmentCurrencyItemDtoSchema = z.object({
  id: authoredIdentifierSchema,
  order: z.number().check(z.int()),
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
  order: z.number().check(z.int()),
  eligibility: z.optional(characterFacetDtoSchema),
  items: authoredNestedCollectionSchema(startingEquipmentItemDtoSchema)
})

export const startingEquipmentGroupDtoSchema = z.object({
  id: authoredIdentifierSchema,
  order: z.number().check(z.int()),
  options: authoredNestedCollectionSchema(startingEquipmentOptionDtoSchema)
})

export const startingEquipmentSetDtoSchema = z.object({
  id: authoredIdentifierSchema,
  order: z.number().check(z.int()),
  groups: authoredNestedCollectionSchema(startingEquipmentGroupDtoSchema)
})

export const startingEquipmentDtoSchema = z.object({
  id: authoredIdentifierSchema,
  sets: authoredNestedCollectionSchema(startingEquipmentSetDtoSchema)
})

export type StartingEquipmentDto = z.infer<typeof startingEquipmentDtoSchema>
