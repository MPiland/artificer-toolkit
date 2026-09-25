import type { RulesRuntimeService } from './rulesRuntimeService.js'
import type { EncounterLegendaryResistanceCandidate } from './encounterLegendaryResistanceDiscovery.js'
import {
  retainEncounterLegendaryResistanceChoice,
  legendaryResistanceUseOptionId
} from './encounterMovementReactionContinuation.js'
import type {
  ServerKernelRuleExecutionPendingSnapshotDto,
  ServerRuleExecutionContinuationDto,
  ServerRuleExecutionD20EvidenceDto,
  ServerRuleExecutionD20PolicyDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { prepareNativeActionTest } from './encounterActionExecution.js'
import type { prepareEncounterMovementReactionAction } from './encounterMovementReactionPreparation.js'
import {
  bindEncounterMovementMaintenancePending,
  requireEncounterMovementMaintenanceCurrentness
} from './encounterMovementMaintenance.js'

type PreparedMovementReaction = Pick<
  Awaited<ReturnType<typeof prepareEncounterMovementReactionAction>>,
  'option' | 'prepared' | 'executionPlan' | 'action'
> & {
  maintenance: Parameters<typeof bindEncounterMovementMaintenancePending>[1]
}
type LegendaryResistancePhase = Extract<
  Extract<
    ServerKernelRuleExecutionPendingSnapshotDto['applicationContext'],
    {
      kind: 'ENCOUNTER_MOVEMENT_REACTION'
    }
  >['phase'],
  { kind: 'LEGENDARY_RESISTANCE_CHOICE' }
>

/** Rebuilds TEST from current facts and recorded faces, without issuing another roll. */
export async function reconstructNativeMovementResistanceTest(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  prepared: PreparedMovementReaction
  execution: LegendaryResistancePhase['originalExecution']
  d20: Pick<
    ServerRuleExecutionD20EvidenceDto,
    'requestId' | 'rawFaces' | 'rollMode' | 'selectedNatural'
  >
}) {
  const source = {
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    adapter: input.prepared.prepared.adapter,
    binding: input.prepared.prepared.binding,
    plan: input.prepared.executionPlan,
    autoRoll: { SOURCE: false, TARGET: false },
    afterTest: async () => undefined,
    random: () => {
      throw new Error('Retained TEST evidence must not roll again.')
    }
  }
  const pending = await prepareNativeActionTest(source)
  if (pending.kind !== 'PENDING' || pending.continuation.request.requestId !== input.d20.requestId)
    throw new Error('The retained Legendary Resistance TEST request is stale.')
  const boundary = await prepareNativeActionTest({
    ...source,
    resume: {
      pending,
      resolution: {
        kind: 'ENTER_DICE',
        requestId: input.d20.requestId,
        rawFaces: input.d20.rawFaces,
        rollMode: input.d20.rollMode
      }
    }
  })
  if (
    boundary.kind !== 'TEST_BOUNDARY' ||
    boundary.d20.rollMode !== input.d20.rollMode ||
    boundary.d20.selectedNatural !== input.d20.selectedNatural ||
    checksumRuleDocument(boundary.execution) !== checksumRuleDocument(input.execution)
  )
    throw new Error('The retained Legendary Resistance TEST execution is stale.')
  return boundary
}

export function nativeMovementResistanceResource(
  prepared: PreparedMovementReaction,
  candidate: EncounterLegendaryResistanceCandidate
) {
  const resource = prepared.prepared.actorRules.actors
    .find((actor) => actor.actorId === candidate.targetActorId)
    ?.featureResources.find((feature) => feature.featureId === candidate.ownerFeatureId)
  if (!resource) throw new Error('The Legendary Resistance resource is unavailable.')
  return resource
}

export type NativeMovementLegendaryResistanceSelection =
  | { kind: 'DECLINE' }
  | { kind: 'OPTION'; optionId: string }

export interface NativeMovementLegendaryResistanceChargeProposal {
  ownerActorId: string
  ownerFeatureId: string
  chargeId: string
  cost: number
  beforeUsed: number
  afterUsed: number
  beforeRemaining: number
  afterRemaining: number
}

