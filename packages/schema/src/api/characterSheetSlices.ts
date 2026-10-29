import { z, lazySchema } from '../zod.js'
import {
  characterSheetReadInputSchema,
  characterSheetResponseDtoSchema,
  characterSheetReferenceDtoSchema
} from './characterSheetData.js'

export const characterSheetSliceSchema = lazySchema(() =>
  z.enum(['COMMON', 'ACTIONS', 'SPELLS', 'INVENTORY', 'EXTRAS', 'FEATURES', 'NOTES'])
)
export type CharacterSheetSlice = z.infer<typeof characterSheetSliceSchema>

export const characterSheetSliceReadInputSchema = lazySchema(() =>
  z.extend(characterSheetReadInputSchema, {
    campaignId: z.optional(z.string().check(z.uuid())),
    slice: characterSheetSliceSchema
  })
)

/** Visible identity, vitals and rules facts; feature collections are requested separately. */
export const characterSheetCommonDtoSchema = lazySchema(() =>
  z.strictObject({
    ...z.pick(characterSheetResponseDtoSchema, {
      publicId: true,
      meta: true,
      identity: true,
      overview: true
    }).shape,
    hasSpellcasting: z.boolean(),
    reference: z.pick(characterSheetReferenceDtoSchema, {
      proficiencies: true,
      defenses: true,
      senses: true,
      conditionOptions: true
    })
  })
)

export const characterSheetActionsDtoSchema = lazySchema(() =>
  z.strictObject({
    ...z.pick(characterSheetResponseDtoSchema, { meta: true, actions: true }).shape,
    resources: z.pick(characterSheetResponseDtoSchema.shape.resources, { items: true }),
    spells: z.pick(characterSheetResponseDtoSchema.shape.spells, {
      activeGroups: true,
      spells: true,
      slots: true
    })
  })
)

export const characterSheetSpellsDtoSchema = lazySchema(() =>
  z.strictObject({
    ...z.pick(characterSheetResponseDtoSchema, { meta: true, spells: true }).shape
  })
)

export const characterSheetInventoryDtoSchema = lazySchema(() =>
  z.strictObject({
    ...z.pick(characterSheetResponseDtoSchema, { meta: true, inventory: true }).shape,
    resources: z.pick(characterSheetResponseDtoSchema.shape.resources, { items: true }),
    reference: z.pick(characterSheetReferenceDtoSchema, {
      equipmentOptions: true,
      currencyOptions: true
    })
  })
)

export const characterSheetExtrasSliceDtoSchema = lazySchema(() =>
  z.pick(characterSheetResponseDtoSchema, { meta: true, extras: true })
)

export const characterSheetFeaturesDtoSchema = lazySchema(() =>
  z.strictObject({
    ...z.pick(characterSheetResponseDtoSchema, { meta: true }).shape,
    resources: z.pick(characterSheetResponseDtoSchema.shape.resources, { items: true }),
    reference: z.pick(characterSheetReferenceDtoSchema, {
      features: true,
      proficiencies: true,
      defenses: true,
      senses: true
    })
  })
)

/** Owner-only notes do not depend on mechanical facts or authored catalogue hydration. */
export const characterSheetNotesSliceDtoSchema = lazySchema(() =>
  z.strictObject({
    meta: z.pick(characterSheetResponseDtoSchema.shape.meta, {
      characterId: true,
      streamVersion: true
    }),
    notes: characterSheetResponseDtoSchema.shape.notes
  })
)

export const characterSheetSliceResponseDtoSchema = lazySchema(() =>
  z.discriminatedUnion('slice', [
    z.strictObject({ slice: z.literal('COMMON'), data: characterSheetCommonDtoSchema }),
    z.strictObject({ slice: z.literal('ACTIONS'), data: characterSheetActionsDtoSchema }),
    z.strictObject({ slice: z.literal('SPELLS'), data: characterSheetSpellsDtoSchema }),
    z.strictObject({ slice: z.literal('INVENTORY'), data: characterSheetInventoryDtoSchema }),
    z.strictObject({ slice: z.literal('EXTRAS'), data: characterSheetExtrasSliceDtoSchema }),
    z.strictObject({ slice: z.literal('FEATURES'), data: characterSheetFeaturesDtoSchema }),
    z.strictObject({ slice: z.literal('NOTES'), data: characterSheetNotesSliceDtoSchema })
  ])
)

export type CharacterSheetCommonDto = z.infer<typeof characterSheetCommonDtoSchema>
export type CharacterSheetActionsDto = z.infer<typeof characterSheetActionsDtoSchema>
export type CharacterSheetSpellsDto = z.infer<typeof characterSheetSpellsDtoSchema>
export type CharacterSheetInventoryDto = z.infer<typeof characterSheetInventoryDtoSchema>
export type CharacterSheetExtrasSliceDto = z.infer<typeof characterSheetExtrasSliceDtoSchema>
export type CharacterSheetFeaturesDto = z.infer<typeof characterSheetFeaturesDtoSchema>
export type CharacterSheetNotesSliceDto = z.infer<typeof characterSheetNotesSliceDtoSchema>
export type CharacterSheetSliceReadInput = z.infer<typeof characterSheetSliceReadInputSchema>
export type CharacterSheetSliceResponseDto = z.infer<typeof characterSheetSliceResponseDtoSchema>
export type CharacterSheetSliceDtoMap = {
  COMMON: CharacterSheetCommonDto
  ACTIONS: CharacterSheetActionsDto
  SPELLS: CharacterSheetSpellsDto
  INVENTORY: CharacterSheetInventoryDto
  EXTRAS: CharacterSheetExtrasSliceDto
  FEATURES: CharacterSheetFeaturesDto
  NOTES: CharacterSheetNotesSliceDto
}
