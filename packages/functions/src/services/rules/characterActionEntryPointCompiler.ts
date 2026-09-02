import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import {
  CompiledActionEntryPoint,
  compiledActionEntryPointsSchema,
  CompiledActionCompilerSource,
  CompiledActionTargetPolicy
} from '@artificer-toolkit/schema/projections/characterMechanics'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { compileSpell } from '@artificer-toolkit/shared/compilers'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { AuthoredVersionVector } from '@artificer-toolkit/schema/projections/identity'

import type {
  CharacterActionCapabilityDescriptor,
  EffectActionCapabilityDescriptor
} from './characterActionCapabilityDiscovery.js'
import { CharacterRuleActionUnsupportedCompilationError } from './characterRuleActionSystemAdapter.js'
import { characterRuleActionSystemAdapterRegistry } from './characterRuleActionSystemAdapterRegistry.js'

export class CharacterActionEntryPointIntegrityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CharacterActionEntryPointIntegrityError'
  }
}

function targetPolicy(descriptor: EffectActionCapabilityDescriptor): CompiledActionTargetPolicy {
  return {
    range: descriptor.compiledEffect.invocation.range,
    targeting: descriptor.compiledEffect.invocation.targeting ?? null,
    shape: descriptor.compiledEffect.invocation.shape ?? null,
    pathOverrides: descriptor.compiledEffect.entries.flatMap((entry) => {
      const range = 'rangeOverride' in entry ? (entry.rangeOverride ?? null) : null
      const targeting = 'targetingOverride' in entry ? (entry.targetingOverride ?? null) : null
      if (!range && !targeting) return []
      return [
        {
          entryId: entry.entryId,
          pathGroupId: entry.pathGroupId,
          pathCode: entry.pathCode,
          pathOrder: entry.pathOrder,
          entryOrder: entry.entryOrder,
          range,
          targeting
        }
      ]
    })
  }
}

function manual(
  candidate: CharacterActionCandidate,
  targetPolicy: CompiledActionTargetPolicy,
  reasonCode: 'SYSTEM_CAPABILITY_UNAVAILABLE' | 'NOT_NORMALIZED'
): CompiledActionEntryPoint {
  return {
    schemaVersion: 1,
    kind: 'CHARACTER_ACTION',
    actionId: candidate.actionId,
    effectId: candidate.effectId,
    targetPolicy,
    compilation: { kind: 'MANUAL', reasonCode }
  }
}

function compiledResourceBinding(
  candidate: CharacterActionCandidate
): { poolId: string; chargeId: string; cost: number } | null {
  const resourceUse = candidate.resourceUse
  if (!resourceUse) return null
  if (
    resourceUse.poolId === null ||
    resourceUse.poolId !== resourceUse.poolId.trim() ||
    resourceUse.chargeId !== resourceUse.chargeId.trim() ||
    resourceUse.poolId.length === 0 ||
    resourceUse.chargeId.length === 0 ||
    resourceUse.poolId.length > 240 ||
    resourceUse.chargeId.length > 240 ||
    !Number.isSafeInteger(resourceUse.cost) ||
    resourceUse.cost <= 0
  ) {
    throw new CharacterRuleActionUnsupportedCompilationError(
      'Character action resource use is not fully normalized.'
    )
  }
  return {
    poolId: resourceUse.poolId,
    chargeId: resourceUse.chargeId,
    cost: resourceUse.cost
  }
}

/**
 * Persist the compiler input rather than a prepared execution plan.  Runtime
 * still binds actors, targets, casts, scaling, and evidence under the owning
 * aggregate lock before specializing a phase.
 */
/**
 * Builds the sealed compiler input shared by Character projections and
 * immutable Encounter Feature actions.  It contains authored source facts
 * only; aggregate services bind actors, targets, and roll evidence later.
 */
export function buildCompiledActionCompilerSource(
  descriptor: EffectActionCapabilityDescriptor
): CompiledActionCompilerSource {
  const base = {
    schemaVersion: 1 as const,
    sourceId: descriptor.sourceId,
    entryPointDefinitionId: descriptor.entryPointDefinitionId,
    effectId: descriptor.effectId,
    conditionDefinitionIds: [...(descriptor.conditionDefinitionIds ?? [])].sort(),
    savingThrowAbilityDefinitionId: descriptor.savingThrowAbilityDefinitionId ?? null,
    compiledEffect: descriptor.compiledEffect,
    compiledEffectChecksum: checksumRuleDocument(descriptor.compiledEffect),
    capabilityContractVersion: 1
  }
  return {
    ...base,
    compilerSourceChecksum: checksumRuleDocument(base)
  } as CompiledActionCompilerSource
}

