import { z } from '../zod.js'

import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'

import { initiativeDeclarationAdjudicationFieldDtoSchema } from './encounterRuleOccurrence.js'
import { stagedInitiativeRoundStateDtoSchema } from './initiativeState.js'
import {
  encounterInitiativeAdvancePlanDtoSchema,
  initiativeBeforePinDtoSchema,
  initiativeEntityIdentityDtoSchema,
  initiativeExecutionEvidenceDtoSchema,
  initiativeOrderChoiceEvidenceDtoSchema,
  initiativeOrderSegmentDtoSchema,
  initiativePendingScoreBatchDtoSchema,
  initiativeScoreBatchResultDtoSchema,
  initiativeScoreGroupDtoSchema,
  initiativeTieEvaluationAttemptDtoSchema
} from './ruleExecutionInitiative.js'
import { serverInitiativeDeclarationRequestDtoSchema } from './ruleExecutionProtocol.js'
import { pendingCompletedTurnPhaseDtoSchema } from './ruleExecutionResults.js'
import {
  completedTurnRechargePlanDtoSchema,
  turnActionEconomyRefreshDtoSchema,
  turnLegendaryActionEvidenceDtoSchema,
  turnLegendaryActionRefreshDtoSchema
} from './ruleExecutionTurnResources.js'
import {
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionIntegerSchema as integerSchema,
  ruleExecutionPositiveIntegerSchema as positiveIntegerSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'
import { turnResolutionCommandDtoSchema } from './ruleExecutionTurnCommands.js'

const initiativePendingOrderDtoSchema = z.strictObject({
  completedEntities: z
    .array(initiativeEntityIdentityDtoSchema)
    .check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
  completedChoices: z
    .array(initiativeOrderChoiceEvidenceDtoSchema)
    .check(z.maxLength(RULE_GRAPH_LIMITS.NODES - 1)),
  currentSegment: z.extend(initiativeOrderSegmentDtoSchema, {
    kind: z.literal('ORDER_CHOICE_REQUIRED')
  }),
  selectedFromCurrent: z
    .array(initiativeEntityIdentityDtoSchema)
    .check(z.maxLength(RULE_GRAPH_LIMITS.NODES - 1)),
  remainingCurrent: z
    .array(initiativeEntityIdentityDtoSchema)
    .check(z.minLength(2))
    .check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
  laterSegments: z
    .array(initiativeOrderSegmentDtoSchema)
    .check(z.maxLength(RULE_GRAPH_LIMITS.NODES - 1))
})

export const encounterInitiativePendingContextDtoSchema = z
  .strictObject({
    kind: z.literal('ENCOUNTER_INITIATIVE'),
    schemaVersion: z.literal(1),
    root: z.strictObject({
      rootCommandId: uuidSchema,
      commandFingerprint: checksumSchema,
      commandType: z.enum(['START', 'ADVANCE_TURN']),
      /** Who answers initiative decisions: always the Campaign owner. */
      initiatorUserId: uuidSchema,
      /** Who issued START or ADVANCE_TURN; receipts and replays belong to them. */
      requestedByUserId: uuidSchema,
      correlationId: z.nullable(uuidSchema),
      expectedEncounterVersion: integerSchema.check(z.gte(0)),
      round: positiveIntegerSchema,
      policySnapshotChecksum: checksumSchema,
      initiativeBeforePin: initiativeBeforePinDtoSchema,
      stagedInitiativeRoundState: stagedInitiativeRoundStateDtoSchema,
      startSystemId: z._default(z.nullable(uuidSchema), null),
      initiativeAdvance: z.optional(z.lazy(() => encounterInitiativeAdvancePlanDtoSchema)),
      outgoingTurn: z.optional(z.lazy(() => pendingCompletedTurnPhaseDtoSchema)),
      legendaryActionQueue: z.optional(
        z.strictObject({
          ownerActorIds: z
            .array(uuidSchema)
            .check(z.minLength(1))
            .check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
          nextOwnerIndex: z
            .number()
            .check(z.int())
            .check(z.gte(0))
            .check(z.lte(RULE_GRAPH_LIMITS.NODES - 1))
        })
      ),
      completedLegendaryActions: z.optional(
        z
          .array(z.lazy(() => turnLegendaryActionEvidenceDtoSchema))
          .check(z.maxLength(RULE_GRAPH_LIMITS.NODES))
      ),
      stagedLegendaryActionRefreshes: z.optional(
        z.array(turnLegendaryActionRefreshDtoSchema).check(z.maxLength(RULE_GRAPH_LIMITS.NODES))
      ),
      stagedActionEconomyRefreshes: z.optional(
        z.array(turnActionEconomyRefreshDtoSchema).check(z.maxLength(RULE_GRAPH_LIMITS.NODES))
      ),
      completedRechargePlan: z.optional(
        z.nullable(z.lazy(() => completedTurnRechargePlanDtoSchema))
      ),
      resolutionCommands: z._default(
        z.array(turnResolutionCommandDtoSchema).check(z.maxLength(RULE_GRAPH_LIMITS.NODES * 20)),
        []
      )
    }),
    phase: z.discriminatedUnion('kind', [
      z.strictObject({
        kind: z.literal('INITIATIVE_DECLARATION'),
        actorId: uuidSchema,
        participantVersion: integerSchema.check(z.gte(0)),
        requestId: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(256)),
        primaryOptions: serverInitiativeDeclarationRequestDtoSchema.shape.primaryOptions,
        bonusOptions: serverInitiativeDeclarationRequestDtoSchema.shape.bonusOptions,
        adjudicationFields: z
          .array(initiativeDeclarationAdjudicationFieldDtoSchema)
          .check(z.maxLength(3))
      }),
      z.strictObject({
        kind: z.literal('PRIMARY_SCORE'),
        scoreBatch: initiativePendingScoreBatchDtoSchema
      }),
      z.strictObject({
        kind: z.literal('TIE_RESOLUTION'),
        primaryResults: z
          .array(initiativeScoreBatchResultDtoSchema)
          .check(z.minLength(1))
          .check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
        completedAttempts: z
          .array(initiativeTieEvaluationAttemptDtoSchema)
          .check(z.maxLength(RULE_GRAPH_LIMITS.NODES * 20)),
        completedSegments: z
          .array(initiativeOrderSegmentDtoSchema)
          .check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
        currentOriginalGroup: z.extend(initiativeScoreGroupDtoSchema, {
          classification: z.literal('TIED')
        }),
        attemptOrdinal: integerSchema.check(z.gte(1)).check(z.lte(20)),
        scoreBatch: initiativePendingScoreBatchDtoSchema,
        laterOriginalGroups: z
          .array(initiativeScoreGroupDtoSchema)
          .check(z.maxLength(RULE_GRAPH_LIMITS.NODES - 1))
      }),
      z.strictObject({
        kind: z.literal('ENTITY_ORDER'),
        evidence: initiativeExecutionEvidenceDtoSchema,
        entityKind: z.enum(['ACTOR', 'SIDE']),
        order: initiativePendingOrderDtoSchema
      }),
      z.strictObject({
        kind: z.literal('SIDE_ACTOR_ORDER'),
        evidence: initiativeExecutionEvidenceDtoSchema,
        orderedSideIds: z
          .array(uuidSchema)
          .check(z.minLength(1))
          .check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
        order: initiativePendingOrderDtoSchema
      })
    ])
  })
  .check(
    z.superRefine((context, refinement) => {
      const hasAdvance = context.root.initiativeAdvance !== undefined
      const hasOutgoingTurn = context.root.outgoingTurn !== undefined
      if (hasAdvance !== hasOutgoingTurn) {
        refinement.addIssue({
          code: 'custom',
          path: ['root'],
          message: 'Each-round initiative must retain both advancement and outgoing-turn evidence.'
        })
        return
      }
      if (!hasAdvance) return
      const advance = context.root.initiativeAdvance!
      if (
        context.root.commandType !== 'ADVANCE_TURN' ||
        advance.kind !== 'ROUND_WRAP' ||
        advance.cadence !== 'EACH_ROUND' ||
        advance.nextRound !== context.root.round
      )
        refinement.addIssue({
          code: 'custom',
          path: ['root', 'initiativeAdvance'],
          message: 'Pending each-round initiative must match its exact round-wrap command.'
        })
    })
  )
