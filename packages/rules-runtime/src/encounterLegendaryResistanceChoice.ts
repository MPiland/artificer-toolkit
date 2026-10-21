import type { EncounterLegendaryResistancePinDto } from '@artificer-toolkit/schema/shared/ruleExecutionDirectActionPendingContexts'
import type {
  ServerCompletedRuleExecutionDto,
  ServerRuleExecutionContinuationDto,
  ServerRuleExecutionD20EvidenceDto,
  ServerRuleExecutionD20PolicyDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type { EncounterLegendaryResistanceCandidate } from './encounterLegendaryResistanceDiscovery.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import {
  chosenEncounterSealedOption,
  openEncounterAuthoredChoice,
  settleEncounterSealedChoice,
  type EncounterSealedChoiceSelection
} from './encounterSealedChoice.js'

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
  return openEncounterAuthoredChoice({
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    published: input.candidate.choiceGraph,
    label: 'Legendary Resistance'
  })
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
  selection: EncounterSealedChoiceSelection
  currentFeatureResource: EncounterLegendaryResistanceFeatureResource
}) {
  const use =
    chosenEncounterSealedOption({
      options: [input.resistance],
      optionId: (resistance) => resistance.useOptionId,
      selection: input.selection,
      label: 'Legendary Resistance'
    }) !== null
  const choice = await settleEncounterSealedChoice({
    runtime: input.runtime,
    continuation: input.continuation,
    selectedIndex: use ? 1 : 0,
    pin: {
      definitionId: input.candidate.choiceGraph.id,
      checksum: input.candidate.choiceGraph.checksum
    },
    output: { key: input.candidate.lifecycle.useOutput, value: use },
    label: 'Legendary Resistance'
  })

  const chargeProposal = use
    ? legendaryResistanceChargeProposal(input.candidate, input.currentFeatureResource)
    : null

  return { use, choice, chargeProposal }
}

/** What a sealed offer pins about the failed save, the creature and the resistance it may use. */
type EncounterLegendaryResistanceOfferPin = {
  originalExecutionChecksum: string
  targetStateChecksum: string
  d20: ServerRuleExecutionD20PolicyDto
  resistance: EncounterLegendaryResistancePinDto
}

/** The interstitial audit a decided offer hands the sealed OUTCOME it selects. */
export function encounterLegendaryResistanceAudit(input: {
  offer: EncounterLegendaryResistanceOfferPin
  selection: 'DECLINE' | 'USE'
  choiceExecution: ServerCompletedRuleExecutionDto
}) {
  return {
    choiceExecution: input.choiceExecution,
    selection: input.selection,
    originalExecutionChecksum: input.offer.originalExecutionChecksum,
    targetStateChecksum: input.offer.targetStateChecksum,
    resistance: input.offer.resistance,
    d20: input.offer.d20
  }
}

/**
 * Settles a creature's decision against its sealed offer. The offer, the failed save, the creature's
 * facts and the freshly discovered pool must all still be the ones it was made against. A decision to
 * use also proposes the charge it costs; spending it belongs to the caller's commit.
 */
export async function decideEncounterLegendaryResistance(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  boundary: {
    execution: ServerCompletedRuleExecutionDto
    d20: ServerRuleExecutionD20EvidenceDto
    d20Policy: ServerRuleExecutionD20PolicyDto
  }
  offer: EncounterLegendaryResistanceOfferPin
  candidate: EncounterLegendaryResistanceCandidate
  targetStateChecksum: string
  selection: EncounterSealedChoiceSelection
  currentFeatureResource: EncounterLegendaryResistanceFeatureResource
}) {
  const { boundary, offer } = input
  if (
    input.targetStateChecksum !== offer.targetStateChecksum ||
    checksumRuleDocument(boundary.execution) !== offer.originalExecutionChecksum ||
    checksumRuleDocument(boundary.d20Policy) !== checksumRuleDocument(offer.d20) ||
    !sameEncounterLegendaryResistanceCandidate(offer.resistance, input.candidate)
  )
    throw new Error('Legendary Resistance evidence is stale.')
  requireFailedLegendaryResistanceSave({ execution: boundary.execution, d20: boundary.d20 })
  const choice = await openEncounterLegendaryResistanceChoice({
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    candidate: input.candidate
  })
  const settled = await settleEncounterLegendaryResistanceChoice({
    runtime: input.runtime,
    candidate: input.candidate,
    resistance: offer.resistance,
    continuation: choice.continuation,
    selection: input.selection,
    currentFeatureResource: input.currentFeatureResource
  })
  return {
    ...settled,
    audit: encounterLegendaryResistanceAudit({
      offer,
      selection: settled.use ? 'USE' : 'DECLINE',
      choiceExecution: settled.choice
    })
  }
}