function assertDescriptorAlignment(input: {
  candidates: readonly CharacterActionCandidate[]
  descriptors: readonly CharacterActionCapabilityDescriptor[]
}): void {
  if (input.candidates.length !== input.descriptors.length) {
    throw new CharacterActionEntryPointIntegrityError(
      'Character action descriptors do not align with action candidates.'
    )
  }
  const actionIds = new Set<string>()
  for (const [index, candidate] of input.candidates.entries()) {
    if (actionIds.has(candidate.actionId)) {
      throw new CharacterActionEntryPointIntegrityError(
        'Character action candidates must have unique action identities.'
      )
    }
    actionIds.add(candidate.actionId)
    const descriptor = input.descriptors[index]
    if (
      !descriptor ||
      descriptor.actionId !== candidate.actionId ||
      descriptor.effectId !== candidate.effectId
    ) {
      throw new CharacterActionEntryPointIntegrityError(
        `Character action descriptor ${index} does not match its candidate.`
      )
    }
  }
}

export function compileCharacterActionEntryPoints(
  input: {
    gameSystemId: string
    candidates: readonly CharacterActionCandidate[]
    descriptors: readonly CharacterActionCapabilityDescriptor[]
  },
  registry = characterRuleActionSystemAdapterRegistry
): CompiledActionEntryPoint[] {
  const adapter = registry.get(input.gameSystemId)
  if (!adapter) {
    return input.candidates.map((candidate) => ({
      schemaVersion: 1,
      kind: 'CHARACTER_ACTION',
      actionId: candidate.actionId,
      effectId: candidate.effectId,
      compilation: {
        kind: 'MANUAL',
        reasonCode: 'SYSTEM_CAPABILITY_UNAVAILABLE'
      }
    }))
  }
  assertDescriptorAlignment(input)
  return compiledActionEntryPointsSchema.parse(
    input.candidates.map((candidate, index) => {
      const descriptor = input.descriptors[index]!
      const exactTargetPolicy = targetPolicy(descriptor)
      try {
        const source = buildCompiledActionCompilerSource(descriptor)
        const executionPlan = adapter.compileExecutionPlan?.({
          action: descriptor,
          compilerSource: source
        }) ?? {
          kind: 'SINGLE_GRAPH' as const,
          published: adapter.compile({ action: descriptor })
        }
        const published =
          executionPlan.kind === 'SINGLE_GRAPH'
            ? executionPlan.published
            : executionPlan.test.published
        const activeEffectPlans =
          adapter.activeEffectPlans?.({ action: descriptor, published }) ?? []
        if (activeEffectPlans.length > 1) {
          throw new CharacterRuleActionUnsupportedCompilationError(
            'Character actions support at most one active-effect plan.'
          )
        }
        if (executionPlan.kind === 'TEST_OUTCOME' && activeEffectPlans.length > 0) {
          throw new CharacterRuleActionUnsupportedCompilationError(
            'TEST/OUTCOME actions cannot combine with active-effect plans.'
          )
        }
        return {
          schemaVersion: 4,
          kind: 'CHARACTER_ACTION',
          actionId: candidate.actionId,
          effectId: candidate.effectId,
          targetPolicy: exactTargetPolicy,
          compilation: {
            kind: 'COMPILED',
            resourceBinding: compiledResourceBinding(candidate),
            activeEffectPlan: activeEffectPlans[0] ?? null,
            executionPlan
          }
        }
      } catch (error) {
        if (error instanceof CharacterRuleActionUnsupportedCompilationError)
          return manual(candidate, exactTargetPolicy, 'NOT_NORMALIZED')
        throw error
      }
    })
  )
}

/**
 * Compiles only exact current spell-cast candidates which resolve to one
 * executable non-passive Effect.  A spell cast is not an alias for a
 * Character action: its source and economy are sealed separately by the
 * Encounter command path.
 */
