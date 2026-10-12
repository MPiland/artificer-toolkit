import {
  BASIC_ACTION_MECHANIC_CODE,
  type BasicActionMechanicCode
} from '@artificer-toolkit/shared/core'
import { featureEffectDtoSchema } from '../effects/effect.js'
import { z, lazySchema } from '../zod.js'

import { authoredNestedCollectionSchema } from './authoredLimits.js'
import { facetDtoSchema } from './facet.js'
import { postgresUuidSchema } from './postgresUuid.js'

const basicActionMechanicDtoSchema = lazySchema(() =>
  z.enum(
    Object.values(BASIC_ACTION_MECHANIC_CODE) as [
      BasicActionMechanicCode,
      ...BasicActionMechanicCode[]
    ]
  )
)

/** The allowance a basic action spends; a free one spends none. */
export const basicActionCostDtoSchema = lazySchema(() => z.enum(['ACTION', 'BONUS_ACTION', 'FREE']))

/** The ability check a basic action makes, e.g. First Aid's DC 10 Wisdom (Medicine) check. */
const basicActionCheckDtoSchema = lazySchema(() =>
  z.strictObject({
    checkDefinitionId: postgresUuidSchema,
    dc: z.number().check(z.int()).check(z.positive())
  })
)

/**
 * One System-authored basic combat action (Q11): the System names it and writes its rules text.
 * An entry carries either `effects` (an authored action, compiled and resolved through
 * RESOLVE_ACTION like a Feature's; its activation is its cost) or the transitional closed
 * `mechanics` the room executes (Dash, Disengage, Help, First Aid); never both.
 * `restrictions` limit which actors the entry applies to (null = every actor) and are carried
 * until the offering rules read them. `check` is the check a `STABILIZE_TARGET` action makes.
 */
export const basicActionReusableDefinitionDocumentDtoSchema = lazySchema(() =>
  z
    .strictObject({
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
        ),
      restrictions: z.nullable(facetDtoSchema),
      effects: authoredNestedCollectionSchema(featureEffectDtoSchema),
      check: z.nullable(basicActionCheckDtoSchema)
    })
    .check(
      z.superRefine((document, context) => {
        if (document.mechanics.length > 0 && document.effects.length > 0)
          context.addIssue({
            code: 'custom',
            path: ['effects'],
            message: 'A basic action carries either authored effects or mechanics, never both.'
          })
        if (document.mechanics.includes('STABILIZE_TARGET') !== (document.check !== null))
          context.addIssue({
            code: 'custom',
            path: ['check'],
            message: 'Only a stabilizing action names the check it makes.'
          })
      })
    )
)
export type BasicActionReusableDefinitionDocumentDto = z.infer<
  typeof basicActionReusableDefinitionDocumentDtoSchema
>

/**
 * A lasting basic-action effect, kept in the acting actor's Run resources until the start of that
 * actor's next turn. `NO_OPPORTUNITY_ATTACKS` also ends when the turn it was taken in
 * (`turnSequence`) ends, and `ALLY_ADVANTAGE` when the ally's next attack roll or check uses it.
 */
export const encounterBasicActionEffectDtoSchema = lazySchema(() =>
  z
    .strictObject({
      definitionId: postgresUuidSchema,
      mechanic: z.enum(['ALLY_ADVANTAGE', 'NO_OPPORTUNITY_ATTACKS']),
      turnSequence: z.number().check(z.int()).check(z.nonnegative()),
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
)
export type EncounterBasicActionEffectDto = z.infer<typeof encounterBasicActionEffectDtoSchema>

export const encounterBasicActionEffectsDtoSchema = lazySchema(() =>
  z.array(encounterBasicActionEffectDtoSchema).check(z.maxLength(16))
)

/** The helper's ally advantage (Help) an attack roll or check used; its commit removes it. */
export const encounterAllyAdvantageUseDtoSchema = lazySchema(() =>
  z.strictObject({
    helperActorId: postgresUuidSchema,
    effect: encounterBasicActionEffectDtoSchema
  })
)
export type EncounterAllyAdvantageUseDto = z.infer<typeof encounterAllyAdvantageUseDtoSchema>

/** The ally advantages a committed roll used: at most one per participant of a contest. */
export const encounterAllyAdvantageUsesDtoSchema = lazySchema(() =>
  z.array(encounterAllyAdvantageUseDtoSchema).check(z.maxLength(2))
)
