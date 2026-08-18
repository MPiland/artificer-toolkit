import type { CharacterMechanicsProjection } from '@artificer-toolkit/schema/projections/characterMechanics'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterMovementDisplayPreference, CharacterSheetAdjustment } from '@artificer-toolkit/shared/character'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

import type { CharacterBuilderContext } from './builderService.js'
import type { CharacterRuleEvaluationResult } from './characterRuleEvaluation.js'
import { assembleCharacterRuleSnapshot } from './characterRuleSnapshot.js'

export function createCommittedCharacterRuleEvaluation(input: {
  adjustments: readonly CharacterSheetAdjustment[]
  character: CharacterAuthored
  context: CharacterBuilderContext
  mechanics: CharacterMechanicsProjection
  movementDisplayPreference: CharacterMovementDisplayPreference | null
  rulePolicy?: {
    input: CharacterRulePolicyInput
    output: CharacterRulePolicyOutput
  }
}): CharacterRuleEvaluationResult {
  const assembled = assembleCharacterRuleSnapshot({
    character: input.character,
    context: input.context,
    adjustments: input.adjustments,
    movementDisplayPreference: input.movementDisplayPreference ?? undefined
  })
  return {
    binding: {
      revisionId: input.mechanics.ruleRevisionId,
      checksum: input.mechanics.ruleRevisionChecksum,
      evaluatorKind: 'ZEN',
      evaluatorVersion: input.mechanics.evaluatorVersion,
      modelContractVersion: input.mechanics.modelContractVersion
    },
    context: input.context,
    snapshot: assembled.snapshot,
    registry: assembled.registry,
    facts: input.rulePolicy?.input ?? input.mechanics.rulePolicyInput,
    output: input.rulePolicy?.output ?? input.mechanics.rulePolicyOutput,
    evaluation: {
      revisionId: input.mechanics.ruleRevisionId,
      checksum: input.mechanics.ruleRevisionChecksum,
      evaluatorKind: 'ZEN',
      evaluatorVersion: input.mechanics.evaluatorVersion,
      modelContractVersion: input.mechanics.modelContractVersion,
      modelKey: 'character-policy',
      contractKey: 'character-policy',
      trace: null,
      timing: {
        bindingMs: 0,
        factDiscoveryMs: 0,
        spellHydrationMs: 0,
        factAssemblyMs: 0,
        runtimeMs: 0,
        zenEvaluationMs: 0,
        totalMs: 0,
        documentBytes: 0,
        normalizedFactsBytes: 0,
        resultBytes: 0
      }
    }
  }
}
