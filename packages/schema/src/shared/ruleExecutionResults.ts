import { z } from '../zod.js'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'

import {
  aggregateChoiceCompleteRuleExecutionResultDtoSchema,
  completeRuleExecutionResultDtoSchema,
  encounterOccurrencePendingRuleExecutionResultDtoSchema,
  initiativeCompleteRuleExecutionResultDtoSchema,
  manualRuleExecutionResultDtoSchema,
  pausedRuleExecutionResultDtoSchema
} from './ruleExecutionResultBranches.js'
import {
  movementCompleteRuleExecutionResultDtoSchema,
  encounterSpatialMovementBatchRuleExecutionResultDtoSchema
} from './ruleExecutionSpatialResults.js'
import {
  maintenanceCompleteRuleExecutionResultDtoSchema,
  encounterTurnActiveEffectsBatchRuleExecutionResultDtoSchema
} from './ruleExecutionTurnResults.js'
import {
  ruleExecutionAggregateVersionSchema as aggregateVersionSchema,
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'
import { manualRuleExecutionReminderDtoSchema } from './ruleExecutionProtocol.js'
import {
  encounterInitiativeAdvancePlanDtoSchema,
  encounterInitiativeSettlementDtoSchema
} from './ruleExecutionInitiative.js'
import {
  MAX_ACTIVE_RULE_EFFECTS_PER_OWNER,
  MAX_MAINTENANCE_CLEANUP_TERMINATED_STATES
} from './activeRuleEffects.js'
import {
  MAX_ENCOUNTER_TURN_RECHARGE_CANDIDATES,
  turnActionEconomyRefreshDtoSchema,
  turnLegendaryActionEvidenceDtoSchema,
  turnLegendaryActionRefreshDtoSchema,
  turnRechargeExecutionDtoSchema
} from './ruleExecutionTurnResources.js'
import {
  turnEffectCharacterTransitionDtoSchema,
  turnEffectEncounterActorTransitionDtoSchema,
  turnEffectExecutionDtoSchema
} from './ruleExecutionEffectEvidence.js'

const MAX_ENCOUNTER_TURN_ACTIVE_EFFECT_EXECUTIONS = MAX_ACTIVE_RULE_EFFECTS_PER_OWNER * 2
const completedTurnLifecyclePhaseEvidenceDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('NONE'),
    selectionChecksum: z.nullable(checksumSchema)
  }),
  z.strictObject({
    kind: z.literal('MANUAL'),
    selectionChecksum: checksumSchema,
    reminder: z.nullable(manualRuleExecutionReminderDtoSchema)
  }),
  z.strictObject({
    kind: z.literal('EXECUTED'),
    selectionChecksum: checksumSchema,
    executions: z
      .array(turnEffectExecutionDtoSchema)
      .check(z.minLength(1))
      .check(z.maxLength(MAX_ENCOUNTER_TURN_ACTIVE_EFFECT_EXECUTIONS)),
    characterTransitions: z
      .array(turnEffectCharacterTransitionDtoSchema)
      .check(z.minLength(0))
      .check(z.maxLength(2)),
    encounterActorTransitions: z
      .array(turnEffectEncounterActorTransitionDtoSchema)
      .check(z.minLength(0))
      .check(z.maxLength(2))
  })
])

