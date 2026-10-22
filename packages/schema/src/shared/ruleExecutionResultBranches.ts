import { z, lazySchema } from '../zod.js'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'

import { ruleValueDtoSchema } from '../api/rulesRuntime.js'
import { authoredIdentifierSchema, MAX_ENCOUNTER_ACTORS } from './authoredLimits.js'
import { encounterRuleOccurrenceSummaryDtoSchema } from './encounterRuleOccurrence.js'
import { serverRuleExecutionApplicationOutputsDtoSchema } from './ruleExecutionApplicationOutputs.js'
import {
  encounterInitiativeAdvancePlanDtoSchema,
  encounterInitiativeSettlementDtoSchema
} from './ruleExecutionInitiative.js'
import {
  ruleExecutionAggregateVersionSchema as aggregateVersionSchema,
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionIntegerSchema as integerSchema,
  ruleExecutionPortNameSchema as portNameSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'
import {
  ruleExecutionPhaseReceiptsDtoSchema,
  serverCompletedRuleExecutionDtoSchema,
  serverRuleIntegerRangeRequestDtoSchema
} from './ruleExecutionProtocol.js'
import { pendingSpatialCharacterTransitionsDtoSchema } from './ruleExecutionMovementReactionReceipts.js'
import {
  MAX_ENCOUNTER_TURN_RECHARGE_CANDIDATES,
  turnActionEconomyRefreshDtoSchema,
  turnLegendaryActionEvidenceDtoSchema,
  turnDeathSaveExecutionDtoSchema,
  turnLegendaryActionRefreshDtoSchema,
  turnRechargeExecutionDtoSchema
} from './ruleExecutionTurnResources.js'
import {
  refineTurnZoneEffectsEvidence,
  turnZoneEffectsEvidenceFields
} from './ruleExecutionTurnPhaseEvidence.js'
import { rollModeKeepSchema, systemVocabularyCodeSchema } from './systemVocabularyCode.js'
export const pausedRuleExecutionResultDtoSchema = lazySchema(() =>
  z.strictObject({
    status: z.literal('PAUSED'),
    occurrenceId: uuidSchema,
    occurrenceVersion: aggregateVersionSchema,
    request: serverRuleIntegerRangeRequestDtoSchema,
    /** Closed public information needed to reconstruct an authorized pending response. */
    pending: z.optional(
      z.nullable(
        z.discriminatedUnion('kind', [
          z.strictObject({
            kind: z.literal('D20_EVIDENCE'),
            rollMode: systemVocabularyCodeSchema,
            keep: rollModeKeepSchema
          }),
          z
            .strictObject({
              kind: z.literal('INTEGER_RANGE_EVIDENCE'),
              phase: z.literal('OUTCOME'),
              requests: z
                .array(
                  z.strictObject({
                    requestId: z.string().check(z.minLength(1)).check(z.maxLength(256)),
                    min: integerSchema,
                    max: integerSchema
                  })
                )
                .check(z.minLength(1))
                .check(z.maxLength(31)),
              exactRequestSetChecksum: checksumSchema
            })
            .check(
              z.superRefine((value, context) => {
                const ids = new Set<string>()
                for (const [index, request] of value.requests.entries()) {
                  if (request.min >= request.max || ids.has(request.requestId)) {
                    context.addIssue({
                      code: 'custom',
                      path: ['requests', index],
                      message: 'Outcome requests must be ordered, unique, and use a valid range.'
                    })
                  }
                  ids.add(request.requestId)
                }
                if (checksumRuleDocument(value.requests) !== value.exactRequestSetChecksum) {
                  context.addIssue({
                    code: 'custom',
                    path: ['exactRequestSetChecksum'],
                    message: 'Outcome request-set checksum is invalid.'
                  })
                }
              })
            ),
          z.strictObject({
            kind: z.literal('LEGENDARY_RESISTANCE_CHOICE'),
            targetActorId: uuidSchema,
            useOptionId: authoredIdentifierSchema
          })
        ])
      )
    )
  })
)

export const encounterOccurrencePendingRuleExecutionResultDtoSchema = lazySchema(() =>
  z.strictObject({
    /** Exact actor-filtered result for one command that leaves an Encounter occurrence pending. */
    status: z.literal('ENCOUNTER_OCCURRENCE_PENDING'),
    schemaVersion: z.literal(1),
    occurrenceId: uuidSchema,
    occurrenceVersion: aggregateVersionSchema,
    encounterId: uuidSchema,
    encounterVersion: aggregateVersionSchema,
    occurrence: encounterRuleOccurrenceSummaryDtoSchema,
    /** Exact command-scoped Character mutations committed before the next pause. */
    characterTransitions: pendingSpatialCharacterTransitionsDtoSchema
  })
)

export const aggregateChoiceCompleteRuleExecutionResultDtoSchema = lazySchema(() =>
  z.strictObject({
    /** Terminal evidence for one sealed aggregate-owned choice. */
    status: z.literal('AGGREGATE_CHOICE_COMPLETE'),
    schemaVersion: z.literal(1),
    occurrenceId: uuidSchema,
    occurrenceVersion: aggregateVersionSchema,
    applicationOutputs: serverRuleExecutionApplicationOutputsDtoSchema
  })
)

export const completeRuleExecutionResultDtoSchema = lazySchema(() =>
  z.strictObject({
    status: z.literal('COMPLETE'),
    occurrenceId: uuidSchema,
    occurrenceVersion: aggregateVersionSchema,
    outputs: z.record(portNameSchema, ruleValueDtoSchema),
    evidence: serverCompletedRuleExecutionDtoSchema.shape.evidence,
    /** Full initial bound input checksum; execution evidence retains only consumed facts. */
    initialFactsChecksum: z.optional(checksumSchema),
    /** Absent for legacy single-phase receipts; present for bounded phased actions. */
    phaseReceipts: z.optional(ruleExecutionPhaseReceiptsDtoSchema),
    applicationOutputs: z._default(serverRuleExecutionApplicationOutputsDtoSchema, {
      kind: 'NONE'
    })
  })
)

export const manualRuleExecutionResultDtoSchema = lazySchema(() =>
  z.strictObject({
    /** A recognized rule path recorded without kernel execution or state mutation. */
    status: z.literal('MANUAL'),
    occurrenceId: uuidSchema,
    occurrenceVersion: aggregateVersionSchema,
    initiative: z._default(z.nullable(encounterInitiativeSettlementDtoSchema), null),
    initiativeAdvance: z._default(z.nullable(encounterInitiativeAdvancePlanDtoSchema), null),
    actionEconomyRefreshes: z.optional(
      z.array(turnActionEconomyRefreshDtoSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS))
    )
  })
)

