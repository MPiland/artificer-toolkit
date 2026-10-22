import { FOLLOW_UP_SAVE_TIMING, type FollowUpSaveTiming } from '@artificer-toolkit/shared/core'
import { lazySchema, z } from '../zod.js'

import { savingThrowDtoSchema } from '../shared/savingThrow.js'
import { combatPerceptionRequirementDtoSchema } from '../shared/combatPerception.js'
import { damageTypeFilterDtoSchema, pathLifecycleEndTriggersDtoSchema } from '../shared/reaction.js'
import { pathLifecycleEndTriggerBySchema } from '../shared/enums.js'
import { conditionDtoSchema } from './condition.js'
import { resultBlockGateDtoSchema } from './resultBlockGate.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredReferenceCollectionSchema
} from '../shared/authoredLimits.js'
import { systemVocabularyCodeSchema } from '../shared/systemVocabularyCode.js'

const followUpSaveTimings = Object.values(FOLLOW_UP_SAVE_TIMING) as [
  FollowUpSaveTiming,
  ...FollowUpSaveTiming[]
]

const repeatPerceptionDtoSchema = lazySchema(() =>
  z.object({
    kind: z.literal('PERCEPTION'),
    observer: z.literal('TARGET'),
    subject: z.literal('SOURCE'),
    requirement: combatPerceptionRequirementDtoSchema
  })
)

/**
 * Conditions a save failed by at least `failedBy` also applies, for the save's duration. They end
 * on their own triggers, independently of the failure's outcomes.
 */
export const failureMarginRiderDtoSchema = lazySchema(() =>
  z.strictObject({
    id: authoredIdentifierSchema,
    failedBy: z.number().check(z.int()).check(z.gte(1)).check(z.lte(30)),
    outcomes: authoredNestedCollectionSchema(conditionDtoSchema).check(z.minLength(1)),
    endsWithOutcomeId: z.optional(authoredIdentifierSchema),
    lifecycle: z.strictObject({
      endOnTriggers: z.optional(pathLifecycleEndTriggersDtoSchema)
    })
  })
)

