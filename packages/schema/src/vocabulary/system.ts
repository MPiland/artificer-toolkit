import { z } from 'zod'

import { vocabularyDtoSchema } from './vocabulary.js'

export const systemAuthoredDtoSchema = z.object({
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
})

export type SystemAuthoredDto = z.infer<typeof systemAuthoredDtoSchema>