export const initiativeCompleteRuleExecutionResultDtoSchema = lazySchema(() =>
  z
    .strictObject({
      /** A normalized initiative lifecycle completed without an active turn-effect result. */
      status: z.literal('INITIATIVE_COMPLETE'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      occurrenceVersion: aggregateVersionSchema,
      encounterId: uuidSchema,
      commandType: z.enum(['START', 'ADVANCE_TURN']),
      initiative: z._default(z.nullable(encounterInitiativeSettlementDtoSchema), null),
      initiativeAdvance: z._default(z.nullable(encounterInitiativeAdvancePlanDtoSchema), null),
      /** Absent on older receipts; retained when turn-owned Recharge executes. */
      rechargeExecutions: z.optional(
        z
          .array(turnRechargeExecutionDtoSchema)
          .check(z.minLength(1))
          .check(z.maxLength(MAX_ENCOUNTER_TURN_RECHARGE_CANDIDATES))
      ),
      deathSaveExecutions: z.optional(
        z.array(turnDeathSaveExecutionDtoSchema).check(z.minLength(1)).check(z.maxLength(1))
      ),
      legendaryActions: z.optional(
        z.array(turnLegendaryActionEvidenceDtoSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS))
      ),
      legendaryActionRefreshes: z.optional(
        z.array(turnLegendaryActionRefreshDtoSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS))
      ),
      actionEconomyRefreshes: z.optional(
        z.array(turnActionEconomyRefreshDtoSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS))
      ),
      ...turnZoneEffectsEvidenceFields()
    })
    .check(
      z.refine((result) => result.initiative !== null || result.initiativeAdvance !== null, {
        message: 'Initiative completion requires settlement or advancement evidence.'
      })
    )
    .check(z.superRefine(refineTurnZoneEffectsEvidence))
)
