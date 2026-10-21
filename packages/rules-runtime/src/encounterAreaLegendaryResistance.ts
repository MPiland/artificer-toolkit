import type { EncounterAreaLegendaryResistanceDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import type { EncounterSealedChoiceSelection } from './encounterSealedChoice.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type {
  EncounterAreaLegendaryResistanceAudit,
  EncounterAreaTargetTest
} from './encounterAreaActionExecution.js'
import {
  decideEncounterLegendaryResistance,
  encounterLegendaryResistanceAudit,
  encounterLegendaryResistancePin,
  legendaryResistanceChargeProposal,
  sameEncounterLegendaryResistanceCandidate,
  type EncounterLegendaryResistanceFeatureResource
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
  selection: EncounterSealedChoiceSelection
  currentFeatureResource: EncounterLegendaryResistanceFeatureResource
}) {
  if (input.offer.decision) throw new Error('Legendary Resistance evidence is stale.')
  const decided = await decideEncounterLegendaryResistance({
    ...input,
    occurrenceId: input.test.occurrenceId,
    boundary: input.test.boundary
  })
  return {
    legendaryResistance: {
      ...input.offer,
      decision: { selection: decided.audit.selection, choiceExecution: decided.choice }
    } satisfies EncounterAreaLegendaryResistanceDto,
    chargeProposal: decided.chargeProposal
  }
}

/** The decided creatures' audits, which the area's settlement applies to each failed save. */
export function encounterAreaLegendaryResistanceAudits(
  offers: ReadonlyMap<string, EncounterAreaLegendaryResistanceDto>
) {
  const audits = new Map<string, EncounterAreaLegendaryResistanceAudit>()
  for (const [actorId, offer] of offers) {
    if (!offer.decision) continue
    audits.set(
      actorId,
      encounterLegendaryResistanceAudit({
        offer,
        selection: offer.decision.selection,
        choiceExecution: offer.decision.choiceExecution
      })
    )
  }
  return audits
}

/**
 * What a creature's action outcome (one area target's, or a single-target action's) records of its
 * decided Legendary Resistance: the decision against the failed save it replaces, and, when it used the
 * resistance, the charge it cost on the creature's current pool. The creature's pool and the offer must
 * still be the ones the decision was made against.
 */
export function encounterTargetLegendaryResistance(input: {
  audit: EncounterAreaLegendaryResistanceAudit
  candidate: EncounterLegendaryResistanceCandidate
  boundary: Pick<TestedAreaTest['boundary'], 'execution' | 'd20'>
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
