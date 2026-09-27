import { z, lazySchema } from '../zod.js'

import { uuidSchema } from './campaignContractSchemas.js'

export const characterPreparationOptionDtoSchema = lazySchema(() =>
  z.strictObject({
    spellId: uuidSchema,
    label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(200)),
    level: z.number().check(z.int()).check(z.nonnegative()),
    prepared: z.boolean(),
    committed: z.boolean()
  })
)

export const characterPreparationOptionClassDtoSchema = lazySchema(() =>
  z.strictObject({
    classId: uuidSchema,
    label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(200)),
    preparedSpellLimit: z.number().check(z.int()).check(z.nonnegative()),
    options: z.array(characterPreparationOptionDtoSchema).check(z.maxLength(500))
  })
)

export const characterPreparationOptionsResponseDtoSchema = lazySchema(() =>
  z.strictObject({
    characterId: uuidSchema,
    streamVersion: z.number().check(z.int()).check(z.nonnegative()),
    classes: z.array(characterPreparationOptionClassDtoSchema).check(z.maxLength(20))
  })
)

export type CharacterPreparationOptionDto = z.infer<typeof characterPreparationOptionDtoSchema>
export type CharacterPreparationOptionClassDto = z.infer<
  typeof characterPreparationOptionClassDtoSchema
>
export type CharacterPreparationOptionsResponseDto = z.infer<
  typeof characterPreparationOptionsResponseDtoSchema
>
