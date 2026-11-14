import { z, lazySchema } from '../zod.js'

import { MAX_ENCOUNTER_ACTORS } from './authoredLimits.js'
import { MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR } from './activeRuleEffects.js'
import {
  ruleExecutionIntegerSchema as integer,
  ruleExecutionUuidSchema as uuid
} from './ruleExecutionPrimitives.js'

const movementReactionCharacterTransitionDtoSchema = lazySchema(() =>
  z.strictObject({
    characterId: uuid,
    beforeStreamVersion: integer.check(z.gte(0)),
    afterStreamVersion: integer.check(z.gte(0))
  })
)

export const pendingSpatialCharacterTransitionsDtoSchema = lazySchema(() =>
  z
    .array(movementReactionCharacterTransitionDtoSchema)
    .check(
      z.maxLength(
        MAX_ENCOUNTER_ACTORS +
          MAX_ENCOUNTER_ACTORS * MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR
      )
    )
    .check(
      z.superRefine((transitions, context) => {
        let priorCharacterId = ''
        for (const [index, transition] of transitions.entries()) {
          if (
            transition.afterStreamVersion <= transition.beforeStreamVersion ||
            transition.characterId <= priorCharacterId
          )
            context.addIssue({
              code: 'custom',
              path: [index],
              message: 'Pending spatial Character transitions must advance in canonical order.'
            })
          priorCharacterId = transition.characterId
        }
      })
    )
)
