import type { EncounterAreaLegendaryResistanceDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type {
  EncounterAreaLegendaryResistanceAudit,
  EncounterAreaTargetTest
} from './encounterAreaActionExecution.js'
import { encounterAreaTargetOccurrenceId } from './encounterAreaPending.js'
import {
  encounterLegendaryResistancePin,
  legendaryResistanceChargeProposal,
  openEncounterLegendaryResistanceChoice,
  requireFailedLegendaryResistanceSave,
  sameEncounterLegendaryResistanceCandidate,
  settleEncounterLegendaryResistanceChoice,
  type EncounterLegendaryResistanceFeatureResource,
  type EncounterLegendaryResistanceSelection
} from './encounterLegendaryResistanceChoice.js'
import type { EncounterLegendaryResistanceCandidate } from './encounterLegendaryResistanceDiscovery.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'

type TestedAreaTest = Extract<EncounterAreaTargetTest, { kind: 'TESTED' }>

/**
 * Seals the Legendary Resistance a creature's failed save may use against that save, the creature's
 * facts and its pool as they are now. Null when the creature has none to offer.
 */
export function offerEncounterAreaLegendaryResistance(input: {
  test: TestedAreaTest
  targetStateChecksum: string
}): EncounterAreaLegendaryResistanceDto | null {
  const { test } = input
  if (!test.legendaryResistance) return null
  return {
    originalExecutionChecksum: checksumRuleDocument(test.boundary.execution),
    targetStateChecksum: input.targetStateChecksum,
    d20: test.boundary.d20Policy,
    resistance: encounterLegendaryResistancePin(test.legendaryResistance)
  }
}

/**
 * Records the creature's decision against its sealed offer. The offer, the failed save, the creature's
 * facts and the freshly discovered pool must all still be the ones it was made against. A decision to
 * use also proposes the charge it costs; spending it belongs to the area's commit, not to this call.
 */
export async function decideEncounterAreaLegendaryResistance(input: {
  runtime: RulesRuntimeService
  areaOccurrenceId: string
  test: TestedAreaTest
  offer: EncounterAreaLegendaryResistanceDto
  candidate: EncounterLegendaryResistanceCandidate
  targetStateChecksum: string
  selection: EncounterLegendaryResistanceSelection
  currentFeatureResource: EncounterLegendaryResistanceFeatureResource
}) {
  const { boundary } = input.test
  if (
    input.offer.decision ||
    input.targetStateChecksum !== input.offer.targetStateChecksum ||
    checksumRuleDocument(boundary.execution) !== input.offer.originalExecutionChecksum ||
    checksumRuleDocument(boundary.d20Policy) !== checksumRuleDocument(input.offer.d20) ||
    !sameEncounterLegendaryResistanceCandidate(input.offer.resistance, input.candidate)
  )
    throw new Error('Legendary Resistance evidence is stale.')
  requireFailedLegendaryResistanceSave({ execution: boundary.execution, d20: boundary.d20 })
  const choice = await openEncounterLegendaryResistanceChoice({
    runtime: input.runtime,
    occurrenceId: encounterAreaTargetOccurrenceId(input.areaOccurrenceId, input.test.actorId),
    candidate: input.candidate
  })
  const settled = await settleEncounterLegendaryResistanceChoice({
    runtime: input.runtime,
    candidate: input.candidate,
    resistance: input.offer.resistance,
    continuation: choice.continuation,
    selection: input.selection,
    currentFeatureResource: input.currentFeatureResource
  })
  return {
    legendaryResistance: {
      ...input.offer,
      decision: {
        selection: settled.use ? ('USE' as const) : ('DECLINE' as const),
        choiceExecution: settled.choice
      }
    } satisfies EncounterAreaLegendaryResistanceDto,
    chargeProposal: settled.chargeProposal
  }
}

/** The decided creatures' audits, which the area's settlement applies to each failed save. */
export function encounterAreaLegendaryResistanceAudits(
  offers: ReadonlyMap<string, EncounterAreaLegendaryResistanceDto>
) {
  const audits = new Map<string, EncounterAreaLegendaryResistanceAudit>()
  for (const [actorId, offer] of offers) {
    if (!offer.decision) continue
    audits.set(actorId, {
      choiceExecution: offer.decision.choiceExecution,
      selection: offer.decision.selection,
      originalExecutionChecksum: offer.originalExecutionChecksum,
      targetStateChecksum: offer.targetStateChecksum,
      resistance: offer.resistance,
      d20: offer.d20
    })
  }
  return audits
}

/**
 * What a creature's area outcome records of its decided Legendary Resistance: the decision against the
 * failed save it replaces, and, when it used the resistance, the charge it cost on the creature's
 * current pool. The creature's pool and the offer must still be the ones the decision was made against.
 */
export function encounterAreaTargetLegendaryResistance(input: {
  audit: EncounterAreaLegendaryResistanceAudit
  candidate: EncounterLegendaryResistanceCandidate
  boundary: TestedAreaTest['boundary']
  currentFeatureResource: EncounterLegendaryResistanceFeatureResource
}) {
  const { audit, candidate, boundary } = input
  if (
    !sameEncounterLegendaryResistanceCandidate(audit.resistance, candidate) ||
    checksumRuleDocument(boundary.execution) !== audit.originalExecutionChecksum
  )
    throw new Error('Legendary Resistance evidence is stale.')
  const use = audit.selection === 'USE'
  return {
    legendaryResistance: {
      selectedIndex: use ? (1 as const) : (0 as const),
      use,
      lifecycle: candidate.lifecycle,
      execution: audit.choiceExecution,
      originalExecution: boundary.execution,
      originalExecutionChecksum: audit.originalExecutionChecksum,
      originalD20: boundary.d20,
      ownerFeatureId: audit.resistance.ownerFeatureId,
      chargeId: audit.resistance.chargeId,
      featureCost: audit.resistance.featureCost
    },
    charge: use ? legendaryResistanceChargeProposal(candidate, input.currentFeatureResource) : null
  }
}