export function createFollowUpSaveDtoSchema(outcomeDtoSchema: z.ZodMiniType) {
  const branchDtoSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('END') }),
    z.object({ kind: z.literal('CONTINUE') }),
    z.object({
      kind: z.literal('OUTCOMES'),
      endCurrent: z.boolean(),
      resultKind: z.enum(['SINGLE', 'SEQUENCE']),
      gate: z.optional(resultBlockGateDtoSchema),
      outcomes: authoredNestedCollectionSchema(outcomeDtoSchema)
    })
  ])

  return z
    .object({
      id: authoredIdentifierSchema,
      effectKind: z.literal('FOLLOW_UP_SAVE'),
      timing: z.enum(followUpSaveTimings),
      repeatTiming: z.optional(
        z.enum(
          followUpSaveTimings.filter((timing) => timing !== 'ON_TRIGGERS_ONLY') as [
            FollowUpSaveTiming,
            ...FollowUpSaveTiming[]
          ]
        )
      ),
      repeatRollInfluence: z.optional(
        z.object({
          influence: systemVocabularyCodeSchema,
          when: repeatPerceptionDtoSchema
        })
      ),
      repeatAttemptGate: z.optional(
        z.object({
          allow: z.enum(['WHEN_MET', 'WHEN_UNMET']),
          when: repeatPerceptionDtoSchema
        })
      ),
      repeatTriggers: z.optional(
        authoredReferenceCollectionSchema(
          z.strictObject({
            kind: z.literal('DAMAGE_TAKEN'),
            by: pathLifecycleEndTriggerBySchema,
            damageTypeIds: z.optional(damageTypeFilterDtoSchema),
            rollInfluence: z.optional(systemVocabularyCodeSchema)
          })
        ).check(z.minLength(1))
      ),
      savingThrow: savingThrowDtoSchema,
      attempts: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('ONCE'), repeatOnFailure: z.optional(z.boolean()) }),
        z.object({
          kind: z.literal('THRESHOLDS'),
          successesToEnd: z.number().check(z.int()).check(z.positive()),
          failuresToResolve: z.number().check(z.int()).check(z.positive()),
          consecutive: z.boolean()
        })
      ]),
      onSuccess: branchDtoSchema,
      onFailure: branchDtoSchema,
      onDurationComplete: z.optional(branchDtoSchema),
      failureMarginRider: z.optional(failureMarginRiderDtoSchema)
    })
    .check(
      z.superRefine((value, context) => {
        if (
          value.attempts.kind === 'ONCE' &&
          value.attempts.repeatOnFailure === true &&
          value.timing === 'IMMEDIATE' &&
          value.repeatTiming === undefined
        ) {
          context.addIssue({
            code: 'custom',
            path: ['repeatTiming'],
            message: 'Immediate repeated saving throws require an exact repeat timing.'
          })
        }
        if (value.timing === 'ON_TRIGGERS_ONLY') {
          if (
            value.repeatTriggers === undefined ||
            !(value.attempts.kind === 'ONCE' && value.attempts.repeatOnFailure === true)
          )
            context.addIssue({
              code: 'custom',
              path: ['timing'],
              message:
                'A save made only on repeat triggers requires repeat triggers on a repeated one-time saving throw.'
            })
          for (const [policy, name] of [
            [value.repeatRollInfluence, 'repeatRollInfluence'],
            [value.repeatAttemptGate, 'repeatAttemptGate']
          ] as const)
            if (policy !== undefined)
              context.addIssue({
                code: 'custom',
                path: [name],
                message: 'A save made only on repeat triggers has no turn-end repeat to shape.'
              })
        }
        if (
          value.repeatTiming !== undefined &&
          !(value.attempts.kind === 'ONCE' && value.attempts.repeatOnFailure === true)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['repeatTiming'],
            message: 'Repeat timing requires a repeated one-time saving throw.'
          })
        }
        if (
          value.repeatTriggers !== undefined &&
          !(value.attempts.kind === 'ONCE' && value.attempts.repeatOnFailure === true)
        ) {
          context.addIssue({
            code: 'custom',
            path: ['repeatTriggers'],
            message: 'Repeat triggers require a repeated one-time saving throw.'
          })
        }
        const repeatsAtTargetTurnEnd =
          value.attempts.kind === 'ONCE' &&
          value.attempts.repeatOnFailure === true &&
          (value.timing === 'TARGET_TURN_END' ||
            (value.timing === 'IMMEDIATE' && value.repeatTiming === 'TARGET_TURN_END'))
        if (value.repeatRollInfluence !== undefined && !repeatsAtTargetTurnEnd) {
          context.addIssue({
            code: 'custom',
            path: ['repeatRollInfluence'],
            message: 'Repeat roll influence requires a repeated save at the end of the target turn.'
          })
        }
        // The plan for a save made at once on application carries no gate yet, so a gate is
        // authorable only on a save first made at the end of the target turn.
        if (
          value.repeatAttemptGate !== undefined &&
          !(repeatsAtTargetTurnEnd && value.timing === 'TARGET_TURN_END')
        ) {
          context.addIssue({
            code: 'custom',
            path: ['repeatAttemptGate'],
            message:
              'A repeat attempt gate requires a repeated save first made at the end of the target turn.'
          })
        }
        // A branch gate is read by the save's own graph at once, so only a one-time immediate save
        // that never repeats can carry one.
        const gatesAtOnce =
          value.timing === 'IMMEDIATE' &&
          value.attempts.kind === 'ONCE' &&
          value.attempts.repeatOnFailure !== true
        for (const [branch, name] of [
          [value.onSuccess, 'onSuccess'],
          [value.onFailure, 'onFailure'],
          [value.onDurationComplete, 'onDurationComplete']
        ] as const) {
          if (
            branch?.kind === 'OUTCOMES' &&
            branch.gate !== undefined &&
            !(gatesAtOnce && name !== 'onDurationComplete')
          ) {
            context.addIssue({
              code: 'custom',
              path: [name, 'gate'],
              message:
                'A branch gate requires an immediate one-time saving throw that does not repeat.'
            })
          }
        }
        // A turn reads one perception result, so one save gates or influences its repeat, not both.
        if (value.repeatAttemptGate !== undefined && value.repeatRollInfluence !== undefined) {
          context.addIssue({
            code: 'custom',
            path: ['repeatAttemptGate'],
            message: 'A repeat attempt gate cannot be combined with repeat roll influence.'
          })
        }
      })
    )
}
