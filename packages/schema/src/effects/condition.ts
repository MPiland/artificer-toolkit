import { z } from '../zod.js'
import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

export const conditionDtoSchema = z.object({
  id: authoredIdentifierSchema,
  effectKind: z.literal('CONDITION'),
  conditionId: authoredIdentifierSchema
})

export type ConditionDto = z.infer<typeof conditionDtoSchema>
