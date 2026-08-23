import { z } from 'zod'

import { uuidSchema } from './campaignContractSchemas.js'

export const characterPreparationOptionDtoSchema = z.strictObject({
  spellId: uuidSchema,
  label: z.string().trim().min(1).max(200),
  level: z.number().int().nonnegative(),
  prepared: z.boolean(),
  committed: z.boolean()
})

export const characterPreparationOptionClassDtoSchema = z.strictObject({
  classId: uuidSchema,
  label: z.string().trim().min(1).max(200),
  preparedSpellLimit: z.number().int().nonnegative(),
  options: z.array(characterPreparationOptionDtoSchema).max(500)
})

export const characterPreparationOptionsResponseDtoSchema = z.strictObject({
  characterId: uuidSchema,
  streamVersion: z.number().int().nonnegative(),
  classes: z.array(characterPreparationOptionClassDtoSchema).max(20)
})

export type CharacterPreparationOptionDto = z.infer<typeof characterPreparationOptionDtoSchema>
export type CharacterPreparationOptionClassDto = z.infer<
  typeof characterPreparationOptionClassDtoSchema
>
export type CharacterPreparationOptionsResponseDto = z.infer<
  typeof characterPreparationOptionsResponseDtoSchema
>
