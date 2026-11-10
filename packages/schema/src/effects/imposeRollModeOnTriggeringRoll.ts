import { z, lazySchema } from '../zod.js'

import { authoredIdentifierSchema } from '../shared/authoredLimits.js'
import { systemCoreCodeSchema } from '../shared/systemCoreCode.js'

/** A reaction that gives the roll that triggered it a roll mode (Protection: disadvantage on the attack roll). */
export const imposeRollModeOnTriggeringRollDtoSchema = lazySchema(() =>
  z.strictObject({
    id: authoredIdentifierSchema,
    effectKind: z.literal('IMPOSE_ROLL_MODE_ON_TRIGGERING_ROLL'),
    /** A System roll-mode code, such as DISADVANTAGE. */
    rollMode: systemCoreCodeSchema
  })
)