function sameCandidate(
  phase: LegendaryResistancePhase,
  candidate: EncounterLegendaryResistanceCandidate
) {
  const resistance = phase.resistance
  const {
    poolBefore: _poolBefore,
    poolRemaining: _poolRemaining,
    useOutput: _useOutput,
    useOptionId,
    selectionChecksum,
    ...selectionPin
  } = resistance
  return (
    checksumRuleDocument(selectionPin) === selectionChecksum &&
    legendaryResistanceUseOptionId({ selectionChecksum }) === useOptionId &&
    candidate.targetActorId === resistance.targetActorId &&
    candidate.ownerFeatureId === resistance.ownerFeatureId &&
    candidate.chargeId === resistance.chargeId &&
    candidate.featureCost === resistance.featureCost &&
    candidate.poolBefore === resistance.poolBefore &&
    candidate.poolRemaining === resistance.poolRemaining &&
    candidate.lifecycle.definitionId === resistance.definitionId &&
    candidate.lifecycle.definitionVersion === resistance.definitionVersion &&
    candidate.lifecycle.definitionChecksum === resistance.definitionChecksum &&
    candidate.lifecycle.choiceGraphDefinitionId === resistance.choiceGraphDefinitionId &&
    candidate.lifecycle.choiceGraphDefinitionVersion === resistance.choiceGraphDefinitionVersion &&
    candidate.lifecycle.choiceGraphDefinitionChecksum ===
      resistance.choiceGraphDefinitionChecksum &&
    candidate.lifecycle.useOutput === resistance.useOutput
  )
}

function requireFailedSave(input: {
  execution: LegendaryResistancePhase['originalExecution']
  d20: ServerRuleExecutionD20EvidenceDto
}) {
  if (
    input.execution.status !== 'COMPLETE' ||
    input.execution.outputs.resultPath !== 'ON_SAVE_FAIL' ||
    input.execution.evidence.outputs.resultPath !== 'ON_SAVE_FAIL' ||
    input.d20.resultPath !== 'ON_SAVE_FAIL'
  )
    throw new Error('Legendary Resistance requires sealed failed-save evidence.')
}

/**
 * Starts the sealed two-option choice after the native TEST has failed. The
 * enclosing movement mutation retains the returned snapshot; this function
 * does not publish action, charge, Character, Run, or Scene state.
 */
export async function retainNativeMovementLegendaryResistance(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  prepared: PreparedMovementReaction
  context: Extract<
    ServerKernelRuleExecutionPendingSnapshotDto['applicationContext'],
    { kind: 'ENCOUNTER_MOVEMENT_REACTION' }
  >
  execution: LegendaryResistancePhase['originalExecution']
  d20: ServerRuleExecutionD20EvidenceDto
  candidate: EncounterLegendaryResistanceCandidate
}): Promise<ServerKernelRuleExecutionPendingSnapshotDto> {
  requireFailedSave({ execution: input.execution, d20: input.d20 })
  if (
    input.candidate.targetActorId !== input.prepared.prepared.target.id ||
    (input.context.phase.kind !== 'CHOICE' &&
      (input.context.phase.kind !== 'ACTION_EVIDENCE' ||
        input.context.phase.selectedOptionId !== input.prepared.option.optionId))
  )
    throw new Error('Legendary Resistance action selection is stale.')
  const choice = await input.runtime.executeResolved({
    command: {
      definitionId: input.candidate.choiceGraph.id,
      occurrenceId: input.occurrenceId,
      facts: {}
    },
    published: input.candidate.choiceGraph
  })
  if (
    choice.status !== 'PAUSED' ||
    choice.continuation.request.nodeId !== 'choice' ||
    choice.continuation.request.min !== 0 ||
    choice.continuation.request.max !== 1
  )
    throw new Error('Legendary Resistance choice graph did not issue its exact bounded request.')
  return bindEncounterMovementMaintenancePending(
    retainEncounterLegendaryResistanceChoice({
      continuation: choice.continuation,
      context: input.context,
      selectedOptionId: input.prepared.option.optionId,
      execution: input.execution,
      d20: input.d20,
      candidate: input.candidate,
      targetStateChecksum: checksumRuleDocument(input.prepared.action.target)
    }),
    input.prepared.maintenance
  )
}

