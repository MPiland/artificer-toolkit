import { z, lazySchema } from '../zod.js'

import { uuidSchema } from './campaignContractSchemas.js'
import { contentSnapshotManifestDtoSchema } from './contentSnapshots.js'

export const characterPreparationOptionDtoSchema = lazySchema(() =>
  z.strictObject({
    spellId: uuidSchema,
    label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(200)),
    level: z.number().check(z.int()).check(z.nonnegative())
  })
)

export const characterPreparationOptionClassDtoSchema = lazySchema(() =>
  z.strictObject({
    classId: uuidSchema,
    label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(200)),
    preparedSpellLimit: z.number().check(z.int()).check(z.nonnegative()),
    eligibleSpellIds: z.array(uuidSchema).check(z.maxLength(500)),
    preparedSpellIds: z.array(uuidSchema).check(z.maxLength(500))
  })
)

export const characterPreparationOptionsResponseDtoSchema = lazySchema(() =>
  z.strictObject({
    characterId: uuidSchema,
    streamVersion: z.number().check(z.int()).check(z.nonnegative()),
    classes: z.array(characterPreparationOptionClassDtoSchema).check(z.maxLength(20)),
    catalogue: z.discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('SNAPSHOTS'), manifest: contentSnapshotManifestDtoSchema }),
      // Campaign GMs retain the authorized Character projection without receiving the owner's
      // private source token or access to other authored content in that source.
      z.strictObject({
        kind: z.literal('INLINE'),
        spells: z.array(characterPreparationOptionDtoSchema).check(z.maxLength(500))
      })
    ])
  })
)

export type CharacterPreparationOptionDto = z.infer<typeof characterPreparationOptionDtoSchema>
export type CharacterPreparationOptionClassDto = z.infer<
  typeof characterPreparationOptionClassDtoSchema
>
export type CharacterPreparationOptionsResponseDto = z.infer<
  typeof characterPreparationOptionsResponseDtoSchema
>
