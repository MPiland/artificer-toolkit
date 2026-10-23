import {
  RULE_VALUE_KIND,
  type CompiledRuleGraph,
  type ProposalRuleOperationContract,
  type RuleGraphDefinition
} from '@artificer-toolkit/shared/rules'
import type { HealDamageDealtPayload } from '@artificer-toolkit/shared/authored'
import type {
  CharacterDamageDerivedHealApplication,
  CharacterRuleActionApplication
} from '../../characterRuleActionSystemAdapter.js'
import {
  DND5E_DAMAGE_PROPOSAL_OPERATION_KEY,
  DND5E_DAMAGE_DERIVED_HEAL_PROPOSAL_OPERATION_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
  Dnd5eEffectActionCompilerError,
  UUID
} from './effectActionContracts.js'
import type { DirectInterpretationInput } from './effectActionEvidenceChecks.js'

const isPositiveSafeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0

/** The fraction of the damage a sibling outcome dealt that the recipient regains, rounded down. */
export function damageDerivedHealAmount(
  damage: number,
  fraction: HealDamageDealtPayload['fraction']
): number {
  return Math.floor((damage * fraction.numerator) / fraction.denominator)
}

export const dnd5eDamageDerivedHealProposalOperation: ProposalRuleOperationContract = {
  key: DND5E_DAMAGE_DERIVED_HEAL_PROPOSAL_OPERATION_KEY,
  contractVersion: 1,
  executionKind: 'PROPOSAL',
  inputs: {
    targetActorId: RULE_VALUE_KIND.TEXT,
    resultPath: RULE_VALUE_KIND.TEXT,
    sourceDamageNodeId: RULE_VALUE_KIND.TEXT,
    sourceDamageOperationKey: RULE_VALUE_KIND.TEXT,
    sourceDamageOutcomeId: RULE_VALUE_KIND.TEXT,
    numerator: RULE_VALUE_KIND.NUMBER,
    denominator: RULE_VALUE_KIND.NUMBER,
    recipient: RULE_VALUE_KIND.TEXT,
    targetStateChecksum: RULE_VALUE_KIND.TEXT
  },
  outputs: {
    targetActorId: RULE_VALUE_KIND.TEXT,
    resultPath: RULE_VALUE_KIND.TEXT,
    sourceDamageNodeId: RULE_VALUE_KIND.TEXT,
    sourceDamageOperationKey: RULE_VALUE_KIND.TEXT,
    sourceDamageOutcomeId: RULE_VALUE_KIND.TEXT,
    numerator: RULE_VALUE_KIND.NUMBER,
    denominator: RULE_VALUE_KIND.NUMBER,
    recipient: RULE_VALUE_KIND.TEXT,
    applicationCandidate: RULE_VALUE_KIND.BOOLEAN,
    targetStateChecksum: RULE_VALUE_KIND.TEXT
  },
  execute(inputs) {
    const {
      targetActorId,
      resultPath,
      sourceDamageNodeId,
      sourceDamageOperationKey,
      sourceDamageOutcomeId,
      numerator,
      denominator,
      recipient,
      targetStateChecksum
    } = inputs
    if (
      typeof targetActorId !== 'string' ||
      !UUID.test(targetActorId) ||
      typeof resultPath !== 'string' ||
      typeof sourceDamageNodeId !== 'string' ||
      sourceDamageNodeId.length === 0 ||
      typeof sourceDamageOperationKey !== 'string' ||
      sourceDamageOperationKey.length === 0 ||
      typeof sourceDamageOutcomeId !== 'string' ||
      !UUID.test(sourceDamageOutcomeId) ||
      !isPositiveSafeInteger(numerator) ||
      !isPositiveSafeInteger(denominator) ||
      recipient !== 'SOURCE' ||
      typeof targetStateChecksum !== 'string' ||
      !/^[a-f0-9]{64}$/.test(targetStateChecksum)
    ) {
      throw new Error('D&D damage-derived heal proposal is invalid.')
    }
    return {
      targetActorId,
      resultPath,
      sourceDamageNodeId,
      sourceDamageOperationKey,
      sourceDamageOutcomeId,
      numerator,
      denominator,
      recipient,
      applicationCandidate: true,
      targetStateChecksum
    }
  }
}

/** Regains a fraction of the damage a sibling proposal of the same graph dealt to the target. */
export function damageDerivedHealProposalNode(input: {
  id: string
  resultPath: RuleGraphDefinition['nodes'][number]['inputs'][string]
  sourceDamageNodeId: string
  heal: Pick<HealDamageDealtPayload, 'damageOutcomeId' | 'fraction' | 'recipient'>
}): RuleGraphDefinition['nodes'][number] {
  return {
    id: input.id,
    operation: { key: DND5E_DAMAGE_DERIVED_HEAL_PROPOSAL_OPERATION_KEY, contractVersion: 1 },
    inputs: {
      targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
      resultPath: input.resultPath,
      sourceDamageNodeId: { kind: 'LITERAL', value: input.sourceDamageNodeId },
      sourceDamageOperationKey: { kind: 'LITERAL', value: DND5E_DAMAGE_PROPOSAL_OPERATION_KEY },
      sourceDamageOutcomeId: { kind: 'LITERAL', value: input.heal.damageOutcomeId },
      numerator: { kind: 'LITERAL', value: input.heal.fraction.numerator },
      denominator: { kind: 'LITERAL', value: input.heal.fraction.denominator },
      recipient: { kind: 'LITERAL', value: input.heal.recipient },
      targetStateChecksum: { kind: 'FACT', factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY }
    }
  }
}

