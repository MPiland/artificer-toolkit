import { characterRulePolicyOutputSchema } from '@artificer-toolkit/schema/api/characterRules'
import type { DBLike } from '@artificer-toolkit/db'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { performance } from 'node:perf_hooks'

import { dnd5e2014CharacterPolicyDocument } from '../rules/systems/dnd5e/2014/characterPolicy.js'
import { evaluateZenRuleModel } from '../rules/zenRuleEngine.js'
import { RULE_MODEL_CONTRACT_VERSION } from '../rules/ruleModelContracts.js'
import {
  composeCharacterRulePolicyFacts,
  type CharacterRulePolicyFactsResult
} from './characterRulePolicyFacts.js'
import { assembleCharacterRuleSnapshot } from './characterRuleSnapshot.js'
import { buildCharacterSpellRuleFacts } from './characterSpellRuleFacts.js'
import type {
  CharacterRuleEvaluationInput,
  CharacterRuleEvaluationResult
} from './characterRuleEvaluation.js'

const TEST_REVISION_ID = 'builder-test-rule-revision'

type CharacterRuleTestDb = DBLike & {
  __characterRuleTestSpells?: readonly SpellAuthored[]
}

function catalogSpellForTest(
  input: CharacterRuleEvaluationInput,
  spellId: string
): SpellAuthored | undefined {
  const spell = input.context.catalog.spells.find((candidate) => candidate.id === spellId)
  if (!spell) return undefined
  return {
    kind: 'SPELL',
    ...spell,
    userId: input.character.userId,
    systemId: input.character.systemId
  }
}

export async function evaluateCharacterBuilderTestPolicy(
  input: CharacterRuleEvaluationInput
): Promise<CharacterRuleEvaluationResult> {
  const startedAt = performance.now()
  const factAssemblyStartedAt = performance.now()
  const assembled = assembleCharacterRuleSnapshot(input)
  const spellFacts = buildCharacterSpellRuleFacts(assembled.snapshot, assembled.registry)
  const spellIds = [
    ...new Set([
      ...(assembled.snapshot.spellSources ?? []).map((source) => source.spellId),
      ...spellFacts.spellAccessCandidates.map((candidate) => candidate.spellId),
      ...(input.referenceSpellIds ?? [])
    ])
  ]
  const suppliedSpells = new Map(
    ((input.db as CharacterRuleTestDb).__characterRuleTestSpells ?? []).map((spell) => [
      spell.id,
      spell
    ])
  )
  const spellsWithEffects = spellIds.map((spellId) => {
    const spell = suppliedSpells.get(spellId) ?? catalogSpellForTest(input, spellId)
    if (!spell) throw new Error(`Character rule test could not hydrate spell "${spellId}".`)
    return spell
  })
  const factsResult: CharacterRulePolicyFactsResult = composeCharacterRulePolicyFacts(
    {
      ...input,
      spellsWithEffects
    },
    { assembled, spellFacts }
  )
  const factAssemblyMs = performance.now() - factAssemblyStartedAt
  const evaluationStartedAt = performance.now()
  const evaluated = await evaluateZenRuleModel({
    document: dnd5e2014CharacterPolicyDocument,
    modelKey: 'character-policy',
    context: factsResult.facts
  })
  const zenEvaluationMs = performance.now() - evaluationStartedAt
  const output = characterRulePolicyOutputSchema.parse(evaluated.result)
  const revisionId = input.existingRevisionId ?? TEST_REVISION_ID

  if (input.expectedRevisionId && input.expectedRevisionId !== revisionId) {
    throw new Error('The Character rule revision changed during the Builder evaluation.')
  }

  return {
    binding: {
      revisionId,
      checksum: 'builder-test-checksum',
      evaluatorKind: 'ZEN',
      evaluatorVersion: '0.54.0',
      modelContractVersion: RULE_MODEL_CONTRACT_VERSION
    },
    context: input.context,
    snapshot: factsResult.snapshot,
    registry: factsResult.registry,
    facts: factsResult.facts,
    discoveredActionCapabilities: [],
    compiledActionEntryPoints: [],
    spellsWithEffects,
    output,
    evaluation: {
      revisionId,
      checksum: 'builder-test-checksum',
      evaluatorKind: 'ZEN',
      evaluatorVersion: '0.54.0',
      modelContractVersion: RULE_MODEL_CONTRACT_VERSION,
      modelKey: 'character-policy',
      contractKey: 'character-policy',
      trace: evaluated.trace,
      timing: {
        bindingMs: 0,
        factDiscoveryMs: 0,
        spellHydrationMs: 0,
        factAssemblyMs,
        runtimeMs: zenEvaluationMs,
        zenEvaluationMs,
        totalMs: performance.now() - startedAt,
        documentBytes: Buffer.byteLength(JSON.stringify(dnd5e2014CharacterPolicyDocument), 'utf8'),
        normalizedFactsBytes: Buffer.byteLength(JSON.stringify(factsResult.facts), 'utf8'),
        resultBytes: Buffer.byteLength(JSON.stringify(output), 'utf8')
      }
    }
  }
}
