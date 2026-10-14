import { z, lazySchema } from '../zod.js'

export const vocabularyDtoSchema = lazySchema(() =>
  z.object({
    id: z.string(),
    code: z.string(),
    label: z.string(),
    description: z.optional(z.nullable(z.string())),
    short: z.optional(z.nullable(z.string()))
  })
)

export type VocabularyDto = z.infer<typeof vocabularyDtoSchema>
