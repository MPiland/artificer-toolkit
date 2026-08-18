import { createAuthoredVersionRepository, type DBLike } from '@artificer-toolkit/db'
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
import { buildCharacterSpellRuleFacts } from './characterSpellRuleFacts.js'
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

export async function evaluateCharacterRulePolicy(
  input: CharacterRuleEvaluationInput
): Promise<CharacterRuleEvaluationResult> {
  const startedAt = performance.now()
  const bindingStartedAt = performance.now()
  let bindingMs = 0
  const bindingPromise = resolveCharacterRuleBinding({
    db: input.db,
    systemId: input.character.systemId,
    existingRevisionId: input.existingRevisionId,
    expectedRevisionId: input.expectedRevisionId
  }).finally(() => {
    bindingMs = performance.now() - bindingStartedAt
  })
  const factDiscoveryStartedAt = performance.now()
  const assembled = assembleCharacterRuleSnapshot(input)
  const spellFacts = buildCharacterSpellRuleFacts(assembled.snapshot, assembled.registry)
  const spellIds = [
    ...new Set([
      ...(assembled.snapshot.spellSources ?? []).map((source) => source.spellId),
      ...spellFacts.spellAccessCandidates.map((candidate) => candidate.spellId),
      ...(input.referenceSpellIds ?? [])
    ])
  ]
  const factDiscoveryMs = performance.now() - factDiscoveryStartedAt
  const spellHydrationStartedAt = performance.now()
  let spellHydrationMs = 0
  const spellsPromise: Promise<ReadonlyMap<string, SpellAuthored>> = (
    input.pinnedSpellsById
      ? Promise.resolve(input.pinnedSpellsById)
      : createAuthoredVersionRepository(input.db)
          .findActiveByIds({
            subjectKind: 'SPELL',
            subjectIds: spellIds,
            systemId: input.character.systemId,
            userId: input.character.userId,
            includeMaster: true
          })
          .then((recordsById) =>
            new Map(
              [...recordsById].map(([spellId, record]) => [
                spellId,
                spellAuthoredDtoSchema.parse(record.authored.document) as unknown as SpellAuthored
              ])
            )
          )
  )
    .finally(() => {
      spellHydrationMs = performance.now() - spellHydrationStartedAt
    })
  const [binding, spellsById] = await Promise.all([bindingPromise, spellsPromise])
  const spellsWithEffects = spellIds.flatMap((spellId) => {
    const spell = spellsById.get(spellId)
    if (!spell || spell.systemId !== input.character.systemId) {
      throw new Error(`Character rule evaluation could not hydrate spell "${spellId}".`)
    }
    return [spell]
  })
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