export function compileCharacterSpellCastEntryPoints(
  input: {
    gameSystemId: string
    candidates: CharacterRulePolicyInput['spellCastCandidates']
    decisions: CharacterRulePolicyOutput['spellCastDecisions']
    mechanics: CharacterRulePolicyOutput['spellCastMechanics']
    spellActionFacts: CharacterRulePolicyInput['spellActionFacts']
    spells: readonly SpellAuthored[]
    authoredVersionVector: AuthoredVersionVector
  },
  registry = characterRuleActionSystemAdapterRegistry
): CompiledActionEntryPoint[] {
  const adapter = registry.get(input.gameSystemId)
  if (!adapter) return []
  const spellsById = new Map(input.spells.map((spell) => [spell.id, spell]))
  const versionsBySpellId = new Map(
    input.authoredVersionVector
      .filter((entry) => entry.subjectKind === 'SPELL')
      .map((entry) => [entry.subjectId, entry])
  )
  const entries: unknown[] = []
  for (const candidate of input.candidates) {
    const decision = input.decisions.find((value) => value.candidateId === candidate.candidateId)
    const mechanics = input.mechanics.find((value) => value.candidateId === candidate.candidateId)
    const spellFacts = input.spellActionFacts.find((value) => value.spellId === candidate.spellId)
    const spell = spellsById.get(candidate.spellId)
    const version = versionsBySpellId.get(candidate.spellId)
    if (!decision || !mechanics || !spellFacts || !spell || !version) continue
    const compiledEffects = (compileSpell(spell).effects ?? []).filter(
      (effect) => effect.invocation.kind !== 'PASSIVE'
    )
    if (compiledEffects.length !== 1 || spellFacts.effects.length !== 1) continue
    const compiledEffect = compiledEffects[0]!
    const mechanicFacts = spellFacts.effects[0]!
    const resolvedMechanic = mechanics.mechanics.find(
      (value) => value.effectId === compiledEffect.id
    )
    if (
      spellFacts.effects[0]!.effectId !== compiledEffect.id ||
      !resolvedMechanic ||
      mechanics.mechanics.length !== 1 ||
      spell.systemId !== input.gameSystemId
    ) {
      continue
    }
    const descriptor = {
      kind: 'CHARACTER_SPELL_CAST' as const,
      gameSystemId: input.gameSystemId,
      authoredRootKind: 'effect' as const,
      entryPointDefinitionId: compiledEffect.id,
      effectId: compiledEffect.id,
      actionId: candidate.candidateId,
      sourceId: candidate.candidateId,
      mechanicFacts: mechanicFacts.mechanicFacts,
      compiledEffect
    }
    try {
      const compilerSource = buildCompiledActionCompilerSource(descriptor)
      const executionPlan = adapter.compileExecutionPlan?.({
        action: descriptor,
        compilerSource
      }) ?? {
        kind: 'SINGLE_GRAPH' as const,
        published: adapter.compile({ action: descriptor })
      }
      const published =
        executionPlan.kind === 'SINGLE_GRAPH'
          ? executionPlan.published
          : executionPlan.test.published
      const activeEffectPlans = adapter.activeEffectPlans?.({ action: descriptor, published }) ?? []
      if (
        activeEffectPlans.length > 1 ||
        (executionPlan.kind === 'TEST_OUTCOME' && activeEffectPlans.length > 0)
      ) {
        continue
      }
      entries.push({
        schemaVersion: 4,
        kind: 'CHARACTER_SPELL_CAST',
        actionId: candidate.candidateId,
        effectId: compiledEffect.id,
        spell: {
          spellId: candidate.spellId,
          versionId: version.versionId,
          version: version.version,
          checksum: version.checksum,
          sourceKind: candidate.source.sourceKind,
          sourceInstanceId: candidate.source.sourceInstanceId,
          castLevel: candidate.castLevel,
          castMode: candidate.castMode,
          slotKey: decision.slotKey,
          resourceOwnerKey: candidate.resourceOwnerKey
        },
        targetPolicy: targetPolicy(descriptor),
        compilation: {
          kind: 'COMPILED',
          activeEffectPlan: activeEffectPlans[0] ?? null,
          executionPlan
        }
      })
    } catch (error) {
      if (!(error instanceof CharacterRuleActionUnsupportedCompilationError)) throw error
    }
  }
  return compiledActionEntryPointsSchema.parse(entries)
}