const invalidTrace = () =>
  new Dnd5eEffectActionCompilerError('The committed D&D damage-derived heal trace is invalid.')

/**
 * The heal a completed graph proposed, derived from the one damage application it follows. The trace
 * is checked against the published node it ran; no application is made when the damage was nullified.
 */
export function damageDerivedHealApplication(
  input: Pick<DirectInterpretationInput, 'execution' | 'targetActorId'>,
  graph: Pick<CompiledRuleGraph, 'nodes'>,
  applications: readonly CharacterRuleActionApplication[]
): CharacterDamageDerivedHealApplication | null {
  const proposals = input.execution.evidence.trace.filter(
    (entry) => entry.operation.key === DND5E_DAMAGE_DERIVED_HEAL_PROPOSAL_OPERATION_KEY
  )
  if (proposals.length > 1)
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D rule action has duplicate damage-derived heals.'
    )
  const proposal = proposals[0]
  if (!proposal) return null
  const published = graph.nodes.find((node) => node.id === proposal.nodeId)
  const { outputs, inputs } = proposal
  const { sourceDamageNodeId, sourceDamageOperationKey, sourceDamageOutcomeId } = outputs
  const { numerator, denominator, resultPath } = outputs
  if (
    !published ||
    published.operation.key !== DND5E_DAMAGE_DERIVED_HEAL_PROPOSAL_OPERATION_KEY ||
    published.operation.contractVersion !== 1 ||
    proposal.operation.contractVersion !== 1 ||
    outputs.applicationCandidate !== true ||
    outputs.recipient !== 'SOURCE' ||
    outputs.targetActorId !== input.targetActorId ||
    inputs.targetActorId !== input.targetActorId ||
    outputs.targetStateChecksum !==
      input.execution.evidence.facts[DND5E_TARGET_STATE_CHECKSUM_FACT_KEY] ||
    inputs.targetStateChecksum !== outputs.targetStateChecksum ||
    typeof sourceDamageNodeId !== 'string' ||
    typeof sourceDamageOperationKey !== 'string' ||
    typeof sourceDamageOutcomeId !== 'string' ||
    !isPositiveSafeInteger(numerator) ||
    !isPositiveSafeInteger(denominator) ||
    typeof resultPath !== 'string' ||
    inputs.resultPath !== resultPath ||
    inputs.sourceDamageNodeId !== sourceDamageNodeId ||
    inputs.sourceDamageOperationKey !== sourceDamageOperationKey ||
    inputs.sourceDamageOutcomeId !== sourceDamageOutcomeId ||
    inputs.numerator !== numerator ||
    inputs.denominator !== denominator ||
    published.inputs.sourceDamageNodeId?.kind !== 'LITERAL' ||
    published.inputs.sourceDamageNodeId.value !== sourceDamageNodeId ||
    published.inputs.sourceDamageOperationKey?.kind !== 'LITERAL' ||
    published.inputs.sourceDamageOperationKey.value !== sourceDamageOperationKey ||
    published.inputs.sourceDamageOutcomeId?.kind !== 'LITERAL' ||
    published.inputs.sourceDamageOutcomeId.value !== sourceDamageOutcomeId ||
    published.inputs.numerator?.kind !== 'LITERAL' ||
    published.inputs.numerator.value !== numerator ||
    published.inputs.denominator?.kind !== 'LITERAL' ||
    published.inputs.denominator.value !== denominator ||
    published.inputs.resultPath?.kind !== 'LITERAL' ||
    published.inputs.resultPath.value !== resultPath
  )
    throw invalidTrace()
  const sourceDamage = applications.filter(
    (application): application is Extract<CharacterRuleActionApplication, { kind: 'DAMAGE' }> =>
      application.kind === 'DAMAGE' &&
      application.sourceNodeId === sourceDamageNodeId &&
      application.sourceOperationKey === sourceDamageOperationKey
  )
  const [damage] = sourceDamage
  if (sourceDamage.length !== 1 || !damage)
    throw new Dnd5eEffectActionCompilerError(
      'The committed D&D damage-derived heal source damage is invalid.'
    )
  const requestedAmount = damageDerivedHealAmount(damage.resolvedAmount, {
    numerator,
    denominator
  })
  if (requestedAmount < 1) return null
  return {
    kind: 'DAMAGE_DERIVED_HEAL',
    recipient: 'SOURCE',
    targetActorId: input.targetActorId,
    sourceNodeId: proposal.nodeId,
    sourceOperationKey: proposal.operation.key,
    authoredPath: damage.authoredPath,
    resolvedPath,
    sourceDamageNodeId,
    sourceDamageOperationKey,
    sourceDamageOutcomeId,
    requestedAmount
  }
}
