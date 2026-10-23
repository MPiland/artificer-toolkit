import { z, lazySchema } from '../zod.js'
import { authoredIdentifierSchema } from './authoredLimits.js'
import { activeRuleEffectRecordSchema } from '../projections/activeRuleEffectPersistence.js'
import { MAX_ACTIVE_RULE_EFFECTS_PER_OWNER } from './activeRuleEffects.js'
import { MAX_D20_ADDED_DICE } from './d20AddedDice.js'
import { d20RolledCheckDtoSchema, d20WindowOptionDtoSchema } from './ruleExecutionD20WindowOffer.js'
import { frozenCheckD20DtoSchema } from './ruleExecutionEvidence.js'
import { ruleCheckD20EvidenceDtoSchema } from './ruleExecutionEncounterApplications.js'
import { targetOutcomeTransitionDtoSchema } from './ruleExecutionMechanics.js'
import {
  ruleExecutionIntegerSchema,
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionIdentifierSchema as identifierSchema,
  ruleExecutionPositiveIntegerSchema as positiveIntegerSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'

/**
 * What makes a check action (D173): a published basic action's exact catalogue entry, or a Creature
 * Feature's Effect and its compiled mechanics, which the commit re-resolves from the creature snapshot.
 */
export const checkActionSourceDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('BASIC_ACTION'),
      definition: z.strictObject({
        id: uuidSchema,
        version: positiveIntegerSchema,
        checksum: checksumSchema
      })
    }),
    z.strictObject({
      kind: z.literal('CREATURE_FEATURE'),
      ownerFeatureId: authoredIdentifierSchema,
      effectId: authoredIdentifierSchema,
      compiledEffectChecksum: checksumSchema
    }),
    /** A spell's own ability checks (D182): the cast's `RULE_OCCURRENCE` root owns the check occurrence. */
    z.strictObject({
      kind: z.literal('SPELL_CAST'),
      castOccurrenceId: uuidSchema
    })
  ])
)

export type CheckActionSourceDto = z.infer<typeof checkActionSourceDtoSchema>

/**
 * The frozen, ordered effects a spell's checks try to end (D182): one roller prompt per entry through
 * the single d20 settlement, in order. `cursor` is the entry now waiting, and only a settlement moves it.
 */
export const encounterCheckActionCandidatesDtoSchema = lazySchema(() =>
  z.strictObject({
    entries: z
      .array(z.strictObject({ effectId: uuidSchema, dc: positiveIntegerSchema }))
      .check(z.minLength(1), z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER)),
    cursor: ruleExecutionIntegerSchema.check(z.gte(0))
  })
)

export type EncounterCheckActionCandidatesDto = z.infer<
  typeof encounterCheckActionCandidatesDtoSchema
>

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
    source: checkActionSourceDtoSchema,
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
      .check(z.maxLength(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER)),
    /** A spell's per-effect checks (D182); `check.dc` is the waiting entry's DC. Absent for a one-check action. */
    candidates: z.optional(encounterCheckActionCandidatesDtoSchema)
  })
)

export type EncounterCheckActionContextDto = z.infer<typeof encounterCheckActionContextDtoSchema>

/**
 * A check action waiting on its roller (D173): its `CHECK` d20, or, once that reached the DC, its
 * `OUTCOME` dice. `commandJson` is the root command the outcome is re-prepared from; an outcome
 * phase keeps the rolled d20, its app roll and the held dice a d20 window added to it.
 */
export const encounterCheckActionPendingContextDtoSchema = lazySchema(() =>
  z.extend(encounterCheckActionContextDtoSchema, {
    commandJson: z.string(),
    phase: z.discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('CHECK') }),
      z.strictObject({
        kind: z.literal('OUTCOME'),
        rolled: d20RolledCheckDtoSchema,
        appRollId: z.nullable(uuidSchema),
        windowDice: z.array(d20WindowOptionDtoSchema).check(z.maxLength(MAX_D20_ADDED_DICE))
      })
    ])
  })
)

export type EncounterCheckActionPendingContextDto = z.infer<
  typeof encounterCheckActionPendingContextDtoSchema
>

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
      source: checkActionSourceDtoSchema,
      actorId: uuidSchema,
      targetActorId: uuidSchema,
      check: z.strictObject({ checkDefinitionId: uuidSchema, dc: positiveIntegerSchema }),
      d20: ruleCheckD20EvidenceDtoSchema,
      outcome: z.enum(['SUCCESS', 'FAILURE']),
      /** The effect this step's check tried to end (D182); a success ends it in this output's transaction. */
      candidateEffectId: z.optional(uuidSchema),
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
