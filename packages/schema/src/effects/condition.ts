import { z, lazySchema } from '../zod.js'
import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

export const conditionDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('CONDITION'),
    conditionId: authoredIdentifierSchema
  })
)

export type ConditionDto = z.infer<typeof conditionDtoSchema>
