import { z, lazySchema } from '../zod.js'

import { rolledDiePayloadDtoSchema } from '../grants/modifier.js'
import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

export const subtractFromTriggeringRollDtoSchema = lazySchema(() =>
  z.strictObject({
    id: authoredIdentifierSchema,
    effectKind: z.literal('SUBTRACT_FROM_TRIGGERING_ROLL'),
    die: rolledDiePayloadDtoSchema().check(
      z.superRefine((die, context) => {
        if (die.sign !== 'SUBTRACT') {
          context.addIssue({
            code: 'custom',
            path: ['sign'],
            message: 'The die this reaction rolls subtracts from the roll.'
          })
        }
      })
    )
  })
)
