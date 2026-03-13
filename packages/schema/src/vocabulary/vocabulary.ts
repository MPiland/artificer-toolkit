import { z } from 'zod'

export const vocabularyDtoSchema = z.object({
  id: z.string(),
  code: z.string(),
  label: z.string(),
  description: z.string().nullable().optional(),
  tooltip: z.string().nullable().optional(),
  short: z.string().nullable().optional()
})

export type VocabularyDto = z.infer<typeof vocabularyDtoSchema>
