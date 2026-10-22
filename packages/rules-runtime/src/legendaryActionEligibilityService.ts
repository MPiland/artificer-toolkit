import {
  legendaryActionEligibilityOutputDtoSchema,
  type LegendaryActionEligibilityOutputDto
} from '@artificer-toolkit/schema/shared/encounterLifecycle'
import type { ResolvedRuleCapabilityStateDto } from '@artificer-toolkit/schema/shared/ruleState'
import type { ServerCompletedRuleExecutionDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  serverPublishedRuleDefinitionDtoSchema,
  type ServerPublishedRuleDefinitionDto
} from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import { ruleGraphDefinitionDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type { CurrentReusableDefinitionSource } from './ruleCapabilityStateService.js'
import { legendaryActionEligibilityCapabilityRegistry } from './platformEncounterPolicy.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'

export interface LegendaryActionEligibilitySource {
  ownerActorId: string
  ownerFeatureId: string
  actionId: string
  gameSystemId: string
  lifecycle: {
    definitionId: string
    definitionVersion: number
    definitionChecksum: string
    eligibilityGraphDefinitionId: string
    eligibilityGraphDefinitionVersion: number
    eligibilityGraphDefinitionChecksum: string
    eligibleOutput: string
  }
}

export interface LegendaryActionEligibilityFacts {
  capabilityState: ResolvedRuleCapabilityStateDto
  outgoingActorId: string
  poolRemaining: number
  windowUsed: boolean
}

export interface EvaluatedLegendaryActionCandidate<
  TSource extends LegendaryActionEligibilitySource = LegendaryActionEligibilitySource
> {
  source: TSource
  policy: LegendaryActionEligibilityOutputDto
  evidence: ServerCompletedRuleExecutionDto['evidence']
}

export interface LegendaryActionEligibilityAdapter {
  gameSystemId: string
  requiredCapabilityDefinitionIds: readonly string[]
  evaluate(input: {
    runtime: RulesRuntimeService
    occurrenceId: string
    /** The source's pinned eligibility graph, read through the caller's authorized definitions. */
    graph: ServerPublishedRuleDefinitionDto
    source: LegendaryActionEligibilitySource
    facts: LegendaryActionEligibilityFacts
  }): Promise<{
    policy: unknown
    evidence: ServerCompletedRuleExecutionDto['evidence']
  }>
}

/**
 * Runs an exact Feature-bound Legendary Action policy. The caller discovers
 * immutable Features and owns current resource/turn facts; this seam only
 * maps those frozen facts through the selected System graph.
 */
export async function evaluateLegendaryActionEligibility<
  TSource extends LegendaryActionEligibilitySource
>(input: {
  runtime: RulesRuntimeService
  definitions: CurrentReusableDefinitionSource
  occurrenceId: string
  candidates: readonly { source: TSource; facts: LegendaryActionEligibilityFacts }[]
}): Promise<readonly EvaluatedLegendaryActionCandidate<TSource>[]> {
  const evaluated: EvaluatedLegendaryActionCandidate<TSource>[] = []
  for (const entry of input.candidates) {
    if (entry.source.gameSystemId !== entry.facts.capabilityState.gameSystemId) {
      throw new Error('Legendary Action source does not match its resolved capability System.')
    }
    const adapter = legendaryActionEligibilityCapabilityRegistry.require(entry.source.gameSystemId)
    const { lifecycle } = entry.source
    const current = await input.definitions.requireCurrent(lifecycle.eligibilityGraphDefinitionId)
    const graph = ruleGraphDefinitionDtoSchema.safeParse(current.document)
    if (
      !graph.success ||
      current.id !== lifecycle.eligibilityGraphDefinitionId ||
      current.gameSystemId !== entry.source.gameSystemId ||
      current.version !== lifecycle.eligibilityGraphDefinitionVersion ||
      current.checksum !== lifecycle.eligibilityGraphDefinitionChecksum ||
      checksumRuleDocument(current.document) !== current.checksum
    ) {
      throw new Error('Legendary Action eligibility graph pin is stale.')
    }
    const result = await adapter.evaluate({
      runtime: input.runtime,
      occurrenceId: input.occurrenceId,
      graph: serverPublishedRuleDefinitionDtoSchema.parse({
        id: current.id,
        gameSystemId: current.gameSystemId,
        definitionFamilyKey: current.definitionFamilyKey,
        checksum: current.checksum,
        definition: graph.data
      }),
      ...entry
    })
    if (
      result.evidence.source.definitionId !== entry.source.lifecycle.eligibilityGraphDefinitionId ||
      result.evidence.source.gameSystemId !== entry.source.gameSystemId
    ) {
      throw new Error('Legendary Action eligibility evidence does not match its exact graph pin.')
    }
    evaluated.push({
      source: entry.source,
      policy: legendaryActionEligibilityOutputDtoSchema.parse(result.policy),
      evidence: result.evidence
    })
  }
  return evaluated
}

export function requireLegendaryActionCapabilityDefinitionIds(
  gameSystemId: string
): readonly string[] {
  return [
    ...legendaryActionEligibilityCapabilityRegistry.require(gameSystemId)
      .requiredCapabilityDefinitionIds
  ]
}
