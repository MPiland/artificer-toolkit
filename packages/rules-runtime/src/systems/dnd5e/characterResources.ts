import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'

import { abilityModifier } from './abilityModifier.js'
import { characterPolicyRecord } from './characterPolicyValues.js'

type DerivedStats = Omit<CharacterRulePolicyOutput['derivedStats'], 'armorClass' | 'maxHitPoints'>
type ResourcesOutput = Pick<CharacterRulePolicyOutput, 'chargeMaximums' | 'resources'>
type ChargeMaximum = CharacterRulePolicyOutput['chargeMaximums'][number]
type Resource = CharacterRulePolicyOutput['resources'][number]
type ChargeCalculation = CharacterRulePolicyInput['chargeCalculations'][number]
const resetKinds = new Set(['DAILY', 'DAWN', 'DUSK', 'LONG_REST', 'SHORT_REST', 'MANUAL'])

function clampedInteger(value: number, minimum: number | null, maximum: number | null): number {
  return Math.floor(
    Math.min(
      Math.max(value, minimum ?? Number.NEGATIVE_INFINITY),
      maximum ?? Number.POSITIVE_INFINITY
    )
  )
}

function isResetKind(value: unknown): value is Resource['resetKind'] {
  return typeof value === 'string' && resetKinds.has(value)
}

function classLevel(input: CharacterRulePolicyInput, classId: string): number | null {
  return input.grantFoldFacts.base.classes.find((entry) => entry.classId === classId)?.level ?? null
}

function baseFactValue(
  input: CharacterRulePolicyInput,
  derived: DerivedStats,
  charge: ChargeCalculation
): number | null {
  const base = charge.base
  if (base.kind === 'ABILITY_MODIFIER')
    return (
      derived.abilities.find((ability) => ability.abilityId === base.abilityId)?.score.effective ??
      null
    )
  if (base.kind === 'CLASS_LEVEL') return classLevel(input, base.classId)
  if (base.kind === 'PARENT_CLASS_LEVEL' || base.kind === 'PER_LEVEL')
    return base.sourceLevel.kind === 'CHARACTER_LEVEL'
      ? input.totalLevel
      : classLevel(input, base.sourceLevel.classId)
  if (base.kind === 'SPELL_CAST_LEVEL') return base.spellCastLevel
  return base.kind === 'CHARACTER_LEVEL' ? input.totalLevel : base.amount
}

function bonusFactValues(
  input: CharacterRulePolicyInput,
  derived: DerivedStats
): Array<{
  readonly calculationId: string
  readonly sourceId: string
  readonly factValue: number | null
}> {
  return [
    ...input.chargeCalculations.flatMap((charge) =>
      charge.bonuses
        .filter((bonus) => bonus.kind === 'ABILITY_MODIFIER')
        .map((bonus) => ({
          calculationId: charge.calculationId,
          sourceId: bonus.sourceId,
          factValue:
            derived.abilities.find((ability) => ability.abilityId === bonus.abilityId)?.score
              .effective ?? null
        }))
    ),
    ...input.chargeCalculations.flatMap((charge) =>
      charge.bonuses
        .filter((bonus) => bonus.kind === 'SKILL_BONUS')
        .map((bonus) => ({
          calculationId: charge.calculationId,
          sourceId: bonus.sourceId,
          factValue:
            derived.skills.find((skill) => skill.skillId === bonus.skillId)?.total.effective ?? null
        }))
    ),
    ...input.chargeCalculations.flatMap((charge) =>
      charge.bonuses
        .filter((bonus) => bonus.kind === 'PROFICIENCY_BONUS')
        .map((bonus) => ({
          calculationId: charge.calculationId,
          sourceId: bonus.sourceId,
          factValue: derived.proficiencyBonus.effective
        }))
    )
  ]
}

