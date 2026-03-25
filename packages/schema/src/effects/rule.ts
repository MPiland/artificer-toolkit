import { z } from 'zod'

export const ruleDtoSchema = z.object({
  id: z.string(),
  effectKind: z.literal('RULE')
})

export type RuleDto = z.infer<typeof ruleDtoSchema>