export const storedRuleExecutionResultDtoSchema = z
  .union([
    pausedRuleExecutionResultDtoSchema,
    encounterOccurrencePendingRuleExecutionResultDtoSchema,
    aggregateChoiceCompleteRuleExecutionResultDtoSchema,
    completeRuleExecutionResultDtoSchema,
    manualRuleExecutionResultDtoSchema,
    initiativeCompleteRuleExecutionResultDtoSchema,
    z
      .strictObject({
        /** One each-round turn transition spanning outgoing effects, initiative, and incoming effects. */
        status: z.literal('TURN_LIFECYCLE_COMPLETE'),
        schemaVersion: z.literal(1),
        occurrenceId: uuidSchema,
        occurrenceVersion: aggregateVersionSchema,
        encounterId: uuidSchema,
        commandType: z.literal('ADVANCE_TURN'),
        initiativeAdvance: encounterInitiativeAdvancePlanDtoSchema,
        initiative: z.nullable(encounterInitiativeSettlementDtoSchema),
        rechargeExecutions: z._default(
          z
            .array(turnRechargeExecutionDtoSchema)
            .check(z.maxLength(MAX_ENCOUNTER_TURN_RECHARGE_CANDIDATES)),
          []
        ),
        legendaryActions: z._default(
          z.array(turnLegendaryActionEvidenceDtoSchema).check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
          []
        ),
        legendaryActionRefreshes: z._default(
          z.array(turnLegendaryActionRefreshDtoSchema).check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
          []
        ),
        actionEconomyRefreshes: z.optional(
          z.array(turnActionEconomyRefreshDtoSchema).check(z.maxLength(RULE_GRAPH_LIMITS.NODES))
        ),
        terminatedMaintainedStates: z.optional(
          z
            .array(
              z.strictObject({
                id: uuidSchema,
                ownerActorId: uuidSchema,
                maintenanceDefinitionId: uuidSchema,
                expectedVersion: aggregateVersionSchema,
                descriptorChecksum: checksumSchema
              })
            )
            .check(z.maxLength(MAX_MAINTENANCE_CLEANUP_TERMINATED_STATES))
        ),
        outgoingTurn: completedTurnLifecyclePhaseEvidenceDtoSchema,
        incomingTurn: completedTurnLifecyclePhaseEvidenceDtoSchema
      })
      .check(
        z.superRefine((result, context) => {
          const terminatedStateIds = new Set<string>()
          let priorTerminatedState = ''
          for (const [index, state] of (result.terminatedMaintainedStates ?? []).entries()) {
            const tuple = `${state.ownerActorId}:${state.id}`
            if (terminatedStateIds.has(state.id) || tuple <= priorTerminatedState)
              context.addIssue({
                code: 'custom',
                path: ['terminatedMaintainedStates', index],
                message:
                  'Terminated maintained states must be unique and use canonical owner order.'
              })
            terminatedStateIds.add(state.id)
            priorTerminatedState = tuple
          }
          if (
            result.initiativeAdvance.kind === 'ROUND_WRAP' &&
            result.initiativeAdvance.cadence === 'EACH_ROUND'
          ) {
            if (
              !result.initiative ||
              result.initiative.round !== result.initiativeAdvance.nextRound ||
              result.initiative.cadence !== 'EACH_ROUND' ||
              checksumRuleDocument([...result.initiative.orderedActorIds].sort()) !==
                checksumRuleDocument([...result.initiativeAdvance.orderedActorIds].sort()) ||
              checksumRuleDocument([...result.initiative.orderedSideIds].sort()) !==
                checksumRuleDocument([...result.initiativeAdvance.orderedSideIds].sort())
            )
              context.addIssue({
                code: 'custom',
                path: ['initiative'],
                message: 'Turn initiative settlement must match its sealed advancement.'
              })
          } else if (result.initiative !== null) {
            context.addIssue({
              code: 'custom',
              path: ['initiative'],
              message: 'Turn initiative settlement must match its sealed advancement.'
            })
          }
          for (const [field, phase] of [
            ['outgoingTurn', result.outgoingTurn],
            ['incomingTurn', result.incomingTurn]
          ] as const) {
            if (phase.kind !== 'EXECUTED') continue
            const batch = storedRuleExecutionResultDtoSchema.safeParse({
              status: 'BATCH_COMPLETE',
              batchKind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS',
              schemaVersion: 1,
              occurrenceId: result.occurrenceId,
              occurrenceVersion: result.occurrenceVersion,
              encounterId: result.encounterId,
              commandType: result.commandType,
              initiative: null,
              initiativeAdvance: null,
              executions: phase.executions,
              characterTransitions: phase.characterTransitions,
              encounterActorTransitions: phase.encounterActorTransitions
            })
            if (!batch.success)
              context.addIssue({
                code: 'custom',
                path: [field],
                message: 'Turn phase must retain one valid terminal turn-effect batch.'
              })
          }
        })
      ),
    maintenanceCompleteRuleExecutionResultDtoSchema,
    movementCompleteRuleExecutionResultDtoSchema,
    encounterSpatialMovementBatchRuleExecutionResultDtoSchema,
    encounterTurnActiveEffectsBatchRuleExecutionResultDtoSchema
  ])
  .check(
    z.superRefine((value, context) => {
      if (
        value.status === 'COMPLETE' &&
        'applicationOutputs' in value &&
        'phaseReceipts' in value &&
        (value.applicationOutputs.kind === 'CHARACTER_MECHANICS_BATCH' ||
          value.applicationOutputs.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
      ) {
        const directBatch = value.applicationOutputs
        const outcomeReceipt = value.phaseReceipts?.[1]
        const outcomeExecution =
          outcomeReceipt?.phase === 'OUTCOME' ? outcomeReceipt.execution : null
        const nested = directBatch.nestedD20
        const requestTraces = outcomeExecution
          ? outcomeExecution.evidence.trace.filter(
              (trace) =>
                trace.operation.key === 'evidence.integer-range' &&
                trace.operation.contractVersion === 1 &&
                trace.inputs.min === 1 &&
                trace.inputs.max === 20 &&
                trace.evidence?.kind === 'INTEGER_RANGE'
            )
          : []
        const saveTraces = outcomeExecution
          ? outcomeExecution.evidence.trace.filter(
              (trace) =>
                typeof trace.inputs.naturalD20 === 'number' &&
                typeof trace.inputs.modifier === 'number' &&
                typeof trace.inputs.threshold === 'number' &&
                typeof trace.inputs.contributorChecksum === 'string' &&
                typeof trace.outputs.contributorChecksum === 'string' &&
                typeof trace.outputs.total === 'number' &&
                typeof trace.outputs.resultPath === 'string'
            )
          : []
        if (nested !== null) {
          const requestMatches = requestTraces.filter(
            (trace) =>
              trace.nodeId === nested.requestNodeId &&
              trace.evidence?.requestId === nested.requestId &&
              trace.evidence.value === nested.selectedNatural
          )
          const saveMatches = saveTraces.filter(
            (trace) =>
              trace.inputs.naturalD20 === nested.selectedNatural &&
              trace.inputs.modifier === nested.modifier &&
              trace.inputs.threshold === nested.defenseOrDc &&
              trace.inputs.contributorChecksum === nested.contributorChecksum &&
              trace.outputs.contributorChecksum === nested.contributorChecksum &&
              trace.outputs.total === nested.total &&
              trace.outputs.resultPath === nested.resultPath
          )
          if (!outcomeExecution || requestMatches.length !== 1 || saveMatches.length !== 1)
            context.addIssue({
              code: 'custom',
              path: ['applicationOutputs', 'nestedD20'],
              message: 'Nested d20 evidence must bind one exact completed OUTCOME save trace.'
            })
        }
      }
      if (
        value.status === 'COMPLETE' &&
        value.applicationOutputs.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH' &&
        value.applicationOutputs.legendaryResistance
      ) {
        const legendaryResistance = value.applicationOutputs.legendaryResistance
        const original = legendaryResistance.originalExecution
        const choice = legendaryResistance.execution
        const d20 = legendaryResistance.originalD20
        const d20RequestTraces = original.evidence.trace.filter(
          (trace) =>
            trace.operation.key === 'evidence.integer-range' &&
            trace.operation.contractVersion === 1 &&
            trace.inputs.min === 1 &&
            trace.inputs.max === 20 &&
            trace.evidence?.kind === 'INTEGER_RANGE'
        )
        const d20ResultTraces = original.evidence.trace.filter(
          (trace) =>
            typeof trace.inputs.naturalD20 === 'number' &&
            typeof trace.inputs.modifier === 'number' &&
            typeof trace.inputs.threshold === 'number' &&
            typeof trace.inputs.contributorChecksum === 'string' &&
            typeof trace.outputs.contributorChecksum === 'string' &&
            typeof trace.outputs.total === 'number' &&
            typeof trace.outputs.resultPath === 'string'
        )
        const hasExactOriginalD20Trace =
          d20RequestTraces.length === 1 &&
          d20ResultTraces.length === 1 &&
          d20RequestTraces.filter(
            (trace) =>
              trace.evidence?.requestId === d20.requestId &&
              trace.evidence.value === d20.selectedNatural
          ).length === 1 &&
          d20ResultTraces.filter(
            (trace) =>
              trace.inputs.naturalD20 === d20.selectedNatural &&
              trace.inputs.modifier === d20.modifier &&
              trace.inputs.threshold === d20.defenseOrDc &&
              trace.inputs.contributorChecksum === d20.contributorChecksum &&
              trace.outputs.contributorChecksum === d20.contributorChecksum &&
              trace.outputs.total === d20.total &&
              trace.outputs.resultPath === d20.resultPath
          ).length === 1
        if (
          checksumRuleDocument({
            outputs: value.outputs,
            evidence: value.evidence
          }) !==
            checksumRuleDocument({
              outputs: original.outputs,
              evidence: original.evidence
            }) ||
          value.applicationOutputs.d20 === null ||
          checksumRuleDocument(value.applicationOutputs.d20) !==
            checksumRuleDocument(legendaryResistance.originalD20) ||
          !hasExactOriginalD20Trace ||
          choice.evidence.source.definitionId !==
            legendaryResistance.lifecycle.choiceGraphDefinitionId ||
          choice.evidence.source.checksum !==
            legendaryResistance.lifecycle.choiceGraphDefinitionChecksum ||
          choice.outputs[legendaryResistance.lifecycle.useOutput] !== legendaryResistance.use
        )
          context.addIssue({
            code: 'custom',
            path: ['applicationOutputs', 'legendaryResistance'],
            message: 'Legendary Resistance terminal action binding is invalid.'
          })
        return
      }
      if (
        value.status !== 'COMPLETE' ||
        value.applicationOutputs.kind !== 'CHARACTER_MECHANICS_BATCH'
      )
        return
      const batch = value.applicationOutputs
      if (batch.occurrenceId !== value.occurrenceId)
        context.addIssue({
          code: 'custom',
          message: 'Receipt occurrence identity is invalid.'
        })
      const testReceipt = value.phaseReceipts?.[0]
      const outcomeReceipt = value.phaseReceipts?.[1]
      const d20Execution = testReceipt?.phase === 'TEST' ? testReceipt.execution : value
      const terminalReceipt = outcomeReceipt ?? testReceipt
      if (
        value.phaseReceipts &&
        (!testReceipt ||
          testReceipt.phase !== 'TEST' ||
          (value.phaseReceipts.length === 2 && outcomeReceipt?.phase !== 'OUTCOME') ||
          !terminalReceipt ||
          checksumRuleDocument({
            outputs: terminalReceipt.execution.outputs,
            evidence: terminalReceipt.execution.evidence
          }) !==
            checksumRuleDocument({
              outputs: value.outputs,
              evidence: value.evidence
            }))
      )
        context.addIssue({
          code: 'custom',
          path: ['phaseReceipts'],
          message: 'A phased terminal receipt must retain TEST then optional OUTCOME evidence.'
        })
      if (batch.d20) {
        const d20 = batch.d20
        const requestTraces = d20Execution.evidence.trace.filter(
          (trace) =>
            trace.operation.key === 'evidence.integer-range' &&
            trace.operation.contractVersion === 1 &&
            trace.inputs.min === 1 &&
            trace.inputs.max === 20 &&
            trace.evidence?.kind === 'INTEGER_RANGE' &&
            trace.evidence.requestId === d20.requestId &&
            trace.evidence.value === d20.selectedNatural
        )
        const resultTraces = d20Execution.evidence.trace.filter(
          (trace) =>
            trace.inputs.naturalD20 === d20.selectedNatural &&
            trace.inputs.modifier === d20.modifier &&
            trace.inputs.threshold === d20.defenseOrDc &&
            trace.inputs.contributorChecksum === d20.contributorChecksum &&
            trace.outputs.contributorChecksum === d20.contributorChecksum &&
            trace.outputs.total === d20.total &&
            trace.outputs.resultPath === d20.resultPath
        )
        if (
          requestTraces.length !== 1 ||
          resultTraces.length !== 1 ||
          d20Execution.outputs.naturalD20 !== d20.selectedNatural ||
          d20Execution.outputs.total !== d20.total ||
          d20Execution.outputs.resultPath !== d20.resultPath ||
          d20Execution.outputs.contributorChecksum !== d20.contributorChecksum ||
          d20Execution.evidence.outputs.naturalD20 !== d20.selectedNatural ||
          d20Execution.evidence.outputs.total !== d20.total ||
          d20Execution.evidence.outputs.resultPath !== d20.resultPath ||
          d20Execution.evidence.outputs.contributorChecksum !== d20.contributorChecksum
        )
          context.addIssue({
            code: 'custom',
            path: ['applicationOutputs', 'd20'],
            message: 'Character mechanics d20 evidence does not match its TEST execution.'
          })
      }
      let priorTraceIndex = -1
      const boundTraceIndexes = new Set<number>()
      for (const application of batch.applications) {
        const matches = value.evidence.trace
          .map((trace, index) => ({ trace, index }))
          .filter(({ trace }) => {
            if (
              trace.nodeId !== application.sourceNodeId ||
              trace.operation.key !== application.sourceOperationKey ||
              trace.outputs.targetActorId !== batch.targetActorId
            )
              return false
            const authoredPath = trace.outputs.authoredPath ?? null
            const resolvedPath = trace.outputs.resolvedPath ?? null
            if (
              authoredPath !== application.authoredPath ||
              resolvedPath !== application.resolvedPath
            )
              return false
            if ('authorized' in trace.outputs && trace.outputs.authorized !== true) return false
            if (application.kind === 'CONDITION_APPLY' || application.kind === 'CONDITION_REMOVE')
              return trace.outputs.conditionId === application.conditionId
            if (application.kind === 'SCALAR_REDUCTION')
              return trace.outputs.amount === application.reductionAmount
            return (
              trace.outputs.amount === application.requestedAmount &&
              (application.kind !== 'DAMAGE' ||
                trace.outputs.damageTypeId === application.damageTypeId)
            )
          })
        if (
          matches.length !== 1 ||
          matches[0]!.index <= priorTraceIndex ||
          boundTraceIndexes.has(matches[0]!.index)
        )
          context.addIssue({
            code: 'custom',
            message: 'Character mechanics application trace binding is invalid.'
          })
        else {
          priorTraceIndex = matches[0]!.index
          boundTraceIndexes.add(matches[0]!.index)
        }
      }
      const authorizedCandidates = value.evidence.trace
        .map((trace, index) => ({ trace, index }))
        .filter(
          ({ trace }) =>
            trace.outputs.applicationCandidate === true && trace.outputs.authorized === true
        )
      if (
        authorizedCandidates.length !== boundTraceIndexes.size ||
        authorizedCandidates.some(({ index }) => !boundTraceIndexes.has(index)) ||
        authorizedCandidates.some(
          ({ trace }) => trace.outputs.targetStateChecksum !== batch.targetTransition.checksum
        )
      )
        context.addIssue({
          code: 'custom',
          message: 'Character mechanics application coverage is invalid.'
        })
    })
  )

/**
 * Server-only execution plan retained when an each-round turn pauses after
 * outgoing effects have been evaluated. The plan contains completed,
 * independently replay-validated effect executions, never repositories,
 * locks, or mutable aggregate snapshots.
 */
const stagedTurnEffectPlanDtoSchema = z.strictObject({
  selectionChecksum: checksumSchema,
  executions: z
    .array(z.lazy(() => turnEffectExecutionDtoSchema))
    .check(z.minLength(1))
    .check(z.maxLength(MAX_ENCOUNTER_TURN_ACTIVE_EFFECT_EXECUTIONS))
})

/**
 * A paused turn may retain only a non-mutating outgoing phase. Terminal
 * evidence is reconstructed after its staged plan has been re-locked and
 * applied in the final transaction.
 */
export const pendingCompletedTurnPhaseDtoSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('NONE') }),
    z.strictObject({
      kind: z.literal('MANUAL'),
      selectionChecksum: checksumSchema,
      result: z.lazy(() => storedRuleExecutionResultDtoSchema)
    }),
    z.strictObject({
      kind: z.literal('STAGED'),
      plan: stagedTurnEffectPlanDtoSchema
    })
  ])
  .check(
    z.superRefine((phase, context) => {
      if (phase.kind !== 'MANUAL') return
      if (phase.result.status !== 'MANUAL')
        context.addIssue({
          code: 'custom',
          path: ['result'],
          message: 'A manual outgoing phase must retain manual terminal evidence.'
        })
    })
  )

export type StoredRuleExecutionResultDto = z.infer<typeof storedRuleExecutionResultDtoSchema>
export type StagedTurnEffectPlanDto = z.infer<typeof stagedTurnEffectPlanDtoSchema>
export type PendingCompletedTurnPhaseDto = z.infer<typeof pendingCompletedTurnPhaseDtoSchema>
