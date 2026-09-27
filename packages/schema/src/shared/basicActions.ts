import {
  BASIC_ACTION_MECHANIC_CODE,
  type BasicActionMechanicCode
} from '@artificer-toolkit/shared/core'
import { z, lazySchema } from '../zod.js'

import { postgresUuidSchema } from './postgresUuid.js'

export const basicActionMechanicDtoSchema = lazySchema(() =>
  z.enum(
    Object.values(BASIC_ACTION_MECHANIC_CODE) as [
      BasicActionMechanicCode,
      ...BasicActionMechanicCode[]
    ]
  )
)
export type BasicActionMechanicDto = z.infer<typeof basicActionMechanicDtoSchema>

/** The allowance a basic action spends; a free one spends none. */
export const basicActionCostDtoSchema = lazySchema(() => z.enum(['ACTION', 'BONUS_ACTION', 'FREE']))

const sortedUniqueIds = (message: string) =>
  z
    .array(postgresUuidSchema)
    .check(z.maxLength(16))
    .check(
      z.superRefine((ids: string[], context) => {
        if (ids.some((id, index) => index > 0 && ids[index - 1]! >= id))
          context.addIssue({ code: 'custom', message })
      })
    )

/**
 * One System-authored basic combat action (Q11): the System names it and writes its rules text;
 * `mechanics` are the closed rule kinds the room executes. An entry without mechanics is logged.
 * `saveAbilityIds` names the abilities whose saving throws `SAVE_ADVANTAGE` improves, and
 * `suspendedWhileUnableToActOrMove` keeps the actor's own defensive effects (disadvantage on attacks
 * against it, save advantage) from applying while it can't act or its speed is 0.
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
      saveAbilityIds: sortedUniqueIds('Save ability IDs must be unique and sorted.'),
      suspendedWhileUnableToActOrMove: z.boolean()
    })
    .check(
      z.superRefine((document, context) => {
        if (document.mechanics.includes('SAVE_ADVANTAGE') !== document.saveAbilityIds.length > 0)
          context.addIssue({
            code: 'custom',
            path: ['saveAbilityIds'],
            message: 'Only a save-advantage action names the abilities it improves.'
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
      mechanic: z.enum([
        'ALLY_ADVANTAGE',
        'DISADVANTAGE_ON_ATTACKS_AGAINST',
        'NO_OPPORTUNITY_ATTACKS',
        'SAVE_ADVANTAGE'
      ]),
      turnSequence: z.number().check(z.int()).check(z.nonnegative()),
      allyActorId: z.nullable(postgresUuidSchema),
      saveAbilityIds: sortedUniqueIds('Save ability IDs must be unique and sorted.'),
      suspendedWhileUnableToActOrMove: z.boolean()
    })
    .check(
      z.superRefine((effect, context) => {
        if ((effect.mechanic === 'ALLY_ADVANTAGE') !== (effect.allyActorId !== null))
          context.addIssue({
            code: 'custom',
            path: ['allyActorId'],
            message: 'Only an ally-advantage effect names an ally.'
          })
        if ((effect.mechanic === 'SAVE_ADVANTAGE') !== effect.saveAbilityIds.length > 0)
          context.addIssue({
            code: 'custom',
            path: ['saveAbilityIds'],
            message: 'Only a save-advantage effect names abilities.'
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
