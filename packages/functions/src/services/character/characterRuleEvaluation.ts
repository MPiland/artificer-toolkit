import type { DBLike } from '@artificer-toolkit/db'
import {
  characterRulePolicyOutputSchema,
  type CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import type { CharacterAuthored, SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { performance } from 'node:perf_hooks'

import { resolveCharacterRuleBinding, type CharacterRuleBinding } from './characterRuleBinding.js'
import {
  composeCharacterRulePolicyFacts,
  type CharacterRulePolicyFactsInput
} from './characterRulePolicyFacts.js'
import { assembleCharacterRuleSnapshot } from './characterRuleSnapshot.js'
import {
  buildCharacterSpellRuleFacts,
  collectCharacterRuleInputSpellIds
} from './characterSpellRuleFacts.js'
import { evaluateRuleRevision } from '../rules/ruleRevisionRuntime.js'

export interface CharacterRuleEvaluationInput extends Omit<
  CharacterRulePolicyFactsInput,
  'character' | 'spellsWithEffects'
> {
  db: DBLike
  character: CharacterAuthored
  existingRevisionId: string | null
  expectedRevisionId?: string
  referenceSpellIds?: readonly string[]
  /** Exact spell documents pinned by a committed Character mechanics projection. */
  pinnedSpellsById?: ReadonlyMap<string, SpellAuthored>
  trace?: boolean
}

export interface CharacterRuleEvaluationResult {
  binding: CharacterRuleBinding
  context: CharacterRuleEvaluationInput['context']
  snapshot: ReturnType<typeof composeCharacterRulePolicyFacts>['snapshot']
  registry: ReturnType<typeof composeCharacterRulePolicyFacts>['registry']
  facts: ReturnType<typeof composeCharacterRulePolicyFacts>['facts']
  output: CharacterRulePolicyOutput
  evaluation: {
    revisionId: string
    checksum: string
    evaluatorKind: string
    evaluatorVersion: string
    modelContractVersion: number
    modelKey: string
    contractKey: string
    trace: unknown
    timing: {
      bindingMs: number
      factDiscoveryMs: number
      spellHydrationMs: number
      factAssemblyMs: number
      runtimeMs: number
      zenEvaluationMs: number
      totalMs: number
      documentBytes: number
      normalizedFactsBytes: number
      resultBytes: number
    }
  }
}

function collectCharacterRuleEvaluationSpellIdsFromSnapshot(input: {
  referenceSpellIds?: readonly string[]
  registry: ReturnType<typeof assembleCharacterRuleSnapshot>['registry']
  snapshot: ReturnType<typeof assembleCharacterRuleSnapshot>['snapshot']
}): ReadonlySet<string> {
  const spellFacts = buildCharacterSpellRuleFacts(input.snapshot, input.registry)
  return collectCharacterRuleInputSpellIds({
    referenceSpellIds: input.referenceSpellIds,
    spellAccessCandidates: spellFacts.spellAccessCandidates,
    spellSources: input.snapshot.spellSources
  })
}

export function collectCharacterRuleEvaluationSpellIds(
  input: Pick<CharacterRuleEvaluationInput, 'character' | 'context' | 'referenceSpellIds'>
): ReadonlySet<string> {
  const assembled = assembleCharacterRuleSnapshot(input)
  return collectCharacterRuleEvaluationSpellIdsFromSnapshot({
    referenceSpellIds: input.referenceSpellIds,
    registry: assembled.registry,
    snapshot: assembled.snapshot
  })
}

export async function evaluateCharacterRulePolicy(
  input: CharacterRuleEvaluationInput
): Promise<CharacterRuleEvaluationResult> {
  const startedAt = performance.now()
  const factDiscoveryStartedAt = performance.now()
  const assembled = assembleCharacterRuleSnapshot(input)
  const spellFacts = buildCharacterSpellRuleFacts(assembled.snapshot, assembled.registry)
  const spellIds = [
    ...collectCharacterRuleEvaluationSpellIdsFromSnapshot({
      referenceSpellIds: input.referenceSpellIds,
      registry: assembled.registry,
      snapshot: assembled.snapshot
    })
  ]
  const factDiscoveryMs = performance.now() - factDiscoveryStartedAt
  const spellHydrationStartedAt = performance.now()
  const spellsById = input.pinnedSpellsById ?? input.context.spellDocumentsById
  const spellsWithEffects = spellIds.map((spellId) => {
    const result = spellAuthoredDtoSchema.safeParse(spellsById?.get(spellId))
    if (
      !result.success ||
      result.data.id !== spellId ||
      result.data.systemId !== input.character.systemId
    ) {
      throw new Error(`Character rule evaluation could not hydrate spell "${spellId}".`)
    }
    return result.data as unknown as SpellAuthored
  })
  const spellHydrationMs = performance.now() - spellHydrationStartedAt
  const bindingStartedAt = performance.now()
  const binding = await resolveCharacterRuleBinding({
    db: input.db,
    systemId: input.character.systemId,
    existingRevisionId: input.existingRevisionId,
    expectedRevisionId: input.expectedRevisionId
  })
  const bindingMs = performance.now() - bindingStartedAt
  const factAssemblyStartedAt = performance.now()
  const factsResult = composeCharacterRulePolicyFacts(
    {
      ...input,
      character: input.character,
      context: input.context,
      spellsWithEffects
    },
    {
      assembled,
      spellFacts
    }
  )
  const factAssemblyMs = performance.now() - factAssemblyStartedAt
  const runtimeStartedAt = performance.now()
  const evaluation = await evaluateRuleRevision({
    db: input.db,
    revisionId: binding.revisionId,
    modelKey: 'character-policy',
    contractKey: 'character-policy',
    normalizedFacts: factsResult.facts,
    trace: input.trace
  })
  const runtimeMs = performance.now() - runtimeStartedAt
  const output = characterRulePolicyOutputSchema.parse(evaluation.result)

  return {
    binding,
    context: input.context,
    snapshot: factsResult.snapshot,
    registry: factsResult.registry,
    facts: factsResult.facts,
    output,
    evaluation: {
      revisionId: evaluation.revisionId,
      checksum: evaluation.checksum,
      evaluatorKind: evaluation.evaluatorKind,
      evaluatorVersion: evaluation.evaluatorVersion,
      modelContractVersion: evaluation.modelContractVersion,
      modelKey: evaluation.modelKey,
      contractKey: evaluation.contractKey,
      trace: evaluation.trace,
      timing: {
        bindingMs,
        factDiscoveryMs,
        spellHydrationMs,
        factAssemblyMs,
        runtimeMs,
        zenEvaluationMs: evaluation.evaluationDurationMs,
        totalMs: performance.now() - startedAt,
        documentBytes: evaluation.documentBytes,
        normalizedFactsBytes: evaluation.normalizedFactsBytes,
        resultBytes: evaluation.resultBytes
      }
    }
  }
}
