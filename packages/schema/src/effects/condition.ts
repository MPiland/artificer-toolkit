import { z } from 'zod'

export const conditionDtoSchema = z.object({
  id: z.string(),
  effectKind: z.literal('CONDITION'),
  conditionId: z.string()
})

export type ConditionDto = z.infer<typeof conditionDtoSchema>