/**
 * Revalidates and resolves a retained Legendary Resistance choice. The caller
 * supplies freshly prepared native facts and publishes the returned proposal
 * in its enclosing transaction. A two-phase action must resume its sealed
 * OUTCOME before interpreting this branch; this helper never treats TEST as a
 * complete action.
 */
export async function resolveNativeMovementLegendaryResistance(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  prepared: PreparedMovementReaction
  snapshot: ServerKernelRuleExecutionPendingSnapshotDto
  candidate: EncounterLegendaryResistanceCandidate
  selection: NativeMovementLegendaryResistanceSelection
  testD20Policy: ServerRuleExecutionD20PolicyDto
  currentFeatureResource: {
    used: number
    maximum: number | null
    remaining: number | null
  }
}) {
  requireEncounterMovementMaintenanceCurrentness(input.snapshot, input.prepared.maintenance)
  const context = input.snapshot.applicationContext
  if (
    input.snapshot.occurrenceId !== input.occurrenceId ||
    context.kind !== 'ENCOUNTER_MOVEMENT_REACTION' ||
    context.phase.kind !== 'LEGENDARY_RESISTANCE_CHOICE' ||
    context.phase.selectedOptionId !== input.prepared.option.optionId ||
    checksumRuleDocument(input.prepared.action.target) !== context.phase.targetStateChecksum ||
    checksumRuleDocument(context.phase.originalExecution) !==
      context.phase.originalExecutionChecksum ||
    !sameCandidate(context.phase, input.candidate)
  )
    throw new Error('Legendary Resistance evidence is stale.')
  requireFailedSave({
    execution: context.phase.originalExecution,
    d20: context.phase.originalD20
  })
  const {
    snapshotKind: _snapshotKind,
    applicationContext: _applicationContext,
    optionalCombatSnapshotChecksum: _optionalCombatSnapshotChecksum,
    phaseReceipts: _phaseReceipts,
    ...continuation
  } = input.snapshot
  return resolveResistanceChoice({
    ...input,
    phase: context.phase,
    continuation
  })
}

async function resolveResistanceChoice(input: {
  runtime: RulesRuntimeService
  candidate: EncounterLegendaryResistanceCandidate
  phase: LegendaryResistancePhase
  continuation: ServerRuleExecutionContinuationDto
  selection: NativeMovementLegendaryResistanceSelection
  testD20Policy: ServerRuleExecutionD20PolicyDto
  currentFeatureResource: {
    used: number
    maximum: number | null
    remaining: number | null
  }
}) {
  const { phase } = input

  const use =
    input.selection.kind === 'OPTION' && input.selection.optionId === phase.resistance.useOptionId
  if (input.selection.kind !== 'DECLINE' && !use)
    throw new Error('Legendary Resistance selection was not issued.')

  if (
    input.continuation.graph.source.definitionId !== input.candidate.choiceGraph.id ||
    input.continuation.graph.source.checksum !== input.candidate.choiceGraph.checksum
  )
    throw new Error('Legendary Resistance choice continuation pin is stale.')
  const choice = await input.runtime.resume({
    continuation: input.continuation,
    response: {
      requestId: input.continuation.request.requestId,
      value: use ? 1 : 0
    }
  })
  if (
    choice.status !== 'COMPLETE' ||
    choice.evidence.source.definitionId !== input.candidate.choiceGraph.id ||
    choice.evidence.source.checksum !== input.candidate.choiceGraph.checksum ||
    choice.outputs[input.candidate.lifecycle.useOutput] !== use
  )
    throw new Error('Legendary Resistance choice did not settle its exact pin.')

  const chargeProposal = use
    ? (() => {
        if (
          input.currentFeatureResource.maximum === null ||
          input.currentFeatureResource.remaining !==
            input.currentFeatureResource.maximum - input.currentFeatureResource.used ||
          input.currentFeatureResource.remaining !== input.candidate.poolBefore ||
          input.currentFeatureResource.used + input.candidate.featureCost >
            input.currentFeatureResource.maximum
        )
          throw new Error('Legendary Resistance charge is stale.')
        return {
          ownerActorId: input.candidate.targetActorId,
          ownerFeatureId: input.candidate.ownerFeatureId,
          chargeId: input.candidate.chargeId,
          cost: input.candidate.featureCost,
          beforeUsed: input.currentFeatureResource.used,
          afterUsed: input.currentFeatureResource.used + input.candidate.featureCost,
          beforeRemaining: input.candidate.poolBefore,
          afterRemaining: input.candidate.poolRemaining
        } satisfies NativeMovementLegendaryResistanceChargeProposal
      })()
    : null

  return {
    execution: phase.originalExecution,
    d20: phase.originalD20,
    effectivePath: use ? ('ON_SAVE_SUCCESS' as const) : ('ON_SAVE_FAIL' as const),
    audit: {
      choiceExecution: choice,
      selection: use ? ('USE' as const) : ('DECLINE' as const),
      originalExecutionChecksum: phase.originalExecutionChecksum,
      targetStateChecksum: phase.targetStateChecksum,
      resistance: phase.resistance,
      d20: input.testD20Policy
    },
    legendaryResistance: {
      selectedIndex: use ? (1 as const) : (0 as const),
      use,
      lifecycle: input.candidate.lifecycle,
      execution: choice,
      originalD20: phase.originalD20
    },
    chargeProposal
  }
}

