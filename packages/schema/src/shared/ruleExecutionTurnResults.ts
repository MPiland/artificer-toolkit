import { reviveTraceMatches } from './characterDeathSaves.js'
import { z, lazySchema } from '../zod.js'

import {
  MAX_ACTIVE_RULE_EFFECTS_PER_OWNER,
  MAX_MAINTENANCE_CLEANUP_CHARACTER_TRANSITIONS,
  MAX_MAINTENANCE_CLEANUP_REMOVED_EFFECTS,
  MAX_MAINTENANCE_CLEANUP_TERMINATED_STATES
} from './activeRuleEffects.js'
import {
  characterMechanicsTargetStateDtoSchema,
  ENDED_EFFECT_RELEASE_OPERATION_KEY,
  isEndedEffectRelease
} from './ruleExecutionMechanics.js'
import { serverRuleExecutionApplicationOutputsDtoSchema } from './ruleExecutionApplicationOutputs.js'
import {
  ruleExecutionAggregateVersionSchema as aggregateVersionSchema,
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionPositiveIntegerSchema as positiveIntegerSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'
import {
  encounterInitiativeAdvancePlanDtoSchema,
  encounterInitiativeSettlementDtoSchema
} from './ruleExecutionInitiative.js'
import {
  MAX_ENCOUNTER_TURN_RECHARGE_CANDIDATES,
  turnActionEconomyRefreshDtoSchema,
  turnLegendaryActionEvidenceDtoSchema,
  turnDeathSaveExecutionDtoSchema,
  turnLegendaryActionRefreshDtoSchema,
  turnRechargeExecutionDtoSchema
} from './ruleExecutionTurnResources.js'
import {
  turnEffectCharacterTransitionDtoSchema,
  turnEffectEncounterActorTransitionDtoSchema,
  turnEffectExecutionDtoSchema
} from './ruleExecutionEffectEvidence.js'
import {
  refineTurnZoneEffectsEvidence,
  turnZoneEffectsEvidenceFields
} from './ruleExecutionTurnPhaseEvidence.js'
import { serverUuidIdentityDtoSchema } from './serverUuidIdentity.js'
import { MAX_ENCOUNTER_ACTORS } from './authoredLimits.js'
import { installedReceiptBindings } from '../systems/installedSystemSchemas.js'

const MAX_ENCOUNTER_TURN_ACTIVE_EFFECT_EXECUTIONS = MAX_ACTIVE_RULE_EFFECTS_PER_OWNER * 2

// A timed effect's counted turn, in an installed System's duration operation.
const isDurationOperationKey = (operationKey: string) =>
  installedReceiptBindings.some(({ durationOperationKey }) => durationOperationKey === operationKey)
export const maintenanceCompleteRuleExecutionResultDtoSchema = lazySchema(() =>
  z
    .strictObject({
      /** Aggregate-integrity cleanup performed while removing an Encounter actor. */
      status: z.literal('MAINTENANCE_COMPLETE'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      occurrenceVersion: aggregateVersionSchema,
      encounterId: uuidSchema,
      removedActorId: uuidSchema,
      reason: z.literal('ACTOR_REMOVED'),
      terminatedStates: z
        .array(
          z.strictObject({
            id: uuidSchema,
            ownerActorId: uuidSchema,
            maintenanceDefinitionId: uuidSchema,
            expectedVersion: aggregateVersionSchema,
            descriptorChecksum: checksumSchema
          })
        )
        .check(z.maxLength(MAX_MAINTENANCE_CLEANUP_TERMINATED_STATES)),
      removedEffects: z
        .array(
          z.strictObject({
            kind: z.enum(['CHARACTER', 'ENCOUNTER_ACTOR']),
            ownerId: uuidSchema,
            activeEffectId: uuidSchema,
            createdOrdinal: positiveIntegerSchema,
            expectedVersion: aggregateVersionSchema,
            definitionChecksum: checksumSchema,
            lifecycleChecksum: checksumSchema
          })
        )
        .check(z.maxLength(MAX_MAINTENANCE_CLEANUP_REMOVED_EFFECTS)),
      characterOwnerTransitions: z
        .array(
          z.strictObject({
            characterId: uuidSchema,
            beforeStreamVersion: aggregateVersionSchema,
            afterStreamVersion: aggregateVersionSchema
          })
        )
        .check(z.maxLength(MAX_MAINTENANCE_CLEANUP_CHARACTER_TRANSITIONS))
    })
    .check(
      z.superRefine((value, context) => {
        const check = (entries: readonly string[], path: string) => {
          for (let index = 1; index < entries.length; index += 1)
            if (entries[index - 1]! >= entries[index]!)
              context.addIssue({
                code: 'custom',
                path: [path, index],
                message: 'Maintenance cleanup entries must use canonical order.'
              })
        }
        check(
          value.terminatedStates.map((entry) => `${entry.ownerActorId}:${entry.id}`),
          'terminatedStates'
        )
        check(
          value.removedEffects.map(
            (entry) =>
              `${entry.kind}:${entry.ownerId}:${entry.createdOrdinal.toString().padStart(10, '0')}:${entry.activeEffectId}`
          ),
          'removedEffects'
        )
        check(
          value.characterOwnerTransitions.map((entry) => entry.characterId),
          'characterOwnerTransitions'
        )
        if (
          new Set(value.removedEffects.map((entry) => entry.activeEffectId)).size !==
          value.removedEffects.length
        )
          context.addIssue({
            code: 'custom',
            path: ['removedEffects'],
            message: 'Maintenance cleanup effects must be unique.'
          })
        if (
          value.characterOwnerTransitions.some(
            (entry) => entry.afterStreamVersion !== entry.beforeStreamVersion + 1
          )
        )
          context.addIssue({
            code: 'custom',
            path: ['characterOwnerTransitions'],
            message: 'Maintenance cleanup Character transitions must advance once.'
          })
      })
    )
)

export const encounterTurnActiveEffectsBatchRuleExecutionResultDtoSchema = lazySchema(() =>
  z
    .strictObject({
      status: z.literal('BATCH_COMPLETE'),
      batchKind: z.literal('ENCOUNTER_TURN_ACTIVE_EFFECTS'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      occurrenceVersion: aggregateVersionSchema,
      encounterId: uuidSchema,
      commandType: z.enum(['START', 'ADVANCE_TURN']),
      legendaryActions: z.optional(
        z.array(turnLegendaryActionEvidenceDtoSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS))
      ),
      legendaryActionRefreshes: z.optional(
        z.array(turnLegendaryActionRefreshDtoSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS))
      ),
      actionEconomyRefreshes: z.optional(
        z.array(turnActionEconomyRefreshDtoSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS))
      ),
      initiative: z._default(z.nullable(encounterInitiativeSettlementDtoSchema), null),
      initiativeAdvance: z._default(z.nullable(encounterInitiativeAdvancePlanDtoSchema), null),
      rechargeExecutions: z._default(
        z
          .array(turnRechargeExecutionDtoSchema)
          .check(z.maxLength(MAX_ENCOUNTER_TURN_RECHARGE_CANDIDATES)),
        []
      ),
      deathSaveExecutions: z._default(
        z.array(turnDeathSaveExecutionDtoSchema).check(z.maxLength(1)),
        []
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
      executions: z
        .array(turnEffectExecutionDtoSchema)
        .check(z.minLength(1))
        .check(z.maxLength(MAX_ENCOUNTER_TURN_ACTIVE_EFFECT_EXECUTIONS)),
      // A source's turn start can run effects on every creature it holds (SPELLS-33.T6n2).
      characterTransitions: z
        .array(turnEffectCharacterTransitionDtoSchema)
        .check(z.minLength(0))
        .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
      encounterActorTransitions: z
        .array(turnEffectEncounterActorTransitionDtoSchema)
        .check(z.minLength(0))
        .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
      ...turnZoneEffectsEvidenceFields()
    })
    .check(
      z.superRefine((batch, context) => {
        refineTurnZoneEffectsEvidence(batch, context)
        const terminatedStateIds = new Set<string>()
        let priorTerminatedState = ''
        for (const [index, state] of (batch.terminatedMaintainedStates ?? []).entries()) {
          const tuple = `${state.ownerActorId}:${state.id}`
          if (terminatedStateIds.has(state.id) || tuple <= priorTerminatedState)
            context.addIssue({
              code: 'custom',
              path: ['terminatedMaintainedStates', index],
              message: 'Terminated maintained states must be unique and use canonical owner order.'
            })
          terminatedStateIds.add(state.id)
          priorTerminatedState = tuple
        }
        const transitions = new Map<
          string,
          {
            targetActorId: string
            before: z.infer<typeof characterMechanicsTargetStateDtoSchema>
            after: z.infer<typeof characterMechanicsTargetStateDtoSchema>
          }
        >()
        const transitionActorIds = new Set<string>()
        let priorCharacterId = ''
        for (const [index, transition] of batch.characterTransitions.entries()) {
          if (
            transition.afterStreamVersion !== transition.beforeStreamVersion + 1 ||
            transitions.has(transition.characterId) ||
            transitionActorIds.has(transition.targetActorId)
          )
            context.addIssue({
              code: 'custom',
              path: ['characterTransitions', index],
              message: 'Turn-effect Character transitions must be unique and advance exactly once.'
            })
          if (transition.characterId <= priorCharacterId)
            context.addIssue({
              code: 'custom',
              path: ['characterTransitions', index, 'characterId'],
              message: 'Turn-effect Character transitions must use canonical Character UUID order.'
            })
          priorCharacterId = transition.characterId
          transitions.set(`CHARACTER:${transition.characterId}`, transition)
          transitionActorIds.add(transition.targetActorId)
        }
        let priorEncounterActorId = ''
        for (const [index, transition] of batch.encounterActorTransitions.entries()) {
          if (transitionActorIds.has(transition.targetActorId))
            context.addIssue({
              code: 'custom',
              path: ['encounterActorTransitions', index],
              message: 'Turn-effect target actors must be unique across owner transitions.'
            })
          if (transition.targetActorId <= priorEncounterActorId)
            context.addIssue({
              code: 'custom',
              path: ['encounterActorTransitions', index, 'targetActorId'],
              message:
                'Turn-effect Encounter actor transitions must use canonical actor UUID order.'
            })
          priorEncounterActorId = transition.targetActorId
          transitions.set(`ENCOUNTER_ACTOR:${transition.targetActorId}`, transition)
          transitionActorIds.add(transition.targetActorId)
        }
        if (transitions.size === 0)
          context.addIssue({
            code: 'custom',
            path: ['characterTransitions'],
            message: 'Turn-effect batches must retain at least one owner transition.'
          })
        const effectIds = new Set<string>()
        const current = new Map<
          string,
          (typeof batch.executions)[number]['targetTransition']['after']
        >()
        let boundary = -1
        let createdOrdinal = -1
        let effectId = ''
        for (const [index, execution] of batch.executions.entries()) {
          if (execution.ordinal !== index || effectIds.has(execution.activeEffectId))
            context.addIssue({
              code: 'custom',
              path: ['executions', index],
              message: 'Turn-effect execution identity or ordinal is invalid.'
            })
          effectIds.add(execution.activeEffectId)
          if (
            execution.boundaryOrdinal < boundary ||
            (execution.boundaryOrdinal === boundary &&
              (execution.createdOrdinal < createdOrdinal ||
                (execution.createdOrdinal === createdOrdinal &&
                  execution.activeEffectId <= effectId)))
          )
            context.addIssue({
              code: 'custom',
              path: ['executions', index],
              message: 'Turn-effect execution order is invalid.'
            })
          boundary = execution.boundaryOrdinal
          createdOrdinal = execution.createdOrdinal
          effectId = execution.activeEffectId
          const ownerKey =
            execution.owner.kind === 'CHARACTER'
              ? `CHARACTER:${execution.owner.characterId}`
              : `ENCOUNTER_ACTOR:${execution.targetActorId}`
          const transition = transitions.get(ownerKey)
          const before = current.get(ownerKey) ?? transition?.before
          if (
            !transition ||
            transition.targetActorId !== execution.targetActorId ||
            JSON.stringify(before) !== JSON.stringify(execution.targetTransition.before)
          )
            context.addIssue({
              code: 'custom',
              path: ['executions', index, 'targetTransition'],
              message: 'Turn-effect Character target transitions must chain.'
            })
          current.set(ownerKey, execution.targetTransition.after)
          const updateLifecycleIsValid =
            execution.lifecycle.kind !== 'UPDATE' ||
            (execution.lifecycle.beforeRemainingTicks === null
              ? execution.lifecycle.afterRemainingTicks === null
              : execution.lifecycle.beforeRemainingTicks >= 2 &&
                execution.lifecycle.afterRemainingTicks ===
                  execution.lifecycle.beforeRemainingTicks - 1)
          const expireLifecycleIsValid =
            execution.lifecycle.kind !== 'EXPIRE' ||
            (execution.lifecycle.beforeRemainingTicks === null
              ? execution.lifecycle.afterRemainingTicks === null
              : execution.lifecycle.beforeRemainingTicks >= 1 &&
                execution.lifecycle.afterRemainingTicks === 0)
          if (
            execution.beforeVersion < 1 ||
            execution.lifecycle.expectedVersion !== execution.beforeVersion ||
            (execution.lifecycle.kind === 'UPDATE' &&
              execution.lifecycle.afterVersion !== execution.beforeVersion + 1) ||
            !updateLifecycleIsValid ||
            !expireLifecycleIsValid
          )
            context.addIssue({
              code: 'custom',
              path: ['executions', index, 'lifecycle'],
              message: 'Turn-effect lifecycle versions or ticks are invalid.'
            })
          if (
            execution.execution.evidence.source.definitionId !==
              execution.definition.authoredEffectId ||
            execution.execution.evidence.source.checksum !==
              execution.definition.frozenSourceChecksum ||
            execution.execution.evidence.capabilityContractVersion !==
              execution.definition.capabilityContractVersion
          )
            context.addIssue({
              code: 'custom',
              path: ['executions', index, 'execution', 'evidence'],
              message:
                'Turn-effect execution evidence does not match its frozen definition identity.'
            })
          const bindings =
            execution.execution.evidence.sourceEntryBindings?.filter(
              (binding) =>
                binding.sourceEntryId === execution.definition.compiledEntryId &&
                binding.nodeId === execution.definition.frozenGraphNodeId
            ) ?? []
          const sourceTraces = execution.execution.evidence.trace.filter(
            (trace) => trace.nodeId === execution.definition.frozenGraphNodeId
          )
          if (bindings.length !== 1 || sourceTraces.length !== 1)
            context.addIssue({
              code: 'custom',
              path: ['executions', index, 'definition'],
              message: 'Turn-effect source-entry evidence binding is invalid.'
            })
          const d20RequestTraces = execution.execution.evidence.trace.filter(
            (trace) =>
              (trace.operation.key === 'evidence.integer-range' ||
                trace.operation.key === 'evidence.optional-integer-range') &&
              trace.operation.contractVersion === 1 &&
              trace.inputs.min === 1 &&
              trace.inputs.max === 20 &&
              trace.evidence?.kind === 'INTEGER_RANGE'
          )
          const d20ResultTraces = execution.execution.evidence.trace.filter(
            (trace) =>
              typeof trace.inputs.naturalD20 === 'number' &&
              typeof trace.inputs.modifier === 'number' &&
              typeof trace.inputs.threshold === 'number' &&
              typeof trace.inputs.contributorChecksum === 'string' &&
              typeof trace.outputs.contributorChecksum === 'string' &&
              typeof trace.outputs.total === 'number' &&
              typeof trace.outputs.resultPath === 'string'
          )
          const hasD20Trace = d20RequestTraces.length > 0 || d20ResultTraces.length > 0
          // The recurring save is its d20, the d20's added dice (D156) and the save test, then either
          // the GM rulings its failure proposes, which change nothing in the holder so no application
          // binds them, or the damage its failure rolls: dice that propose nothing and one bound
          // proposal, whose applications bind like any other.
          const [repeatRequest, repeatAddedDice, repeatResult, ...repeatFailureTraces] =
            execution.execution.evidence.trace
          const repeatSave = installedReceiptBindings.find(
            (binding) => binding.repeatSave.testOperationKey === repeatResult?.operation.key
          )?.repeatSave
          const repeatRulings = repeatFailureTraces.filter(
            (trace) => trace.operation.key === repeatSave?.rulingOperationKey
          )
          const repeatProposals = repeatFailureTraces.filter(
            (trace) => !repeatRulings.includes(trace) && trace.outputs.applicationCandidate === true
          )
          const repeatSaveShape =
            repeatSave !== undefined &&
            execution.execution.evidence.trace.length >= 3 &&
            repeatRulings.every(
              (trace) =>
                /^manual_adjudication-\d+$/.test(trace.nodeId) &&
                trace.outputs.changesTargetState === false
            ) &&
            repeatProposals.every((trace) =>
              execution.execution.evidence.sourceEntryBindings?.some(
                (binding) => binding.nodeId === trace.nodeId
              )
            ) &&
            execution.execution.evidence.sourceEntryBindings?.length ===
              1 + repeatRulings.length + repeatProposals.length &&
            bindings.length === 1 &&
            repeatRequest?.nodeId === 'repeat-save-d20' &&
            repeatRequest.operation.contractVersion === 1 &&
            repeatAddedDice?.nodeId === 'repeat-save-d20-added-dice' &&
            repeatAddedDice.operation.key === 'evidence.added-dice-total' &&
            repeatResult?.nodeId === execution.definition.frozenGraphNodeId &&
            repeatResult.operation.contractVersion === repeatSave.testContractVersion &&
            repeatResult.inputs.targetActorId === execution.targetActorId
          // A perception-gated repeat save whose gate refused this turn's attempt: its d20 settled
          // without a request, so the turn rolls nothing and its save result is not applied.
          const refusedRepeatSave =
            repeatSaveShape &&
            execution.d20 === null &&
            repeatRequest.operation.key === 'evidence.optional-integer-range' &&
            repeatRequest.inputs.enabled === false &&
            repeatRequest.evidence === undefined &&
            execution.execution.evidence.facts[repeatSave.attemptAllowedFactKey] === false
          const unchanged =
            JSON.stringify(execution.targetTransition.before) ===
            JSON.stringify(execution.targetTransition.after)
          // A condition the repeat save applies, bound to the effect's save test on `path`.
          const repeatSaveApplies = (
            application: (typeof execution.applications)[number] | undefined,
            path: string | null
          ) =>
            application?.kind === 'CONDITION_APPLY' &&
            application.sourceNodeId === execution.definition.frozenGraphNodeId &&
            application.sourceOperationKey === repeatSave?.testOperationKey &&
            application.authoredPath === path &&
            application.resolvedPath === path
          // A repeat save that ends its effect removes the conditions the effect owns, each once and
          // bound to the effect and the save test on `path`. A failed save, or the effect's last
          // counted turn, may then leave one condition in their place. Damage its failure dealt first
          // binds to its proposal.
          const repeatSaveEndsEffect = (path: string | null) => {
            const ending = execution.applications.filter(
              (application) => application.sourceNodeId === execution.definition.frozenGraphNodeId
            )
            const escalates =
              (path === 'ON_SAVE_FAIL' ||
                (execution.lifecycle.kind === 'EXPIRE' &&
                  execution.lifecycle.beforeRemainingTicks === 1)) &&
              repeatSaveApplies(ending.at(-1), path)
            const removals = escalates ? ending.slice(0, -1) : ending
            const ownedConditionIds = removals.flatMap((removal) =>
              removal.kind === 'CONDITION_REMOVE' &&
              removal.sourceActiveEffectId === execution.activeEffectId &&
              removal.sourceNodeId === execution.definition.frozenGraphNodeId &&
              removal.sourceOperationKey === repeatSave?.testOperationKey &&
              removal.authoredPath === path &&
              removal.resolvedPath === path
                ? [removal.conditionId]
                : []
            )
            return (
              removals.length > 0 &&
              ownedConditionIds.length === removals.length &&
              new Set(ownedConditionIds).size === ownedConditionIds.length
            )
          }
          // A refused attempt on the last counted turn ends the condition with its duration.
          const refusedRepeatSaveTerminal =
            refusedRepeatSave &&
            repeatSaveEndsEffect(null) &&
            execution.lifecycle.kind === 'EXPIRE' &&
            execution.lifecycle.beforeRemainingTicks === 1
          const refusedRepeatSaveContinuation =
            refusedRepeatSave &&
            execution.applications.length === 0 &&
            execution.lifecycle.kind === 'UPDATE' &&
            unchanged
          if (
            (execution.d20 === null && hasD20Trace && !refusedRepeatSave) ||
            (execution.d20 !== null &&
              (d20RequestTraces.length !== 1 || d20ResultTraces.length !== 1))
          )
            context.addIssue({
              code: 'custom',
              path: ['executions', index, 'd20'],
              message: 'Turn-effect d20 receipt presence does not match its completed trace.'
            })
          const hasBoundD20Trace =
            execution.d20 !== null && d20RequestTraces.length === 1 && d20ResultTraces.length === 1
          // The System's two-node recurring save removes its owned condition directly;
          // the live executor separately binds that condition to the frozen effect definition.
          const repeatedSaveTrace =
            hasBoundD20Trace &&
            repeatSaveShape &&
            repeatRequest === d20RequestTraces[0] &&
            (repeatRequest.operation.key === 'evidence.integer-range' ||
              (repeatRequest.operation.key === 'evidence.optional-integer-range' &&
                repeatRequest.inputs.enabled === true &&
                execution.execution.evidence.facts[repeatSave.attemptAllowedFactKey] === true)) &&
            execution.d20?.requestId === `${batch.occurrenceId}:0:repeat-save-d20` &&
            repeatResult === d20ResultTraces[0] &&
            repeatResult.inputs.outcomeRule ===
              execution.execution.evidence.facts[repeatSave.outcomeRuleFactKey] &&
            repeatResult.outputs.targetActorId === execution.targetActorId &&
            repeatResult.outputs.naturalD20 === execution.d20.selectedNatural &&
            execution.execution.evidence.facts[repeatSave.saveModifierFactKey] ===
              execution.d20.modifier &&
            execution.execution.evidence.facts[repeatSave.contributorChecksumFactKey] ===
              execution.d20.contributorChecksum &&
            // A condition that fails the save unrolled (D94) fails it whatever the total.
            execution.d20.resultPath ===
              (repeatResult.inputs.outcomeRule !== 'SAVE_AUTO_FAIL' &&
              execution.d20.total >= execution.d20.defenseOrDc
                ? 'ON_SAVE_SUCCESS'
                : 'ON_SAVE_FAIL')
          const repeatedSaveTerminal =
            repeatedSaveTrace &&
            repeatSaveEndsEffect(execution.d20?.resultPath ?? null) &&
            execution.lifecycle.kind === 'EXPIRE' &&
            (execution.d20?.resultPath === 'ON_SAVE_SUCCESS' ||
              execution.lifecycle.beforeRemainingTicks === 1)
          const repeatedSaveContinuation =
            repeatedSaveTrace &&
            execution.applications.length === 0 &&
            execution.d20?.resultPath === 'ON_SAVE_FAIL' &&
            execution.lifecycle.kind === 'UPDATE' &&
            unchanged
          // A failure that settles the save's tally may add one condition, bound to the save test,
          // while the effect goes on (a held escalation the effect owns from its cast).
          const repeatedSaveHeldEscalation =
            repeatedSaveTrace &&
            execution.applications.length === 1 &&
            execution.lifecycle.kind === 'UPDATE' &&
            execution.d20?.resultPath === 'ON_SAVE_FAIL' &&
            repeatSaveApplies(execution.applications[0], 'ON_SAVE_FAIL')
          // A grant that passes its repeating save ends itself: nothing is removed from the target.
          const repeatedSaveGrantEnd =
            repeatedSaveTrace &&
            execution.applications.length === 0 &&
            execution.d20?.resultPath === 'ON_SAVE_SUCCESS' &&
            execution.lifecycle.kind === 'EXPIRE' &&
            unchanged
          // A turn-end roll (D178) names no saving throw ability and holds nothing itself: either
          // result leaves the holder unchanged, and the effect lasts out its duration.
          const turnEndRoll =
            repeatedSaveTrace &&
            execution.execution.evidence.facts[repeatSave.saveAbilityDefinitionFactKey] ===
              undefined &&
            execution.applications.length === 0 &&
            unchanged &&
            (execution.lifecycle.kind === 'UPDATE' ||
              execution.lifecycle.beforeRemainingTicks === 1)
          // A timed condition's or grant's counted turn only moves its tick count.
          const durationTick =
            execution.applications.length === 0 &&
            sourceTraces.length === 1 &&
            isDurationOperationKey(sourceTraces[0]!.operation.key) &&
            unchanged
          const unauthorizedSourceOutcome =
            execution.applications.length === 0 &&
            execution.execution.evidence.trace.filter(
              (trace) =>
                trace.nodeId === execution.definition.frozenGraphNodeId &&
                trace.outputs.applicationCandidate === true &&
                trace.outputs.authorized === false &&
                trace.outputs.targetActorId === execution.targetActorId &&
                trace.outputs.targetStateChecksum === execution.targetTransition.checksum &&
                ((trace.outputs.conditionId !== undefined &&
                  serverUuidIdentityDtoSchema.safeParse(trace.outputs.conditionId).success &&
                  serverUuidIdentityDtoSchema.parse(trace.outputs.conditionId) ===
                    trace.outputs.conditionId) ||
                  hasBoundD20Trace)
            ).length === 1 &&
            !execution.execution.evidence.trace.some(
              (trace) =>
                trace.outputs.applicationCandidate === true && trace.outputs.authorized === true
            )
          if (
            (!unauthorizedSourceOutcome &&
              !repeatedSaveContinuation &&
              !repeatedSaveGrantEnd &&
              !refusedRepeatSaveContinuation &&
              !turnEndRoll &&
              !durationTick &&
              execution.applications.length === 0) ||
            (refusedRepeatSave && !refusedRepeatSaveContinuation && !refusedRepeatSaveTerminal) ||
            JSON.stringify(execution.execution.outputs) !==
              JSON.stringify(execution.execution.evidence.outputs)
          )
            context.addIssue({
              code: 'custom',
              path: ['executions', index, 'execution'],
              message: 'Turn-effect execution outputs or applications are invalid.'
            })
          const changed = !unchanged
          const applicationValidation = serverRuleExecutionApplicationOutputsDtoSchema.safeParse(
            execution.owner.kind === 'CHARACTER'
              ? {
                  kind: 'CHARACTER_MECHANICS_BATCH',
                  schemaVersion: 1,
                  occurrenceId: batch.occurrenceId,
                  sourceActorId: execution.targetActorId,
                  sourceCharacterId: execution.owner.characterId,
                  targetActorId: execution.targetActorId,
                  sourceCharacterStreamVersion: null,
                  targetCharacterStreamVersion: changed ? 1 : null,
                  resourceConsumption: null,
                  actionEconomyTransition: null,
                  activeEffectTransitions: [],
                  d20: execution.d20,
                  targetTransition: execution.targetTransition,
                  applications: execution.applications,
                  sourceApplications: []
                }
              : {
                  kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH',
                  schemaVersion: 1,
                  occurrenceId: batch.occurrenceId,
                  sourceActorId: execution.targetActorId,
                  targetActorId: execution.targetActorId,
                  sourceCharacterStreamVersion: null,
                  resourceConsumption: null,
                  featureResourceConsumption: null,
                  targetFeatureResourceConsumption: null,
                  actionEconomyTransition: null,
                  d20: execution.d20,
                  targetTransition: execution.targetTransition,
                  applications: execution.applications,
                  sourceApplications: []
                }
          )
          if (
            !unauthorizedSourceOutcome &&
            !repeatedSaveContinuation &&
            !refusedRepeatSaveContinuation &&
            !turnEndRoll &&
            !durationTick &&
            !applicationValidation.success
          )
            context.addIssue({
              code: 'custom',
              path: ['executions', index, 'applications'],
              message: 'Turn-effect applications are not a valid canonical owner application chain.'
            })
          if (execution.d20) {
            const d20 = execution.d20
            const requestTraces = d20RequestTraces.filter(
              (trace) =>
                trace.evidence?.requestId === d20.requestId &&
                trace.evidence?.value === d20.selectedNatural
            )
            const resultTraces = d20ResultTraces.filter(
              (trace) =>
                trace.outputs.targetActorId === execution.targetActorId &&
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
              execution.execution.outputs.targetActorId !== execution.targetActorId ||
              execution.execution.outputs.naturalD20 !== d20.selectedNatural ||
              execution.execution.outputs.total !== d20.total ||
              execution.execution.outputs.resultPath !== d20.resultPath ||
              execution.execution.outputs.contributorChecksum !== d20.contributorChecksum ||
              execution.execution.evidence.outputs.targetActorId !== execution.targetActorId ||
              execution.execution.evidence.outputs.naturalD20 !== d20.selectedNatural ||
              execution.execution.evidence.outputs.total !== d20.total ||
              execution.execution.evidence.outputs.resultPath !== d20.resultPath ||
              execution.execution.evidence.outputs.contributorChecksum !== d20.contributorChecksum
            )
              context.addIssue({
                code: 'custom',
                path: ['executions', index, 'd20'],
                message: 'Turn-effect d20 evidence does not match its completed trace.'
              })
            if (
              unauthorizedSourceOutcome &&
              sourceTraces[0]!.outputs.resolvedPath !== d20.resultPath
            )
              context.addIssue({
                code: 'custom',
                path: ['executions', index, 'd20'],
                message: 'Unauthorized turn-effect outcome does not match its d20 result path.'
              })
          }
          const authorizedCandidates = execution.execution.evidence.trace
            .map((trace, traceIndex) => ({ trace, traceIndex }))
            .filter(
              ({ trace }) =>
                trace.outputs.applicationCandidate === true &&
                trace.outputs.authorized === true &&
                !(repeatSaveShape && repeatRulings.includes(trace))
            )
          if (
            authorizedCandidates.some(
              ({ trace }) =>
                trace.outputs.targetStateChecksum !== execution.targetTransition.checksum
            )
          )
            context.addIssue({
              code: 'custom',
              path: ['executions', index, 'applications'],
              message: 'Turn-effect application candidate checksum is invalid.'
            })
          const candidates = authorizedCandidates.filter(
            ({ trace }) => trace.outputs.targetStateChecksum === execution.targetTransition.checksum
          )
          const boundTraceIndexes = new Set<number>()
          let priorTraceIndex = -1
          for (const application of execution.applications) {
            if (
              (repeatedSaveTerminal || refusedRepeatSaveTerminal || repeatedSaveHeldEscalation) &&
              application.sourceNodeId === execution.definition.frozenGraphNodeId
            )
              continue
            if (application.sourceOperationKey === ENDED_EFFECT_RELEASE_OPERATION_KEY) {
              // What an effect that ended released from its holder follows from the effect's end, not
              // from a trace of this execution (SPELLS-27.T4b, D156).
              if (!isEndedEffectRelease(application))
                context.addIssue({
                  code: 'custom',
                  path: ['executions', index, 'applications'],
                  message: 'Turn-effect application trace binding is invalid.'
                })
              continue
            }
            if (isDurationOperationKey(application.sourceOperationKey)) {
              // A timed condition's last counted turn removes the conditions its effect owns (D62.2):
              // the removal follows from the expiry, not from a trace candidate.
              if (
                application.kind !== 'CONDITION_REMOVE' ||
                application.sourceActiveEffectId !== execution.activeEffectId ||
                application.sourceNodeId !== execution.definition.frozenGraphNodeId ||
                application.authoredPath !== null ||
                application.resolvedPath !== null ||
                execution.lifecycle.kind !== 'EXPIRE' ||
                sourceTraces[0]?.operation.key !== application.sourceOperationKey
              )
                context.addIssue({
                  code: 'custom',
                  path: ['executions', index, 'applications'],
                  message: 'Turn-effect application trace binding is invalid.'
                })
              continue
            }
            if (
              application.sourceNodeId !== execution.definition.frozenGraphNodeId &&
              !execution.execution.evidence.sourceEntryBindings?.some(
                (binding) => binding.nodeId === application.sourceNodeId
              )
            )
              context.addIssue({
                code: 'custom',
                path: ['executions', index, 'applications'],
                message: 'Turn-effect application source node is invalid.'
              })
            const matches = candidates.filter(
              ({ trace }) =>
                trace.nodeId === application.sourceNodeId &&
                trace.operation.key === application.sourceOperationKey &&
                trace.outputs.targetActorId === execution.targetActorId &&
                (trace.outputs.authoredPath ?? null) === application.authoredPath &&
                (trace.outputs.resolvedPath ?? null) === application.resolvedPath &&
                (application.kind === 'TEMPORARY_HIT_POINTS_RELEASE'
                  ? false
                  : application.kind === 'CONDITION_APPLY' ||
                      application.kind === 'CONDITION_REMOVE'
                    ? trace.outputs.conditionId === application.conditionId
                    : application.kind === 'REVIVE'
                      ? reviveTraceMatches(trace.outputs, application.hitPoints)
                      : application.kind === 'STABILIZE' ||
                          application.kind === 'KILL' ||
                          application.kind === 'HIT_POINTS_TO_ZERO' ||
                          application.kind === 'KILL_NEGATED' ||
                          application.kind === 'DEPART'
                        ? true
                        : application.kind === 'SCALAR_REDUCTION'
                          ? trace.outputs.amount === application.reductionAmount
                          : trace.outputs.amount === application.requestedAmount &&
                            (application.kind !== 'DAMAGE' ||
                              trace.outputs.damageTypeId === application.damageTypeId))
            )
            if (
              matches.length !== 1 ||
              matches[0]!.traceIndex <= priorTraceIndex ||
              boundTraceIndexes.has(matches[0]!.traceIndex)
            )
              context.addIssue({
                code: 'custom',
                path: ['executions', index, 'applications'],
                message: 'Turn-effect application trace binding is invalid.'
              })
            else {
              priorTraceIndex = matches[0]!.traceIndex
              boundTraceIndexes.add(matches[0]!.traceIndex)
            }
          }
          if (
            !unauthorizedSourceOutcome &&
            (authorizedCandidates.length !== boundTraceIndexes.size ||
              authorizedCandidates.some(({ traceIndex }) => !boundTraceIndexes.has(traceIndex)))
          )
            context.addIssue({
              code: 'custom',
              path: ['executions', index, 'applications'],
              message: 'Turn-effect application candidate coverage is invalid.'
            })
        }
        if (
          batch.commandType === 'START' &&
          batch.executions.some(
            (execution) => execution.boundaryOrdinal !== 0 || execution.stage !== 'START_OF_TURN'
          )
        )
          context.addIssue({
            code: 'custom',
            path: ['executions'],
            message: 'START turn effects must be START_OF_TURN at boundary zero.'
          })
        if (
          batch.commandType === 'ADVANCE_TURN' &&
          batch.executions.some(
            (execution) =>
              (execution.boundaryOrdinal === 0 && execution.stage !== 'END_OF_TURN') ||
              (execution.boundaryOrdinal === 1 && execution.stage !== 'START_OF_TURN')
          )
        )
          context.addIssue({
            code: 'custom',
            path: ['executions'],
            message: 'ADVANCE_TURN turn-effect stages are invalid.'
          })
        for (const [ownerKey, transition] of transitions)
          if (JSON.stringify(current.get(ownerKey)) !== JSON.stringify(transition.after))
            context.addIssue({
              code: 'custom',
              path: ['characterTransitions'],
              message: 'Turn-effect target transition final state is invalid.'
            })
      })
    )
)
