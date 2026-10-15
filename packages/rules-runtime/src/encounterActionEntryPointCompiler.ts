import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import {
  CompiledActionEntryPoint,
  compiledActionEntryPointsSchema,
  CompiledActionCompilerSource,
  CompiledActionTargetPolicy
} from '@artificer-toolkit/schema/projections/characterMechanics'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { characterResourcePoolIdentitySchema } from '@artificer-toolkit/schema/shared/characterResourceIdentity'

import type {
  CharacterActionCapabilityDescriptor,
  EffectActionCapabilityDescriptor
} from './characterActionCapabilityDiscovery.js'
import { CharacterRuleActionUnsupportedCompilationError } from './characterRuleActionSystemAdapter.js'
import { characterRuleActionSystemAdapterRegistry } from './characterRuleActionSystemAdapterRegistry.js'
import { placedSpaceManifest } from './encounterZonePlacement.js'

class CharacterActionEntryPointIntegrityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CharacterActionEntryPointIntegrityError'
  }
}

export function buildCompiledActionTargetPolicy(
  descriptor: EffectActionCapabilityDescriptor
): CompiledActionTargetPolicy {
  return {
    range: descriptor.compiledEffect.invocation.range,
    targeting: descriptor.compiledEffect.invocation.targeting ?? null,
    // A zone an action places is the area it takes a point for, when the invocation names none.
    shape:
      descriptor.compiledEffect.invocation.shape ??
      placedSpaceManifest(descriptor.compiledEffect)?.shape ??
      null,
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
    resourceUse.chargeId.length === 0 ||
    !characterResourcePoolIdentitySchema.safeParse(resourceUse.poolId).success ||
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
      const exactTargetPolicy = buildCompiledActionTargetPolicy(descriptor)
      try {
        const zonePlacement = adapter.compileZonePlacement?.({ action: descriptor }) ?? null
        if (zonePlacement) {
          // The zone's entry graph runs when a creature enters it, never when the action is used.
          return {
            schemaVersion: 4,
            kind: 'CHARACTER_ACTION',
            actionId: candidate.actionId,
            effectId: candidate.effectId,
            targetPolicy: exactTargetPolicy,
            compilation: {
              kind: 'COMPILED',
              resourceBinding: compiledResourceBinding(candidate),
              activeEffectPlan: null,
              zonePlacement,
              executionPlan: { kind: 'SINGLE_GRAPH', published: zonePlacement.entry.frozenGraph }
            }
          }
        }
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
        // A grant freezes its own graph and reads only the TEST's hit path, so it alone joins the
        // two-phase execution.
        if (
          executionPlan.kind === 'TEST_OUTCOME' &&
          activeEffectPlans.some((plan) => !plan.modifierGrantContribution)
        ) {
          throw new CharacterRuleActionUnsupportedCompilationError(
            'TEST/OUTCOME actions combine only with grant active-effect plans.'
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
            zonePlacement: null,
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
