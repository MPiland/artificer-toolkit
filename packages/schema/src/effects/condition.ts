import { z, lazySchema } from '../zod.js'
import { authoredIdentifierSchema } from '../shared/authoredLimits.js'
import { durationDtoSchema } from '../shared/duration.js'

export const conditionDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('CONDITION'),
    conditionId: authoredIdentifierSchema,
    /** The creature taking the action is this condition's source (Frightened's "source of its fear"). */
    recordsSource: z.optional(z.boolean()),
    /** The condition's holder must Dash away from its source (Fear's "must Dash away"); needs `recordsSource`. */
    fleesSource: z.optional(z.boolean()),
    /** How long a gated band's condition lasts; the band's conditions each count their own. */
    duration: z.optional(durationDtoSchema),
    /** A sibling condition of the same band this one ends with (paralyzed "while poisoned this way"). */
    endsWithOutcomeId: z.optional(authoredIdentifierSchema)
  })
)

export type ConditionDto = z.infer<typeof conditionDtoSchema>
