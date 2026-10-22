import { z, lazySchema } from '../zod.js'
import { activeRuleEffectRecordSchema } from '../projections/activeRuleEffectPersistence.js'
import { MAX_ACTIVE_RULE_EFFECTS_PER_OWNER } from './activeRuleEffects.js'
import { frozenCheckD20DtoSchema } from './ruleExecutionEvidence.js'
import { ruleCheckD20EvidenceDtoSchema } from './ruleExecutionEncounterApplications.js'
import { targetOutcomeTransitionDtoSchema } from './ruleExecutionMechanics.js'
import {
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionIdentifierSchema as identifierSchema,
  ruleExecutionPositiveIntegerSchema as positiveIntegerSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'

const checkActionDefinitionSchema = lazySchema(() =>
  z.strictObject({ id: uuidSchema, version: positiveIntegerSchema, checksum: checksumSchema })
)

/**
 * A fixed-DC check action whose success runs an authored outcome on its target (D173): the actor's
 * frozen check against the authored DC, and the one-check grants (a Help) it used up.
 */
export const encounterCheckActionContextDtoSchema = lazySchema(() =>
  z.strictObject({
    kind: z.literal('ENCOUNTER_CHECK_ACTION'),
    schemaVersion: z.literal(1),
    commandId: uuidSchema,
    commandFingerprint: checksumSchema,
    definition: checkActionDefinitionSchema,
    actionLabel: identifierSchema,
    actorId: uuidSchema,
    targetActorId: uuidSchema,
    check: z.strictObject({
      checkDefinitionId: uuidSchema,
      dc: positiveIntegerSchema,
      label: identifierSchema
    }),
    d20: frozenCheckD20DtoSchema,
    consumedGrants: z
      .array(activeRuleEffectRecordSchema)
      .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER))
  })
)

export type EncounterCheckActionContextDto = z.infer<typeof encounterCheckActionContextDtoSchema>

/**
 * A settled fixed-DC check action (D173): the actor's d20 against the DC, and on success the outcome
 * the room planned on the target, which Convex re-applies. A failed check changes nothing.
 */
export const checkActionApplicationOutputDtoSchema = lazySchema(() =>
  z
    .strictObject({
      kind: z.literal('CHECK_ACTION'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      commandId: uuidSchema,
      definition: checkActionDefinitionSchema,
      actorId: uuidSchema,
      targetActorId: uuidSchema,
      check: z.strictObject({ checkDefinitionId: uuidSchema, dc: positiveIntegerSchema }),
      d20: ruleCheckD20EvidenceDtoSchema,
      outcome: z.enum(['SUCCESS', 'FAILURE']),
      stateTransition: z.discriminatedUnion('kind', [
        z.strictObject({ kind: z.literal('NONE') }),
        targetOutcomeTransitionDtoSchema
      ])
    })
    .check(
      z.superRefine((value, context) => {
        if (value.d20.dc !== value.check.dc)
          context.addIssue({
            code: 'custom',
            path: ['d20', 'dc'],
            message: 'The check evidence must be rolled against the check DC.'
          })
        if ((value.outcome === 'SUCCESS') !== value.d20.total >= value.check.dc)
          context.addIssue({
            code: 'custom',
            path: ['outcome'],
            message: 'A check succeeds exactly when it reaches its DC.'
          })
        if (value.outcome === 'FAILURE' && value.stateTransition.kind !== 'NONE')
          context.addIssue({
            code: 'custom',
            path: ['stateTransition'],
            message: 'A failed check settles no outcome.'
          })
      })
    )
)
