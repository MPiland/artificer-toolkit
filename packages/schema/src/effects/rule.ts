import { z } from 'zod'

export const ruleDtoSchema = z.object({
  id: z.string(),
  effectKind: z.literal('RULE'),
  label: z.string(),
  description: z.string()
})

export type RuleDto = z.infer<typeof ruleDtoSchema>