function calculateChargeMaximums(
  input: CharacterRulePolicyInput,
  derived: DerivedStats
): ChargeMaximum[] {
  const facts = bonusFactValues(input, derived)
  return input.chargeCalculations.map((charge) => {
    const baseFact = baseFactValue(input, derived, charge)
    const bonuses = charge.bonuses.map((bonus) => ({
      bonus,
      factValue:
        facts.find(
          (fact) => fact.calculationId === charge.calculationId && fact.sourceId === bonus.sourceId
        )?.factValue ?? null
    }))
    if (baseFact === null || bonuses.some((entry) => entry.factValue === null)) {
      return {
        calculationId: charge.calculationId,
        sourceId: charge.sourceId,
        state: 'UNRESOLVED',
        maximum: null,
        reasonCode: 'MISSING_REQUIRED_FACT',
        baseContribution: null,
        bonusContributions: []
      }
    }
    const selectedLevel =
      charge.base.kind !== 'PER_LEVEL'
        ? null
        : charge.base.levels
            .filter((level) => level.level <= baseFact)
            .reduce<(typeof charge.base.levels)[number] | null>(
              (selected, level) =>
                selected === null || level.level > selected.level ? level : selected,
              null
            )
    const baseRaw =
      charge.base.kind === 'PER_LEVEL'
        ? (selectedLevel?.amount ?? 0)
        : charge.base.kind === 'ABILITY_MODIFIER'
          ? abilityModifier(baseFact)
          : baseFact
    const baseValue =
      'multiplier' in charge.base
        ? clampedInteger(
            baseRaw * (charge.base.multiplier ?? 1),
            charge.base.minimum,
            charge.base.maximum
          )
        : Math.floor(baseRaw)
    const bonusContributions = bonuses.map(({ bonus, factValue }) => {
      const raw = bonus.kind === 'ABILITY_MODIFIER' ? abilityModifier(factValue!) : factValue!
      return {
        sourceId: bonus.sourceId,
        value: clampedInteger(raw * (bonus.multiplier ?? 1), bonus.minimum, bonus.maximum)
      }
    })
    return {
      calculationId: charge.calculationId,
      sourceId: charge.sourceId,
      state: 'RESOLVED',
      maximum: Math.max(
        0,
        Math.floor(baseValue + bonusContributions.reduce((sum, bonus) => sum + bonus.value, 0))
      ),
      reasonCode: 'CALCULATED',
      baseContribution: {
        sourceId:
          charge.base.kind === 'PER_LEVEL' && selectedLevel !== null
            ? selectedLevel.sourceId
            : charge.sourceId,
        value: baseValue
      },
      bonusContributions
    }
  })
}

function resourceScopedTo(
  modifier: CharacterGrantFoldOutput['modifiers'][number],
  resourceId: string
): boolean {
  const grant = characterPolicyRecord(modifier.grant)
  const restrictions = characterPolicyRecord(grant.restrictions)
  const contexts = (Array.isArray(restrictions.groups) ? restrictions.groups : []).flatMap(
    (group) => {
      const record = characterPolicyRecord(group)
      return (Array.isArray(record.contexts) ? record.contexts : []).filter(
        (context) => characterPolicyRecord(context).subject === 'RESOURCE'
      )
    }
  )
  if (contexts.length === 0) return true
  return contexts.some((context) => {
    const record = characterPolicyRecord(context)
    const direct = Array.isArray(record.resourceIds) && record.resourceIds.includes(resourceId)
    const nested = (Array.isArray(record.conditions) ? record.conditions : []).some((condition) => {
      const conditionRecord = characterPolicyRecord(condition)
      return (
        Array.isArray(conditionRecord.resourceIds) &&
        conditionRecord.resourceIds.includes(resourceId)
      )
    })
    return direct || nested
  })
}

function resolvedReset(
  pool: CharacterRulePolicyInput['resourcePoolCandidates'][number],
  fold: Pick<CharacterGrantFoldOutput, 'modifiers'>
): Pick<Resource, 'resetKind' | 'resetResolution'> {
  if (pool.ownerKind !== 'AUTHORED_GRANT' && pool.ownerKind !== 'AUTHORED_SOURCE') {
    return {
      resetKind: pool.baseResetKind,
      resetResolution: { baseResetKind: pool.baseResetKind, appliedGrantId: null, source: null }
    }
  }
  const replacements = fold.modifiers.filter((modifier) => {
    const grant = characterPolicyRecord(modifier.grant)
    const payload = characterPolicyRecord(grant.payload)
    return (
      grant.valueDomainCode === 'CHARGE_RESET' &&
      grant.modifierKind === 'REPLACE_CHARGE_RESET_KIND' &&
      payload.resetKind != null &&
      resourceScopedTo(modifier, pool.resourceDefinitionId)
    )
  })
  const replacement = replacements.at(-1)
  if (replacement === undefined) {
    return {
      resetKind: pool.baseResetKind,
      resetResolution: { baseResetKind: pool.baseResetKind, appliedGrantId: null, source: null }
    }
  }
  const grant = characterPolicyRecord(replacement.grant)
  if (typeof grant.id !== 'string')
    throw new Error('Charge reset replacement is missing its grant ID.')
  const payload = characterPolicyRecord(grant.payload)
  const resetKind = isResetKind(payload.resetKind) ? payload.resetKind : 'MANUAL'
  return {
    resetKind,
    resetResolution: {
      baseResetKind: pool.baseResetKind,
      appliedGrantId: grant.id,
      source: replacement.source
    }
  }
}

