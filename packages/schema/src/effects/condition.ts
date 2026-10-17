import { z, lazySchema } from '../zod.js'
import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

export const conditionDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('CONDITION'),
    conditionId: authoredIdentifierSchema,
    /** The creature taking the action is this condition's source (Frightened's "source of its fear"). */
    recordsSource: z.optional(z.boolean()),
    /** The condition's holder must Dash away from its source (Fear's "must Dash away"); needs `recordsSource`. */
    fleesSource: z.optional(z.boolean())
  })
)

export type ConditionDto = z.infer<typeof conditionDtoSchema>
