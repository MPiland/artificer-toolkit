import type { EncounterLegendaryResistancePinDto } from '@artificer-toolkit/schema/shared/ruleExecutionDirectActionPendingContexts'
import type {
  ServerCompletedRuleExecutionDto,
  ServerRuleExecutionContinuationDto,
  ServerRuleExecutionD20EvidenceDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type { EncounterLegendaryResistanceCandidate } from './encounterLegendaryResistanceDiscovery.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'

/** What the creature's controller answers: declining, or the one option that uses the resistance. */
export type EncounterLegendaryResistanceSelection =
  | { kind: 'DECLINE' }
  | { kind: 'OPTION'; optionId: string }

export interface EncounterLegendaryResistanceFeatureResource {
  used: number
  maximum: number | null
  remaining: number | null
}

export interface EncounterLegendaryResistanceChargeProposal {
  ownerActorId: string
  ownerFeatureId: string
  chargeId: string
  cost: number
  beforeUsed: number
  afterUsed: number
  beforeRemaining: number
  afterRemaining: number
}

export function legendaryResistanceUseOptionId(input: { selectionChecksum: string }): string {
  return checksumRuleDocument({ kind: 'USE', selectionChecksum: input.selectionChecksum })
}

/** The exact source, pool and option identity offered for one failed save. */
export function encounterLegendaryResistancePin(
  candidate: EncounterLegendaryResistanceCandidate
): EncounterLegendaryResistancePinDto {
  const selectionChecksum = checksumRuleDocument({
    targetActorId: candidate.targetActorId,
    ownerFeatureId: candidate.ownerFeatureId,
    chargeId: candidate.chargeId,
    featureCost: candidate.featureCost,
    definitionId: candidate.lifecycle.definitionId,
    definitionVersion: candidate.lifecycle.definitionVersion,
    definitionChecksum: candidate.lifecycle.definitionChecksum,
    choiceGraphDefinitionId: candidate.lifecycle.choiceGraphDefinitionId,
    choiceGraphDefinitionVersion: candidate.lifecycle.choiceGraphDefinitionVersion,
    choiceGraphDefinitionChecksum: candidate.lifecycle.choiceGraphDefinitionChecksum
  })
  return {
    targetActorId: candidate.targetActorId,
    ownerFeatureId: candidate.ownerFeatureId,
    chargeId: candidate.chargeId,
    featureCost: candidate.featureCost,
    poolBefore: candidate.poolBefore,
    poolRemaining: candidate.poolRemaining,
    definitionId: candidate.lifecycle.definitionId,
    definitionVersion: candidate.lifecycle.definitionVersion,
    definitionChecksum: candidate.lifecycle.definitionChecksum,
    choiceGraphDefinitionId: candidate.lifecycle.choiceGraphDefinitionId,
    choiceGraphDefinitionVersion: candidate.lifecycle.choiceGraphDefinitionVersion,
    choiceGraphDefinitionChecksum: candidate.lifecycle.choiceGraphDefinitionChecksum,
    useOutput: candidate.lifecycle.useOutput,
    useOptionId: legendaryResistanceUseOptionId({ selectionChecksum }),
    selectionChecksum
  }
}

/** Whether the freshly discovered candidate is still the one the pin was sealed against. */
export function sameEncounterLegendaryResistanceCandidate(
  resistance: EncounterLegendaryResistancePinDto,
  candidate: EncounterLegendaryResistanceCandidate
) {
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

export function requireFailedLegendaryResistanceSave(input: {
  execution: ServerCompletedRuleExecutionDto
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

/** The charge a used resistance costs, checked against the creature’s current pool. */
export function legendaryResistanceChargeProposal(
  candidate: EncounterLegendaryResistanceCandidate,
  currentFeatureResource: EncounterLegendaryResistanceFeatureResource
) {
  if (
    currentFeatureResource.maximum === null ||
    currentFeatureResource.remaining !==
      currentFeatureResource.maximum - currentFeatureResource.used ||
    currentFeatureResource.remaining !== candidate.poolBefore ||
    currentFeatureResource.used + candidate.featureCost > currentFeatureResource.maximum
  )
    throw new Error('Legendary Resistance charge is stale.')
  return {
    ownerActorId: candidate.targetActorId,
    ownerFeatureId: candidate.ownerFeatureId,
    chargeId: candidate.chargeId,
    cost: candidate.featureCost,
    beforeUsed: currentFeatureResource.used,
    afterUsed: currentFeatureResource.used + candidate.featureCost,
    beforeRemaining: candidate.poolBefore,
    afterRemaining: candidate.poolRemaining
  } satisfies EncounterLegendaryResistanceChargeProposal
}

/** Starts the sealed two-option choice; nothing is published until a decision settles it. */
export async function openEncounterLegendaryResistanceChoice(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  candidate: EncounterLegendaryResistanceCandidate
}) {
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
  return choice
}

/**
 * Settles a sealed choice against its pin and returns the chosen outcome. Using the resistance also
 * proposes the charge it costs, checked against the creature's current pool; nothing is spent here.
 */
export async function settleEncounterLegendaryResistanceChoice(input: {
  runtime: RulesRuntimeService
  candidate: EncounterLegendaryResistanceCandidate
  resistance: EncounterLegendaryResistancePinDto
  continuation: ServerRuleExecutionContinuationDto
  selection: EncounterLegendaryResistanceSelection
  currentFeatureResource: EncounterLegendaryResistanceFeatureResource
}) {
  const use =
    input.selection.kind === 'OPTION' && input.selection.optionId === input.resistance.useOptionId
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
    ? legendaryResistanceChargeProposal(input.candidate, input.currentFeatureResource)
    : null

  return { use, choice, chargeProposal }
}