export function evaluateDnd5eCharacterResources(
  input: CharacterRulePolicyInput,
  fold: CharacterGrantFoldOutput,
  derived: DerivedStats,
  spellAccess: CharacterRulePolicyOutput['spellAccess']
): ResourcesOutput {
  const chargeMaximums = calculateChargeMaximums(input, derived)
  return {
    chargeMaximums,
    resources: evaluateDnd5eCharacterResourcePools(input, fold, spellAccess, chargeMaximums)
  }
}

function evaluateDnd5eCharacterResourcePools(
  input: Pick<CharacterRulePolicyInput, 'resourcePoolCandidates' | 'resourceUsageFacts'>,
  fold: Pick<CharacterGrantFoldOutput, 'activeSourceIds' | 'modifiers'>,
  spellAccess: Pick<CharacterRulePolicyOutput['spellAccess'][number], 'accessId'>[],
  chargeMaximums: CharacterRulePolicyOutput['chargeMaximums']
): CharacterRulePolicyOutput['resources'] {
  return input.resourcePoolCandidates
    .filter(
      (pool) =>
        (pool.ownerKind !== 'AUTHORED_GRANT' || pool.activeSourceLevel >= pool.availableAtLevel) &&
        (pool.ownerKind !== 'AUTHORED_SOURCE' || fold.activeSourceIds.includes(pool.sourceId)) &&
        (pool.ownerKind !== 'ITEM_INSTANCE' ||
          pool.sourceId === null ||
          fold.activeSourceIds.includes(pool.sourceId)) &&
        (pool.ownerKind !== 'SPELL_SOURCE' ||
          spellAccess.some((access) => access.accessId === pool.accessId))
    )
    .map((pool) => {
      const matched = chargeMaximums.filter(
        (maximum) => maximum.calculationId === pool.chargeCalculationId
      )
      const maximum = matched.length === 1 ? matched[0]! : null
      const rawUsedEntries = (input.resourceUsageFacts ?? []).filter(
        (usage) => usage.poolId === pool.poolId
      )
      const rawUsed = rawUsedEntries.length === 1 ? rawUsedEntries[0]!.rawUsed : 0
      const state: Resource['state'] = maximum?.state === 'RESOLVED' ? 'RESOLVED' : 'UNRESOLVED'
      const maximumValue = state === 'RESOLVED' ? maximum!.maximum : null
      const effectiveUsed = maximumValue === null ? null : Math.min(rawUsed, maximumValue)
      const remaining =
        maximumValue === null || effectiveUsed === null
          ? null
          : Math.max(maximumValue - effectiveUsed, 0)
      const reset = resolvedReset(pool, fold)
      const reasonCode: Resource['reasonCode'] =
        state === 'RESOLVED' ? 'CALCULATED' : 'MISSING_REQUIRED_FACT'
      const common = {
        sequence: pool.sequence,
        poolId: pool.poolId,
        resourceDefinitionId: pool.resourceDefinitionId,
        chargeId: pool.chargeId,
        chargeCalculationId: pool.chargeCalculationId,
        state,
        maximum: maximumValue,
        rawUsed,
        effectiveUsed,
        remaining,
        reasonCode,
        baseContribution: maximum?.baseContribution ?? null,
        bonusContributions: maximum?.bonusContributions ?? [],
        ...reset
      }
      if (pool.ownerKind === 'AUTHORED_GRANT')
        return {
          ...common,
          ownerKind: pool.ownerKind,
          resourceGrantId: pool.resourceGrantId,
          availableAtLevel: pool.availableAtLevel,
          activeSourceLevel: pool.activeSourceLevel
        }
      if (pool.ownerKind === 'AUTHORED_SOURCE')
        return {
          ...common,
          ownerKind: pool.ownerKind,
          sourceId: pool.sourceId,
          source: pool.source
        }
      if (pool.ownerKind === 'ITEM_INSTANCE')
        return {
          ...common,
          ownerKind: pool.ownerKind,
          itemInstanceId: pool.itemInstanceId,
          sourceId: pool.sourceId
        }
      if (pool.ownerKind === 'COMPANION_FEATURE')
        return {
          ...common,
          ownerKind: pool.ownerKind,
          companionInstanceId: pool.companionInstanceId,
          featureId: pool.featureId
        }
      return {
        ...common,
        ownerKind: pool.ownerKind,
        accessId: pool.accessId,
        sourceInstanceId: pool.sourceInstanceId,
        spellId: pool.spellId
      }
    })
}
