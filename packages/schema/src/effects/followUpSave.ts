import { FOLLOW_UP_SAVE_TIMING, type FollowUpSaveTiming } from '@artificer-toolkit/shared/core'
import { z } from '../zod.js'

import { savingThrowDtoSchema } from '../shared/savingThrow.js'
import { combatPerceptionRequirementDtoSchema } from '../shared/combatPerception.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema
} from '../shared/authoredLimits.js'

const followUpSaveTimings = Object.values(FOLLOW_UP_SAVE_TIMING) as [
  FollowUpSaveTiming,
  ...FollowUpSaveTiming[]
]

export function createFollowUpSaveDtoSchema(outcomeDtoSchema: z.ZodMiniType) {
  const branchDtoSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('END') }),
    z.object({ kind: z.literal('CONTINUE') }),
    z.object({
      kind: z.literal('OUTCOMES'),
      endCurrent: z.boolean(),
      resultKind: z.enum(['SINGLE', 'SEQUENCE']),
      outcomes: authoredNestedCollectionSchema(outcomeDtoSchema)
    })
  ])

  return z
    .object({
      id: authoredIdentifierSchema,
      effectKind: z.literal('FOLLOW_UP_SAVE'),
      timing: z.enum(followUpSaveTimings),
      repeatTiming: z.optional(z.enum(followUpSaveTimings)),
      repeatRollInfluence: z.optional(
        z.object({
          influence: z.enum(['ADVANTAGE', 'DISADVANTAGE']),
          when: z.object({
            kind: z.literal('PERCEPTION'),
            observer: z.literal('TARGET'),
            subject: z.literal('SOURCE'),
            requirement: combatPerceptionRequirementDtoSchema
          })
        })
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
      onDurationComplete: z.optional(branchDtoSchema)
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
          value.repeatRollInfluence !== undefined &&
          !(
            value.attempts.kind === 'ONCE' &&
            value.attempts.repeatOnFailure === true &&
            (value.timing === 'TARGET_TURN_END' ||
              (value.timing === 'IMMEDIATE' && value.repeatTiming === 'TARGET_TURN_END'))
          )
        ) {
          context.addIssue({
            code: 'custom',
            path: ['repeatRollInfluence'],
            message: 'Repeat roll influence requires a repeated save at the end of the target turn.'
          })
        }
      })
    )
}
