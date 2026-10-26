import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import {
  CompiledActionEntryPoint,
  compiledActionEntryPointsSchema,
  CompiledActionCompilerSource,
  CompiledActionTargetPolicy
} from '@artificer-toolkit/schema/projections/characterMechanics'

import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { characterResourcePoolIdentitySchema } from '@artificer-toolkit/schema/shared/characterResourceIdentity'

import { normalizeCharacterGrantRestrictions } from './character/characterGrantFoldRestrictionFacts.js'
import type {
  CharacterActionCapabilityDescriptor,
  EffectActionCapabilityDescriptor
} from './characterActionCapabilityDiscovery.js'
import {
  CharacterRuleActionUnsupportedCompilationError,
  type CharacterRuleActionExecutionPlan,
  type CharacterRuleActionSystemAdapter
} from './characterRuleActionSystemAdapter.js'
import { characterRuleActionSystemAdapterRegistry } from './platformEncounterPolicy.js'
import {
  encounterActionChoiceTarget,
  resolveAreaContentsTargeting,
  resolveChosenCreaturesTargeting
} from './encounterAreaAction.js'
import { castChoiceOptions } from './encounterCastChoice.js'
import { hitPointTierCeilings } from './hitPointTiers.js'
import { placedSpaceManifest, zoneAppearSave } from './encounterZonePlacement.js'

class CharacterActionEntryPointIntegrityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CharacterActionEntryPointIntegrityError'
  }
}

export function buildCompiledActionTargetPolicy(
  descriptor: EffectActionCapabilityDescriptor
): CompiledActionTargetPolicy {
  const targeting = descriptor.compiledEffect.invocation.targeting
  return {
    range: descriptor.compiledEffect.invocation.range,
    // A spell's cap or pool scaled by its cast level is the number it is at this cast (Magic Missile's
    // darts, Sleep's hit points).
    targeting:
      targeting?.selectionKind === 'CHOSEN_CREATURES'
        ? resolveChosenCreaturesTargeting(targeting, descriptor)
        : targeting?.selectionKind === 'AREA_CONTENTS'
          ? resolveAreaContentsTargeting(targeting, descriptor)
          : (targeting ?? null),
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
    capabilityContractVersion: 1,
    ...(descriptor.zoneAppearSave ? { zoneAppearSave: true as const } : {})
  }
  return {
    ...base,
    compilerSourceChecksum: checksumRuleDocument(base)
  } as CompiledActionCompilerSource
}

/**
 * The execution plan an authored Effect action runs (a Creature's feature action or an authored
 * basic action); Legendary discovery pins the same plan. An action that authors a cast pick (D148)
 * compiles per option, and a no-prompt flow runs its first option's plan. Throws
 * `CharacterRuleActionUnsupportedCompilationError` when the System cannot execute its shape.
 */
