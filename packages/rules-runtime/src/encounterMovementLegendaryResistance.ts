import type { RulesRuntimeService } from './rulesRuntimeService.js'
import type { EncounterSealedChoiceSelection } from './encounterSealedChoice.js'
import type { EncounterLegendaryResistanceCandidate } from './encounterLegendaryResistanceDiscovery.js'
import {
  openEncounterLegendaryResistanceChoice,
  requireFailedLegendaryResistanceSave,
  sameEncounterLegendaryResistanceCandidate,
  settleEncounterLegendaryResistanceChoice,
  type EncounterLegendaryResistanceFeatureResource
} from './encounterLegendaryResistanceChoice.js'
import { retainEncounterLegendaryResistanceChoice } from './encounterMovementReactionContinuation.js'
import type {
  ServerKernelRuleExecutionPendingSnapshotDto,
  ServerRuleExecutionContinuationDto,
  ServerRuleExecutionD20EvidenceDto,
  ServerRuleExecutionD20PolicyDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { reconstructNativeActionTest } from './encounterActionExecution.js'
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
    'requestId' | 'rawFaces' | 'rollMode' | 'keep' | 'selectedNatural'
  >
}) {
  return reconstructNativeActionTest({
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    adapter: input.prepared.prepared.adapter,
    binding: input.prepared.prepared.binding,
    plan: input.prepared.executionPlan,
    execution: input.execution,
    d20: input.d20
  })
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
  requireFailedLegendaryResistanceSave({ execution: input.execution, d20: input.d20 })
  if (
    input.candidate.targetActorId !== input.prepared.prepared.target.id ||
    (input.context.phase.kind !== 'CHOICE' &&
      (input.context.phase.kind !== 'ACTION_EVIDENCE' ||
        input.context.phase.selectedOptionId !== input.prepared.option.optionId))
  )
    throw new Error('Legendary Resistance action selection is stale.')
  const choice = await openEncounterLegendaryResistanceChoice(input)
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
  selection: EncounterSealedChoiceSelection
  testD20Policy: ServerRuleExecutionD20PolicyDto
  currentFeatureResource: EncounterLegendaryResistanceFeatureResource
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
    !sameEncounterLegendaryResistanceCandidate(context.phase.resistance, input.candidate)
  )
    throw new Error('Legendary Resistance evidence is stale.')
  requireFailedLegendaryResistanceSave({
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
  selection: EncounterSealedChoiceSelection
  testD20Policy: ServerRuleExecutionD20PolicyDto
  currentFeatureResource: EncounterLegendaryResistanceFeatureResource
}) {
  const { phase } = input
  const { use, choice, chargeProposal } = await settleEncounterLegendaryResistanceChoice({
    ...input,
    resistance: phase.resistance
  })

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
  currentFeatureResource: EncounterLegendaryResistanceFeatureResource
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
  requireFailedLegendaryResistanceSave({ execution: input.execution, d20: input.d20 })
  if (
    !sameEncounterLegendaryResistanceCandidate(phase.resistance, input.candidate) ||
    input.candidate.targetActorId !== input.prepared.prepared.target.id ||
    checksumRuleDocument(input.execution) !== phase.originalExecutionChecksum ||
    checksumRuleDocument(input.prepared.action.target) !== phase.targetStateChecksum ||
    checksumRuleDocument(input.testD20Policy) !== checksumRuleDocument(input.audit.d20)
  )
    throw new Error('The retained Legendary Resistance decision is stale.')
  const choice = await openEncounterLegendaryResistanceChoice(input)
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
