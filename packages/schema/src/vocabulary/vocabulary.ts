import { z } from '../zod.js'

export const vocabularyDtoSchema = z.object({
  id: z.string(),
  code: z.string(),
  label: z.string(),
  description: z.optional(z.nullable(z.string())),
  tooltip: z.optional(z.nullable(z.string())),
  short: z.optional(z.nullable(z.string()))
})

export type VocabularyDto = z.infer<typeof vocabularyDtoSchema>
