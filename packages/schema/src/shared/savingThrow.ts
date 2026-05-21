import { z } from 'zod'

const savingThrowDcBonusDtoSchema = z.union([
  z.object({
    id: z.string(),
    bonusKind: z.literal('ABILITY_MODIFIER'),
    ability: z.string()
  }).strict(),
  z.object({
    id: z.string(),
    bonusKind: z.literal('PROFICIENCY_BONUS')
  }).strict(),
  z.object({
    id: z.string(),
    bonusKind: z.literal('STATIC_BONUS'),
    amount: z.number().int()
  }).strict()
])

export const savingThrowDtoSchema = z.union([
  z.object({
    id: z.string(),
    dcMethod: z.literal('SOURCE_SAVE_DC'),
    ability: z.string()
  }).strict(),
  z.object({
    id: z.string(),
    dcMethod: z.literal('FIXED_DC'),
    ability: z.string(),
    baseDc: z.number().int(),
    bonuses: z.array(savingThrowDcBonusDtoSchema).optional()
  }).strict(),
  z.object({
    id: z.string(),
    dcMethod: z.literal('DERIVED_DC'),
    ability: z.string(),
    baseDc: z.number().int(),
    bonuses: z.array(savingThrowDcBonusDtoSchema)
  }).strict()
])

export type SavingThrowDto = z.infer<typeof savingThrowDtoSchema>
