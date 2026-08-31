import type { DBLike } from '@artificer-toolkit/db'
import {
  characterRulePolicyOutputSchema,
  type CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { compareCanonicalD20Contributors } from '@artificer-toolkit/shared/rules'
import { resolveD20Contributors } from '@artificer-toolkit/shared/rolls'
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
import { discoverCharacterActionCapabilities } from '../rules/characterActionCapabilityDiscoveryRegistry.js'
import type { CharacterActionCapabilityDescriptor } from '../rules/characterActionCapabilityDiscovery.js'
import { compileCharacterActionEntryPoints } from '../rules/characterActionEntryPointCompiler.js'
import type { CompiledActionEntryPoint } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'

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
  vocabularySnapshot?: SystemVocabularySnapshot
  snapshot: ReturnType<typeof composeCharacterRulePolicyFacts>['snapshot']
  registry: ReturnType<typeof composeCharacterRulePolicyFacts>['registry']
  facts: ReturnType<typeof composeCharacterRulePolicyFacts>['facts']
  /** Server-only capability discovery; not part of Sheet or action projections until Gate 2. */
  discoveredActionCapabilities: readonly CharacterActionCapabilityDescriptor[]
  /** Server-only committed action execution sources aligned with action candidates. */
  compiledActionEntryPoints: readonly CompiledActionEntryPoint[]
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

type CharacterRollMode = CharacterRulePolicyOutput['rollModes']['initiative']

type CharacterRollContributor =
  CharacterRulePolicyOutput['rollContributorEvidence']['initiative'][number]

function canonicalizeRollContributors(
  contributors: readonly CharacterRollContributor[]
): readonly CharacterRollContributor[] {
  const ordered = [...contributors].sort(compareCanonicalD20Contributors)
  for (let index = 1; index < ordered.length; index += 1) {
    const prior = ordered[index - 1]!
    const current = ordered[index]!
    if (
      prior.sourceId === current.sourceId &&
      prior.grantId === current.grantId &&
      prior.domainKey === current.domainKey &&
      prior.influence === current.influence
    ) {
      throw new Error('Character saving-throw contributors must be unique.')
    }
  }
  return ordered
}

function resolveRollMode(
  contributors: CharacterRulePolicyOutput['rollContributorEvidence']['initiative']
): CharacterRollMode {
  return resolveD20Contributors(contributors).rollMode
}

function resolveRollModeRecord<
  T extends Record<string, readonly { influence: 'ADVANTAGE' | 'DISADVANTAGE' }[]>
>(contributors: T): { [Key in keyof T]: CharacterRollMode } {
  return Object.fromEntries(
    Object.entries(contributors).map(([key, values]) => [
      key,
      resolveD20Contributors(values).rollMode
    ])
  ) as { [Key in keyof T]: CharacterRollMode }
}

/**
 * System policy qualifies private contributors. Scalar modes emitted by the
 * transitional model contract are overwritten here and are never authoritative.
 */
export function resolveCharacterRulePolicyRollModes(
  output: CharacterRulePolicyOutput,
  vocabularySnapshot?: SystemVocabularySnapshot
): CharacterRulePolicyOutput {
  const contributors = output.rollContributorEvidence
  const savingThrowContributors = Object.fromEntries(
    Object.entries(contributors.savingThrows).map(([abilityId, values]) => [
      abilityId,
      canonicalizeRollContributors(values)
    ])
  ) as CharacterRulePolicyOutput['rollContributorEvidence']['savingThrows']
  const canonicalContributors = {
    ...contributors,
    savingThrows: savingThrowContributors
  }
  const rollModes = {
    initiative: resolveRollMode(canonicalContributors.initiative),
    abilityChecks: resolveRollModeRecord(canonicalContributors.abilityChecks),
    savingThrows: resolveRollModeRecord(canonicalContributors.savingThrows),
    skillChecks: resolveRollModeRecord(canonicalContributors.skillChecks),
    attacks: resolveRollModeRecord(canonicalContributors.attacks)
  }
  const derivedSavingThrows = output.derivedStats.savingThrows
  const abilityDefinitions =
    vocabularySnapshot && 'abilities' in vocabularySnapshot.document
      ? vocabularySnapshot.document.abilities
      : []
  if (derivedSavingThrows.length > 0 && abilityDefinitions.length === 0) {
    throw new Error(
      'Character saving throws require a System vocabulary snapshot with ability definitions.'
    )
  }
  const savingThrowDefinitions = derivedSavingThrows.map((savingThrow) => {
    const matches = abilityDefinitions.filter((ability) => ability.code === savingThrow.abilityId)
    if (matches.length !== 1) {
      throw new Error(
        `Character saving throw "${savingThrow.abilityId}" has no exact System ability definition.`
      )
    }
    const abilityDefinition = matches[0]!
    const rollMode =
      rollModes.savingThrows[savingThrow.abilityId as keyof typeof rollModes.savingThrows]
    const savingThrowEvidence =
      canonicalContributors.savingThrows[
        savingThrow.abilityId as keyof typeof contributors.savingThrows
      ]
    if (!rollMode || !savingThrowEvidence) {
      throw new Error(
        `Character saving throw "${savingThrow.abilityId}" lacks normalized roll evidence.`
      )
    }
    return {
      abilityDefinitionId: abilityDefinition.id,
      modifier: savingThrow.total.effective,
      rollMode,
      contributors: savingThrowEvidence
    }
  })
  if (
    new Set(savingThrowDefinitions.map((savingThrow) => savingThrow.abilityDefinitionId)).size !==
    savingThrowDefinitions.length
  ) {
    throw new Error('Character saving throws must map to unique System ability definitions.')
  }
  return {
    ...output,
    rollContributorEvidence: canonicalContributors,
    rollModes,
    savingThrowDefinitions: savingThrowDefinitions.sort((left, right) =>
      left.abilityDefinitionId.localeCompare(right.abilityDefinitionId)
    )
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
  const discoveredActionCapabilities = discoverCharacterActionCapabilities({
    gameSystemId: input.character.systemId,
    candidates: factsResult.facts.actionCandidates,
    conditionDefinitionIds: (input.context.registry.system?.conditionTypes ?? [])
      .map((condition) => condition.id)
      .sort(),
    abilityDefinitions:
      input.context.vocabularySnapshot && 'abilities' in input.context.vocabularySnapshot.document
        ? input.context.vocabularySnapshot.document.abilities.map(({ id, code }) => ({ id, code }))
        : [],
    entryPoints: factsResult.actionEntryPoints
  })
  const compiledActionEntryPoints = compileCharacterActionEntryPoints({
    gameSystemId: input.character.systemId,
    candidates: factsResult.facts.actionCandidates,
    descriptors: discoveredActionCapabilities
  })
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
  const output = resolveCharacterRulePolicyRollModes(
    characterRulePolicyOutputSchema.parse(evaluation.result),
    input.context.vocabularySnapshot
  )

  return {
    binding,
    context: input.context,
    vocabularySnapshot: input.context.vocabularySnapshot,
    snapshot: factsResult.snapshot,
    registry: factsResult.registry,
    facts: factsResult.facts,
    discoveredActionCapabilities,
    compiledActionEntryPoints,
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
