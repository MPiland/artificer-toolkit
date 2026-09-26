import {
  BASIC_ACTION_MECHANIC_CODE,
  type BasicActionMechanicCode
} from '@artificer-toolkit/shared/core'
import { z } from '../zod.js'

import { postgresUuidSchema } from './postgresUuid.js'

export const basicActionMechanicDtoSchema = z.enum(
  Object.values(BASIC_ACTION_MECHANIC_CODE) as [
    BasicActionMechanicCode,
    ...BasicActionMechanicCode[]
  ]
)
export type BasicActionMechanicDto = z.infer<typeof basicActionMechanicDtoSchema>

/** The allowance a basic action spends; a free one spends none. */
export const basicActionCostDtoSchema = z.enum(['ACTION', 'BONUS_ACTION', 'FREE'])

/**
 * One System-authored basic combat action (Q11): the System names it and writes its rules text;
 * `mechanics` are the closed rule kinds the room executes. An entry without mechanics is logged.
 */
export const basicActionReusableDefinitionDocumentDtoSchema = z.strictObject({
  schemaVersion: z.literal(1),
  kind: z.literal('BASIC_ACTION'),
  id: postgresUuidSchema,
  gameSystemId: postgresUuidSchema,
  rulesText: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(4_000)),
  actionCost: basicActionCostDtoSchema,
  mechanics: z
    .array(basicActionMechanicDtoSchema)
    .check(z.maxLength(basicActionMechanicDtoSchema.options.length))
    .check(
      z.superRefine((mechanics, context) => {
        if (mechanics.some((mechanic, index) => index > 0 && mechanics[index - 1]! >= mechanic))
          context.addIssue({
            code: 'custom',
            message: 'Basic action mechanics must be unique and sorted.'
          })
      })
    )
})
export type BasicActionReusableDefinitionDocumentDto = z.infer<
  typeof basicActionReusableDefinitionDocumentDtoSchema
>

/**
 * A lasting basic-action effect, kept in the acting actor's Run resources until the start of that
 * actor's next turn. `NO_OPPORTUNITY_ATTACKS` also ends with the turn it was taken in, and
 * `ALLY_ADVANTAGE` when the ally's next attack uses it.
 */
export const encounterBasicActionEffectDtoSchema = z
  .strictObject({
    definitionId: postgresUuidSchema,
    mechanic: z.enum([
      'NO_OPPORTUNITY_ATTACKS',
      'DISADVANTAGE_ON_ATTACKS_AGAINST',
      'ALLY_ADVANTAGE'
    ]),
    round: z.number().check(z.int()).check(z.positive()),
    allyActorId: z.nullable(postgresUuidSchema)
  })
  .check(
    z.superRefine((effect, context) => {
      if ((effect.mechanic === 'ALLY_ADVANTAGE') !== (effect.allyActorId !== null))
        context.addIssue({
          code: 'custom',
          path: ['allyActorId'],
          message: 'Only an ally-advantage effect names an ally.'
        })
    })
  )
export type EncounterBasicActionEffectDto = z.infer<typeof encounterBasicActionEffectDtoSchema>

export const encounterBasicActionEffectsDtoSchema = z
  .array(encounterBasicActionEffectDtoSchema)
  .check(z.maxLength(16))
