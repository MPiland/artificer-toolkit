import { z, lazySchema } from '../zod.js'
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

export const startingEquipmentCurrencyDtoSchema = lazySchema(() =>
  z.object({
    currencyId: authoredIdentifierSchema,
    amount: z.number().check(z.int())
  })
)

export type StartingEquipmentCurrencyDto = z.infer<typeof startingEquipmentCurrencyDtoSchema>

const startingEquipmentEquipmentItemBaseDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    order: z.number().check(z.int()),
    startingEquipmentKind: z.literal('EQUIPMENT'),
    category: z.optional(equipmentCategoryCodeSchema),
    properties: z.optional(authoredReferenceCollectionSchema(equipmentPropertyCodeSchema)),
    selectionKind: authoringSelectionKindSchema
  })
)

const grantedEquipmentItemDtoSchema = lazySchema(() =>
  z.intersection(
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
)

const chosenEquipmentItemDtoSchema = lazySchema(() =>
  z.intersection(
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
)

const startingEquipmentCurrencyItemDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    order: z.number().check(z.int()),
    startingEquipmentKind: z.literal('CURRENCY'),
    currencies: authoredNestedCollectionSchema(startingEquipmentCurrencyDtoSchema)
  })
)

export const startingEquipmentItemDtoSchema = lazySchema(() =>
  z.union([
    startingEquipmentCurrencyItemDtoSchema,
    grantedEquipmentItemDtoSchema,
    chosenEquipmentItemDtoSchema
  ])
)

export const startingEquipmentOptionDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    order: z.number().check(z.int()),
    eligibility: z.optional(characterFacetDtoSchema),
    items: authoredNestedCollectionSchema(startingEquipmentItemDtoSchema)
  })
)

export type StartingEquipmentOptionDto = z.infer<typeof startingEquipmentOptionDtoSchema>

export const startingEquipmentGroupDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    order: z.number().check(z.int()),
    options: authoredNestedCollectionSchema(startingEquipmentOptionDtoSchema)
  })
)

export type StartingEquipmentGroupDto = z.infer<typeof startingEquipmentGroupDtoSchema>

export const startingEquipmentSetDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    order: z.number().check(z.int()),
    groups: authoredNestedCollectionSchema(startingEquipmentGroupDtoSchema)
  })
)

export type StartingEquipmentSetDto = z.infer<typeof startingEquipmentSetDtoSchema>

export const startingEquipmentDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    sets: authoredNestedCollectionSchema(startingEquipmentSetDtoSchema)
  })
)

export type StartingEquipmentDto = z.infer<typeof startingEquipmentDtoSchema>
