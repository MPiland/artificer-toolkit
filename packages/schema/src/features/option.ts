import { z } from '../zod.js'

import { authoredIdentifierSchema } from '../shared/authoredLimits.js'
import { featureBaseDtoObject } from './base.js'

/**
 * A Legendary option that runs one of its Creature's own action Features ("The dragon makes a tail
 * attack") at the option's charge cost from its owner Feature's pool (D51 option B).
 */
export const featureOptionActionReferenceDtoSchema = z.strictObject({
  featureId: authoredIdentifierSchema,
  chargeCost: z.number().check(z.int()).check(z.positive())
})

export const featureOptionDtoSchema = z
  .extend(featureBaseDtoObject, {
    actionReference: z.optional(featureOptionActionReferenceDtoSchema)
  })
  .check(
    z.superRefine((option, context) => {
      if (option.actionReference && option.effects?.length)
        context.addIssue({
          code: 'custom',
          path: ['effects'],
          message: 'An option that runs another action authors no effects of its own.'
        })
    })
  )
