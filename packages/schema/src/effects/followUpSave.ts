import { FOLLOW_UP_SAVE_TIMING, type FollowUpSaveTiming } from '@artificer-toolkit/shared/core'
import { z } from 'zod'

import { savingThrowDtoSchema } from '../shared/savingThrow.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema
} from '../shared/authoredLimits.js'

const followUpSaveTimings = Object.values(FOLLOW_UP_SAVE_TIMING) as [
  FollowUpSaveTiming,
  ...FollowUpSaveTiming[]
]

export function createFollowUpSaveDtoSchema(outcomeDtoSchema: z.ZodTypeAny) {
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

  return z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('FOLLOW_UP_SAVE'),
    timing: z.enum(followUpSaveTimings),
    savingThrow: savingThrowDtoSchema,
    attempts: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('ONCE'), repeatOnFailure: z.boolean().optional() }),
      z.object({
        kind: z.literal('THRESHOLDS'),
        successesToEnd: z.number().int().positive(),
        failuresToResolve: z.number().int().positive(),
        consecutive: z.boolean()
      })
    ]),
    onSuccess: branchDtoSchema,
    onFailure: branchDtoSchema,
    onDurationComplete: branchDtoSchema.optional()
  })
}