export function compileEncounterFeatureActionPlan(
  adapter: CharacterRuleActionSystemAdapter,
  capability: EffectActionCapabilityDescriptor
): CharacterRuleActionExecutionPlan {
  if (castChoiceOptions(capability.compiledEffect))
    return compileCastChoicePlans(adapter, capability, buildCompiledActionTargetPolicy(capability))
      .executionPlan
  return (
    adapter.compileExecutionPlan?.({
      action: capability,
      compilerSource: buildCompiledActionCompilerSource(capability)
    }) ?? { kind: 'SINGLE_GRAPH', published: adapter.compile({ action: capability }) }
  )
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

/**
 * The plans that run an action: its execution plan and its active-effect plans. An action holds at
 * most one plan for every target, or one plan per hit-point tier (a tiered result), or one plan per
 * roll-table row that holds an effect (a table result), and no other.
 */
function compileActionPlans(
  adapter: CharacterRuleActionSystemAdapter,
  descriptor: EffectActionCapabilityDescriptor
) {
  const source = buildCompiledActionCompilerSource(descriptor)
  const executionPlan = adapter.compileExecutionPlan?.({
    action: descriptor,
    compilerSource: source
  }) ?? {
    kind: 'SINGLE_GRAPH' as const,
    published: adapter.compile({ action: descriptor })
  }
  const published =
    executionPlan.kind === 'SINGLE_GRAPH' ? executionPlan.published : executionPlan.test.published
  const activeEffectPlans = adapter.activeEffectPlans?.({ action: descriptor, published }) ?? []
  const hitPointTiers = hitPointTierCeilings(descriptor.compiledEffect.entries)
  const tiered = hitPointTiers.length > 0
  const rowed = activeEffectPlans.some((plan) => plan.rollTableRow)
  if (
    tiered
      ? activeEffectPlans.some(
          (plan) => !plan.hitPointTier || !hitPointTiers.includes(plan.hitPointTier.atMost)
        ) ||
        new Set(activeEffectPlans.map((plan) => plan.hitPointTier?.atMost)).size !==
          activeEffectPlans.length
      : rowed
        ? activeEffectPlans.some((plan) => !plan.rollTableRow || plan.hitPointTier) ||
          new Set(activeEffectPlans.map((plan) => plan.rollTableRow?.min)).size !==
            activeEffectPlans.length
        : activeEffectPlans.length > 1 || activeEffectPlans.some((plan) => plan.hitPointTier)
  ) {
    throw new CharacterRuleActionUnsupportedCompilationError(
      'Character actions support at most one active-effect plan, or one per hit-point tier or roll-table row.'
    )
  }
  // A grant freezes its own graph and reads only the TEST's hit path, a condition's repeated
  // save is its own graph that reads only the cast's save DC, and a creature form is gated on
  // the TEST's failed-save path, so only those join the two-phase execution.
  if (
    executionPlan.kind === 'TEST_OUTCOME' &&
    activeEffectPlans.some(
      (plan) =>
        !plan.modifierGrantContribution &&
        !plan.conditionContributions?.length &&
        !plan.creatureFormContribution
    )
  ) {
    throw new CharacterRuleActionUnsupportedCompilationError(
      'TEST/OUTCOME actions combine only with grant, repeated-save or creature-form active-effect plans.'
    )
  }
  return {
    activeEffectPlan: tiered || rowed ? null : (activeEffectPlans[0] ?? null),
    ...(tiered && { hitPointTierPlans: activeEffectPlans, hitPointTiers }),
    ...(rowed && { rollTableRowPlans: activeEffectPlans }),
    executionPlan
  }
}

/**
 * The test every option of a pick shares: a TEST/OUTCOME plan's own, else the one the System derives
 * for an attack or save that a single graph runs whole (a hit that only holds its target); null for
 * an action with no test.
 */
function sharedTestKey(
  adapter: CharacterRuleActionSystemAdapter,
  descriptor: EffectActionCapabilityDescriptor,
  executionPlan: ReturnType<typeof compileActionPlans>['executionPlan']
) {
  if (executionPlan.kind === 'TEST_OUTCOME') return executionPlan.test
  try {
    return (
      adapter.compileTestTemplate?.({
        compilerSource: buildCompiledActionCompilerSource(descriptor)
      }) ?? null
    )
  } catch (error) {
    if (error instanceof CharacterRuleActionUnsupportedCompilationError) return null
    throw error
  }
}

/**
 * The plans of an action and, when it authors a cast pick (D148), one pair per option. The
 * action's own plans are its first option's. Throws `CharacterRuleActionUnsupportedCompilationError`
 * when the options cannot be picked between at use. Every entry point that compiles an action
 * (Character, Creature feature) calls this, so the pick's invariants have one home.
 */
export function compileCastChoicePlans(
  adapter: CharacterRuleActionSystemAdapter,
  descriptor: EffectActionCapabilityDescriptor,
  targetPolicy: ReturnType<typeof buildCompiledActionTargetPolicy>
) {
  const compiled = castChoiceOptions(descriptor.compiledEffect)?.map((option) => {
    const optionDescriptor = { ...descriptor, compiledEffect: option.compiledEffect }
    const { hitPointTierPlans, hitPointTiers, rollTableRowPlans, ...plans } = compileActionPlans(
      adapter,
      optionDescriptor
    )
    if (hitPointTierPlans || hitPointTiers || rollTableRowPlans)
      throw new CharacterRuleActionUnsupportedCompilationError(
        'A cast pick cannot also tier on hit points or roll on a table.'
      )
    return {
      option: {
        optionId: option.optionId,
        label: option.label,
        ...(option.requiresOptionalRule && { requiresOptionalRule: option.requiresOptionalRule }),
        ...plans
      },
      sharedTest: sharedTestKey(adapter, optionDescriptor, plans.executionPlan)
    }
  })
  const options = compiled?.map(({ option }) => option)
  // The pick is made at cast on the creatures targeted, after the test and Concentration
  // are settled (D148); only a creature target carries it.
  if (options && !['ACTOR', 'ACTORS'].includes(encounterActionChoiceTarget(targetPolicy).kind))
    throw new CharacterRuleActionUnsupportedCompilationError(
      'Only a cast at chosen creatures carries a pick.'
    )
  if (
    compiled &&
    new Set(
      compiled.map(({ option, sharedTest }) =>
        checksumCanonicalJson([sharedTest, option.activeEffectPlan?.maintenance ?? null])
      )
    ).size !== 1
  )
    throw new CharacterRuleActionUnsupportedCompilationError(
      'The options a cast picks between share their test and their Concentration.'
    )
  const plans = options?.[0] ?? compileActionPlans(adapter, descriptor)
  return {
    activeEffectPlan: plans.activeEffectPlan,
    ...('hitPointTierPlans' in plans && {
      hitPointTierPlans: plans.hitPointTierPlans,
      hitPointTiers: plans.hitPointTiers
    }),
    ...('rollTableRowPlans' in plans && { rollTableRowPlans: plans.rollTableRowPlans }),
    executionPlan: plans.executionPlan,
    choice: options ? { options } : null
  }
}

/**
 * The holder conditions an activated action's `ON_USE` paths name (Frenzy only while raging and
 * not yet frenzied), one list per restricted entry, as a basic action's restrictions read them.
 */
function activatedActionAdmission(compiledEffect: CompiledEffectGroup) {
  const restrictions = compiledEffect.entries.flatMap((entry) =>
    'restrictions' in entry && entry.restrictions && entry.pathCode === 'ON_USE'
      ? [normalizeCharacterGrantRestrictions(entry.restrictions)]
      : []
  )
  return restrictions.length > 0 ? { holderRestrictions: restrictions } : {}
}

export function compileCharacterActionEntryPoints(
  input: {
    gameSystemId: string
    candidates: readonly CharacterActionCandidate[]
    descriptors: readonly CharacterActionCapabilityDescriptor[]
  },
  adapter = characterRuleActionSystemAdapterRegistry.find(input.gameSystemId)
): CompiledActionEntryPoint[] {
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
      const admission = activatedActionAdmission(descriptor.compiledEffect)
      try {
        const zonePlacement = adapter.compileZonePlacement?.({ action: descriptor }) ?? null
        if (zonePlacement) {
          // The save each creature in the area makes when the zone appears is the cast's area
          // occurrence (D154 amendment). Without one, the cast runs nothing: the zone's entry graph
          // runs when a creature enters it, and a cast-time pick (D140) names its first option's.
          const appearSave = zoneAppearSave(descriptor.compiledEffect)
          // It is tested over the zone's area when the invocation names none, as the cast aims it,
          // and applies a held condition bare: the zone placement holds it (D146).
          const appear =
            appearSave &&
            compileActionPlans(adapter, {
              ...descriptor,
              zoneAppearSave: true,
              compiledEffect: {
                ...appearSave,
                entries: appearSave.entries.map((entry) => {
                  if (!('lifecycle' in entry) || !entry.lifecycle?.heldBySource) return entry
                  const { lifecycle: _held, ...unheld } = entry
                  return unheld
                }),
                invocation: {
                  ...appearSave.invocation,
                  shape: appearSave.invocation.shape ?? exactTargetPolicy.shape ?? undefined
                }
              }
            })
          if (appear && appear.executionPlan.kind !== 'TEST_OUTCOME')
            throw new CharacterRuleActionUnsupportedCompilationError(
              'A zone’s appear save is a saving throw with its outcomes.'
            )
          // A condition the zone holds is owned by its hold alone (D146), never by a cast effect
          // the Concentration also maintains, so escaping the hold ends it.
          const held = 'options' in zonePlacement ? null : (zonePlacement.heldCondition ?? null)
          const castPlan = appear?.activeEffectPlan ?? null
          if (
            held &&
            castPlan &&
            (castPlan.modifierGrantContribution ||
              castPlan.conditionContributions?.some(
                ({ conditionId }) => conditionId !== held.conditionId
              ))
          )
            throw new CharacterRuleActionUnsupportedCompilationError(
              'A zone’s appear save holds its condition and nothing else.'
            )
          return {
            schemaVersion: 4,
            kind: 'CHARACTER_ACTION',
            actionId: candidate.actionId,
            effectId: candidate.effectId,
            targetPolicy: exactTargetPolicy,
            ...admission,
            compilation: {
              kind: 'COMPILED',
              resourceBinding: compiledResourceBinding(candidate),
              activeEffectPlan: held ? null : castPlan,
              zonePlacement,
              choice: null,
              executionPlan: appear?.executionPlan ?? {
                kind: 'SINGLE_GRAPH',
                published: ('options' in zonePlacement
                  ? zonePlacement.options[0]!.zone
                  : zonePlacement
                ).entry.frozenGraph
              }
            }
          }
        }
        const summonPlacement = adapter.compileSummonPlacement?.({ action: descriptor }) ?? null
        if (summonPlacement)
          return {
            schemaVersion: 4,
            kind: 'CHARACTER_ACTION',
            actionId: candidate.actionId,
            effectId: candidate.effectId,
            targetPolicy: exactTargetPolicy,
            ...admission,
            compilation: {
              kind: 'COMPILED',
              resourceBinding: compiledResourceBinding(candidate),
              activeEffectPlan: null,
              zonePlacement: null,
              summonPlacement,
              choice: null,
              executionPlan: { kind: 'SINGLE_GRAPH', published: summonPlacement.entry.frozenGraph }
            }
          }
        const {
          activeEffectPlan,
          hitPointTierPlans,
          hitPointTiers,
          rollTableRowPlans,
          executionPlan,
          choice
        } = compileCastChoicePlans(adapter, descriptor, exactTargetPolicy)
        return {
          schemaVersion: 4,
          kind: 'CHARACTER_ACTION',
          actionId: candidate.actionId,
          effectId: candidate.effectId,
          targetPolicy: exactTargetPolicy,
          ...admission,
          compilation: {
            kind: 'COMPILED',
            resourceBinding: compiledResourceBinding(candidate),
            activeEffectPlan,
            ...(hitPointTierPlans && { hitPointTierPlans, hitPointTiers }),
            ...(rollTableRowPlans && { rollTableRowPlans }),
            zonePlacement: null,
            choice,
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
