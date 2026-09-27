import { z } from '../zod.js'

import { serverCompletedRuleExecutionDtoSchema } from './ruleExecutionProtocol.js'
import {
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionIntegerSchema as integerSchema,
  ruleExecutionPositiveIntegerSchema as positiveIntegerSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'
import { MAX_ENCOUNTER_ACTORS } from './authoredLimits.js'

export const initiativeEntityIdentityDtoSchema = z.strictObject({
  kind: z.enum(['ACTOR', 'SIDE']),
  id: uuidSchema
})

export const initiativeScoreBatchResultDtoSchema = z.strictObject({
  entity: initiativeEntityIdentityDtoSchema,
  result: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('FACTS_UNAVAILABLE') }),
    z.strictObject({ kind: z.literal('EVIDENCE_NOT_ALLOWED') }),
    z.strictObject({
      kind: z.literal('GRAPH_COMPLETE'),
      execution: z.discriminatedUnion('automatic', [
        z.strictObject({
          automatic: z.literal(true),
          score: z.number(),
          sortDirection: z.enum(['ASCENDING', 'DESCENDING']),
          execution: z.lazy(() => serverCompletedRuleExecutionDtoSchema)
        }),
        z.strictObject({
          automatic: z.literal(false),
          score: z.null(),
          sortDirection: z.enum(['ASCENDING', 'DESCENDING']),
          execution: z.lazy(() => serverCompletedRuleExecutionDtoSchema)
        })
      ])
    })
  ])
})

export const initiativeScoreGroupDtoSchema = z.strictObject({
  score: z.number(),
  members: z
    .array(initiativeEntityIdentityDtoSchema)
    .check(z.minLength(1))
    .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
  classification: z.enum(['SETTLED', 'TIED'])
})

export const initiativeOrderSegmentDtoSchema = z.strictObject({
  kind: z.enum(['SETTLED', 'ORDER_CHOICE_REQUIRED']),
  score: z.number(),
  members: z
    .array(initiativeEntityIdentityDtoSchema)
    .check(z.minLength(1))
    .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
})

export const initiativePendingScoreBatchDtoSchema = z.strictObject({
  completed: z.array(initiativeScoreBatchResultDtoSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
  current: initiativeEntityIdentityDtoSchema,
  remaining: z.array(initiativeEntityIdentityDtoSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS - 1))
})

export const initiativeTieEvaluationAttemptDtoSchema = z.strictObject({
  originalScore: z.number(),
  attemptOrdinal: integerSchema.check(z.gte(1)).check(z.lte(20)),
  results: z
    .array(initiativeScoreBatchResultDtoSchema)
    .check(z.minLength(2))
    .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
})

export const initiativeOrderChoiceEvidenceDtoSchema = z.strictObject({
  selectedEntity: initiativeEntityIdentityDtoSchema,
  execution: z.lazy(() => serverCompletedRuleExecutionDtoSchema)
})

export const initiativeExecutionEvidenceDtoSchema = z.strictObject({
  primaryResults: z
    .array(initiativeScoreBatchResultDtoSchema)
    .check(z.minLength(1))
    .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
  tieAttempts: z
    .array(initiativeTieEvaluationAttemptDtoSchema)
    .check(z.maxLength(MAX_ENCOUNTER_ACTORS * 20)),
  orderChoices: z
    .array(initiativeOrderChoiceEvidenceDtoSchema)
    .check(z.maxLength(MAX_ENCOUNTER_ACTORS - 1))
})

export const encounterInitiativeAdvancePlanDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('SAME_ROUND'),
    round: positiveIntegerSchema,
    stateChecksum: checksumSchema,
    currentActorId: uuidSchema,
    nextActorId: uuidSchema
  }),
  z
    .strictObject({
      kind: z.literal('ROUND_WRAP'),
      round: positiveIntegerSchema,
      nextRound: positiveIntegerSchema,
      cadence: z.enum(['ENCOUNTER_START', 'EACH_ROUND']),
      stateChecksum: checksumSchema,
      currentActorId: uuidSchema,
      firstActorId: z.nullable(uuidSchema),
      orderedActorIds: z
        .array(uuidSchema)
        .check(z.minLength(1))
        .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
      orderedSideIds: z.array(uuidSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS))
    })
    .check(
      z.superRefine((value, context) => {
        if (value.nextRound !== value.round + 1)
          context.addIssue({
            code: 'custom',
            path: ['nextRound'],
            message: 'Initiative round wraps must advance exactly one round.'
          })
        // The kept order opens with its first actor that isn't defeated (D63).
        if (
          (value.cadence === 'ENCOUNTER_START' &&
            (value.firstActorId === null || !value.orderedActorIds.includes(value.firstActorId))) ||
          (value.cadence === 'EACH_ROUND' && value.firstActorId !== null)
        )
          context.addIssue({
            code: 'custom',
            path: ['firstActorId'],
            message:
              'Encounter-start cadence must open with one of its actors; each-round cadence must defer it.'
          })
      })
    )
])

export type EncounterInitiativeAdvancePlanDto = z.infer<
  typeof encounterInitiativeAdvancePlanDtoSchema
>

export const initiativeBeforePinDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('INITIAL_START'),
    actorIds: z.array(uuidSchema).check(z.minLength(1)).check(z.maxLength(MAX_ENCOUNTER_ACTORS))
  }),
  z.strictObject({
    kind: z.literal('EACH_ROUND'),
    round: positiveIntegerSchema,
    version: integerSchema.check(z.gte(0)),
    checksum: checksumSchema,
    actorIds: z.array(uuidSchema).check(z.minLength(1)).check(z.maxLength(MAX_ENCOUNTER_ACTORS))
  })
])

export type InitiativeBeforePinDto = z.infer<typeof initiativeBeforePinDtoSchema>

const encounterInitiativeSettlementBaseShape = {
  round: positiveIntegerSchema,
  cadence: z.enum(['ENCOUNTER_START', 'EACH_ROUND']),
  orderedActorIds: z
    .array(uuidSchema)
    .check(z.minLength(1))
    .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
  orderedSideIds: z.array(uuidSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS))
}

/** Terminal normalized initiative order plus every graph execution that established it. */
export const encounterInitiativeSettlementDtoSchema = z
  .discriminatedUnion('procedure', [
    z.strictObject({
      ...encounterInitiativeSettlementBaseShape,
      procedure: z.literal('MANUAL'),
      cadence: z.literal('ENCOUNTER_START'),
      policySnapshotChecksum: z.null(),
      evidence: z.strictObject({
        primaryResults: z.tuple([]),
        tieAttempts: z.tuple([]),
        orderChoices: z.tuple([])
      })
    }),
    z.strictObject({
      ...encounterInitiativeSettlementBaseShape,
      procedure: z.enum(['ACTOR_ROLL', 'ACTOR_SCORE', 'SIDE_ROLL', 'DECLARED_ACTION_ROLL']),
      policySnapshotChecksum: checksumSchema,
      evidence: initiativeExecutionEvidenceDtoSchema
    })
  ])
  .check(
    z.superRefine((value, context) => {
      const checkUnique = (ids: readonly string[], path: 'orderedActorIds' | 'orderedSideIds') => {
        if (new Set(ids).size !== ids.length)
          context.addIssue({
            code: 'custom',
            path: [path],
            message: 'Settled initiative identities must be unique.'
          })
      }
      checkUnique(value.orderedActorIds, 'orderedActorIds')
      checkUnique(value.orderedSideIds, 'orderedSideIds')
      if ((value.procedure === 'SIDE_ROLL') !== value.orderedSideIds.length > 0)
        context.addIssue({
          code: 'custom',
          path: ['orderedSideIds'],
          message: 'Only Side Initiative settlements retain an ordered side cohort.'
        })
    })
  )

export type EncounterInitiativeSettlementDto = z.infer<
  typeof encounterInitiativeSettlementDtoSchema
>