/** Reconstructs a retained OUTCOME decision before any action or charge is published. */
export async function replayNativeMovementLegendaryResistance(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  prepared: PreparedMovementReaction
  candidate: EncounterLegendaryResistanceCandidate
  execution: LegendaryResistancePhase['originalExecution']
  d20: ServerRuleExecutionD20EvidenceDto
  testD20Policy: ServerRuleExecutionD20PolicyDto
  audit: Awaited<ReturnType<typeof resolveNativeMovementLegendaryResistance>>['audit']
  currentFeatureResource: {
    used: number
    maximum: number | null
    remaining: number | null
  }
}) {
  const phase: LegendaryResistancePhase = {
    kind: 'LEGENDARY_RESISTANCE_CHOICE',
    selectedOptionId: input.prepared.option.optionId,
    originalExecution: input.execution,
    originalD20: input.d20,
    originalExecutionChecksum: input.audit.originalExecutionChecksum,
    targetStateChecksum: input.audit.targetStateChecksum,
    resistance: input.audit.resistance
  }
  requireFailedSave({ execution: input.execution, d20: input.d20 })
  if (
    !sameCandidate(phase, input.candidate) ||
    input.candidate.targetActorId !== input.prepared.prepared.target.id ||
    checksumRuleDocument(input.execution) !== phase.originalExecutionChecksum ||
    checksumRuleDocument(input.prepared.action.target) !== phase.targetStateChecksum ||
    checksumRuleDocument(input.testD20Policy) !== checksumRuleDocument(input.audit.d20)
  )
    throw new Error('The retained Legendary Resistance decision is stale.')
  const choice = await input.runtime.executeResolved({
    command: {
      definitionId: input.candidate.choiceGraph.id,
      occurrenceId: input.occurrenceId,
      facts: {}
    },
    published: input.candidate.choiceGraph
  })
  if (choice.status !== 'PAUSED') throw new Error('Legendary Resistance choice is unavailable.')
  const resolved = await resolveResistanceChoice({
    ...input,
    phase,
    continuation: choice.continuation,
    selection:
      input.audit.selection === 'USE'
        ? { kind: 'OPTION', optionId: phase.resistance.useOptionId }
        : { kind: 'DECLINE' }
  })
  if (checksumRuleDocument(resolved.audit) !== checksumRuleDocument(input.audit))
    throw new Error('The retained Legendary Resistance choice execution is stale.')
  return resolved
}
