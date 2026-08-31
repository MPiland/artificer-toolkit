import { z } from 'zod'

import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { vocabularyDtoSchema } from './vocabulary.js'

const systemVocabularyFields = {
  id: z.string(),
  label: z.string(),
  description: z.string().nullable().optional(),
  rulesetCode: z.string(),
  rulesetVersion: z.string(),
  alignments: z.array(vocabularyDtoSchema),
  challengeRatings: z.array(vocabularyDtoSchema),
  conditionTypes: z.array(vocabularyDtoSchema),
  creatureTypes: z.array(vocabularyDtoSchema),
  currencies: z.array(vocabularyDtoSchema),
  damageTypes: z.array(vocabularyDtoSchema),
  heritages: z.array(vocabularyDtoSchema),
  languages: z.array(vocabularyDtoSchema),
  lifestyles: z.array(vocabularyDtoSchema),
  magicSchools: z.array(vocabularyDtoSchema),
  passives: z.array(vocabularyDtoSchema),
  rarities: z.array(vocabularyDtoSchema),
  senses: z.array(vocabularyDtoSchema),
  skills: z.array(vocabularyDtoSchema),
  speeds: z.array(vocabularyDtoSchema),
  terrains: z.array(vocabularyDtoSchema),
  userId: z.string()
}

const abilityVocabularyDtoSchema = vocabularyDtoSchema.extend({
  id: postgresUuidSchema.transform((value) => value.toLowerCase())
})

const systemInitiativePolicyDtoSchema = z.strictObject({
  defaultDefinitionId: postgresUuidSchema.transform((value) => value.toLowerCase())
})

/** Historical snapshots omit schemaVersion and remain byte-faithfully readable. */
const systemAuthoredV1DtoSchema = z.object(systemVocabularyFields).strict()

/** Current System documents use UUID-backed ability vocabulary. */
const systemAuthoredV2DtoSchema = z
  .object({
    ...systemVocabularyFields,
    schemaVersion: z.literal(2),
    abilities: z
      .array(abilityVocabularyDtoSchema)
      .min(1)
      .superRefine((abilities, context) => {
        const ids = new Set<string>()
        const codes = new Set<string>()
        for (const [index, ability] of abilities.entries()) {
          if (ids.has(ability.id))
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index, 'id'],
              message: 'System ability definition IDs must be unique.'
            })
          if (codes.has(ability.code))
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index, 'code'],
              message: 'System ability codes must be unique.'
            })
          ids.add(ability.id)
          codes.add(ability.code)
        }
      })
  })
  .strict()

/** v3 adds a pinned default initiative-policy definition; v1/v2 remain historical. */
const systemAuthoredV3DtoSchema = z
  .object({
    ...systemVocabularyFields,
    schemaVersion: z.literal(3),
    abilities: z
      .array(abilityVocabularyDtoSchema)
      .min(1)
      .superRefine((abilities, context) => {
        const ids = new Set<string>()
        const codes = new Set<string>()
        for (const [index, ability] of abilities.entries()) {
          if (ids.has(ability.id))
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index, 'id'],
              message: 'System ability definition IDs must be unique.'
            })
          if (codes.has(ability.code))
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index, 'code'],
              message: 'System ability codes must be unique.'
            })
          ids.add(ability.id)
          codes.add(ability.code)
        }
      }),
    initiativePolicy: systemInitiativePolicyDtoSchema
  })
  .strict()

export const systemAuthoredDtoSchema = z.union([
  systemAuthoredV1DtoSchema,
  systemAuthoredV2DtoSchema,
  systemAuthoredV3DtoSchema
])

export type SystemAuthoredDto = z.infer<typeof systemAuthoredDtoSchema>
