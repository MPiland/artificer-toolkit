import { z } from 'zod'
import {
  authoringModeKindSchema,
  authoringSelectionKindSchema,
  equipmentCategoryCodeSchema,
  equipmentPropertyCodeSchema
} from './enums.js'

export const startingEquipmentCurrencyDtoSchema = z.object({
  currencyId: z.string(),
  amount: z.number().int()
})

const startingEquipmentEquipmentItemBaseDtoSchema = z.object({
  id: z.string(),
  order: z.number().int(),
  startingEquipmentKind: z.literal('EQUIPMENT'),
  category: equipmentCategoryCodeSchema.optional(),
  properties: z.array(equipmentPropertyCodeSchema).optional(),
  selectionKind: authoringSelectionKindSchema
})

const grantedEquipmentItemDtoSchema = startingEquipmentEquipmentItemBaseDtoSchema.extend({
  selectionKind: z.literal(authoringSelectionKindSchema.enum.GRANTED),
  quantity: z.number().int(),
  authoringModeKind: authoringModeKindSchema.optional()
}).and(z.union([
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.ALL).optional()
  }),
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.SELECTED),
    equipmentIds: z.array(z.string())
  })
]))

const chosenEquipmentItemDtoSchema = startingEquipmentEquipmentItemBaseDtoSchema.extend({
  selectionKind: z.literal(authoringSelectionKindSchema.enum.CHOSEN),
  count: z.number().int(),
  authoringModeKind: authoringModeKindSchema.optional()
}).and(z.union([
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.ALL).optional()
  }),
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.SELECTED),
    equipmentIds: z.array(z.string())
  })
]))

const startingEquipmentCurrencyItemDtoSchema = z.object({
  id: z.string(),
  order: z.number().int(),
  startingEquipmentKind: z.literal('CURRENCY'),
  currencies: z.array(startingEquipmentCurrencyDtoSchema)
})

export const startingEquipmentItemDtoSchema = z.union([
  startingEquipmentCurrencyItemDtoSchema,
  grantedEquipmentItemDtoSchema,
  chosenEquipmentItemDtoSchema
])

export const startingEquipmentOptionDtoSchema = z.object({
  id: z.string(),
  order: z.number().int(),
  items: z.array(startingEquipmentItemDtoSchema)
})

export const startingEquipmentGroupDtoSchema = z.object({
  id: z.string(),
  order: z.number().int(),
  options: z.array(startingEquipmentOptionDtoSchema)
})

export const startingEquipmentSetDtoSchema = z.object({
  id: z.string(),
  order: z.number().int(),
  groups: z.array(startingEquipmentGroupDtoSchema)
})

export const startingEquipmentDtoSchema = z.object({
  id: z.string(),
  sets: z.array(startingEquipmentSetDtoSchema)
})

export type StartingEquipmentDto = z.infer<typeof startingEquipmentDtoSchema>
