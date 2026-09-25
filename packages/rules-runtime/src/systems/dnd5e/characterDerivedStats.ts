import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterGrantFoldOutput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'

import {
  DND5E_CHARACTER_WIDE_TARGET,
  dnd5eFoldedModifierApplicability,
  dnd5eModifierApplies
} from './modifierApplicability.js'

type DerivedStats = Omit<CharacterRulePolicyOutput['derivedStats'], 'armorClass' | 'maxHitPoints'>
type NumericCalculation = DerivedStats['abilities'][number]['score']
type NumericContribution = NumericCalculation['contributions'][number]
type ProficiencyCalculation = DerivedStats['savingThrows'][number]['proficiency']
type NumericBonus =
  CharacterRulePolicyInput['derivedBaseFacts']['abilities'][number]['bonuses'][number]
type ResolvedBonus = NumericContribution & { readonly operation: 'ADD' | 'SET' }
type ResolvedModifierGroup = CharacterRulePolicyOutput['modifierGroups'][number]

const rankValues = { NONE: 0, HALF: 1, FULL: 2, DOUBLE: 3 } as const

function proficiencyBonus(totalLevel: number): number {
  return Math.floor((Math.max(totalLevel, 1) - 1) / 4) + 2
}

function modifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

function requireModifierSource(
  contribution: ResolvedModifierGroup['contributions'][number]
): NonNullable<NumericContribution['source']> {
  if (contribution.source === undefined) {
    throw new Error('Resolved modifier contribution is missing its source.')
  }
  return contribution.source
}

/** Derived statistics are Character-wide: only modifiers that apply everywhere count. */
function expandBonuses(
  bonuses: readonly NumericBonus[],
  grantFold: Pick<CharacterGrantFoldOutput, 'modifiers'>,
  modifierGroups: readonly ResolvedModifierGroup[]
): ResolvedBonus[] {
  const resolved: ResolvedBonus[] = []
  for (const bonus of bonuses) {
    if (bonus.kind === 'PROFICIENCY')
      throw new Error('Standalone proficiency bonus has no source provenance.')
    if (bonus.kind === 'FIXED') {
      resolved.push({
        sourceId: bonus.sourceId,
        source: bonus.source,
        value: bonus.value,
        operation: bonus.operation,
        state: 'APPLIED',
        reasonCode: 'APPLIED'
      })
      continue
    }
    const group = modifierGroups.find((candidate) => candidate.domainKey === bonus.domainKey)
    if (group === undefined) continue
    for (const contribution of group.contributions) {
      if (
        !dnd5eModifierApplies(
          dnd5eFoldedModifierApplicability(grantFold, contribution),
          DND5E_CHARACTER_WIDE_TARGET
        )
      )
        continue
      const source = requireModifierSource(contribution)
      if (
        contribution.acceptedModifierIndex === undefined ||
        contribution.grantId === undefined ||
        contribution.domainKey === undefined
      ) {
        throw new Error('Resolved modifier contribution is missing provenance.')
      }
      resolved.push({
        sourceId: contribution.sourceId,
        source,
        acceptedModifierIndex: contribution.acceptedModifierIndex,
        grantId: contribution.grantId,
        domainKey: contribution.domainKey,
        value: contribution.value,
        operation: bonus.operation,
        state: contribution.state,
        reasonCode: contribution.reasonCode
      })
    }
  }
  return resolved
}

function numericContributions(
  bonuses: readonly ResolvedBonus[],
  override: NumericCalculation['override']
): NumericCalculation['contributions'] {
  return bonuses.map(({ operation: _operation, ...bonus }) => ({
    ...bonus,
    state: override === null ? bonus.state : 'SUPPRESSED',
    reasonCode: override === null ? bonus.reasonCode : 'SUPPRESSED_BY_OVERRIDE'
  }))
}

function abilityModifierAt(
  abilities: readonly DerivedStats['abilities'][number][],
  index: number | null
): number {
  if (index === null || index < 0 || index >= abilities.length) return 0
  return abilities[index]?.modifier.effective ?? 0
}

function highestRank(
  proficiencies: readonly CharacterGrantFoldOutput['proficiencies'][number][]
): ProficiencyCalculation['effective'] {
  return proficiencies.reduce<ProficiencyCalculation['effective']>(
    (highest, proficiency) =>
      rankValues[proficiency.scaling] > rankValues[highest] ? proficiency.scaling : highest,
    'NONE'
  )
}

function proficiencyContributions(
  proficiencies: readonly CharacterGrantFoldOutput['proficiencies'][number][],
  selectedIndex: number | null,
  overridden: boolean
): ProficiencyCalculation['contributions'] {
  return proficiencies.map((proficiency) => ({
    acceptedProficiencyIndex: proficiency.acceptedProficiencyIndex,
    sourceId: proficiency.grantId,
    source: proficiency.source,
    grantId: proficiency.grantId,
    value: proficiency.scaling,
    state:
      overridden || proficiency.acceptedProficiencyIndex !== selectedIndex
        ? 'SUPPRESSED'
        : 'APPLIED',
    reasonCode: overridden
      ? 'SUPPRESSED_BY_OVERRIDE'
      : proficiency.acceptedProficiencyIndex === selectedIndex
        ? 'SELECTED_HIGHEST_RANK'
        : 'SUPPRESSED_BY_HIGHER_RANK'
  }))
}

function resolvedDerivedBonuses(
  bonuses: readonly NumericBonus[],
  grantFold: Pick<CharacterGrantFoldOutput, 'modifiers'>,
  modifierGroups: readonly ResolvedModifierGroup[],
  proficiencyValue: number,
  proficiencyOverride: ProficiencyCalculation['override'],
  selectedProficiency: CharacterGrantFoldOutput['proficiencies'][number] | null
): ResolvedBonus[] {
  const resolved: ResolvedBonus[] = []
  for (const bonus of bonuses) {
    if (bonus.kind !== 'PROFICIENCY') {
      resolved.push(...expandBonuses([bonus], grantFold, modifierGroups))
      continue
    }
    if (proficiencyValue === 0) continue
    const source = proficiencyOverride?.source ?? selectedProficiency?.source
    const sourceId = proficiencyOverride?.sourceId ?? bonus.sourceId
    if (source === undefined) {
      throw new Error('Proficiency bonus is missing selected provenance.')
    }
    resolved.push({
      sourceId,
      source,
      value: proficiencyValue,
      operation: 'ADD',
      state: 'APPLIED',
      reasonCode: 'APPLIED'
    })
  }
  return resolved
}

export function resolveDnd5eCharacterAbilityBonuses(
  record: CharacterRulePolicyInput['derivedBaseFacts']['abilities'][number],
  grantFold: Pick<CharacterGrantFoldOutput, 'modifiers'>,
  modifierGroups: CharacterRulePolicyOutput['modifierGroups']
): ResolvedBonus[] {
  const bonuses = expandBonuses(record.bonuses, grantFold, modifierGroups)
  const selectedSetIndex = bonuses
    .filter(
      (bonus) =>
        bonus.operation === 'SET' &&
        bonus.state === 'APPLIED' &&
        bonus.acceptedModifierIndex !== undefined
    )
    .reduce<number | null>(
      (selected, bonus) =>
        Math.max(selected ?? Number.NEGATIVE_INFINITY, bonus.acceptedModifierIndex!),
      null
    )
  return bonuses.map((bonus) => {
    const suppressedByStacking =
      bonus.operation === 'SET' &&
      bonus.acceptedModifierIndex !== undefined &&
      bonus.acceptedModifierIndex !== selectedSetIndex
    return {
      ...bonus,
      value: bonus.operation === 'SET' ? bonus.value - record.baseScore : bonus.value,
      state: suppressedByStacking ? ('SUPPRESSED' as const) : bonus.state,
      reasonCode: suppressedByStacking ? ('SUPPRESSED_BY_STACKING' as const) : bonus.reasonCode
    }
  })
}

export function evaluateDnd5eCharacterDerivedStats(
  input: CharacterRulePolicyInput,
  grantFold: CharacterGrantFoldOutput,
  modifierGroups: CharacterRulePolicyOutput['modifierGroups']
): DerivedStats {
  const baseFacts = input.derivedBaseFacts
  const calculatedProficiencyBonus = proficiencyBonus(input.totalLevel)
  const abilities = baseFacts.abilities.map((record) => {
    const resolvedBonuses = resolveDnd5eCharacterAbilityBonuses(record, grantFold, modifierGroups)
    const effectiveScore =
      record.scoreOverride === null
        ? record.baseScore +
          resolvedBonuses
            .filter((bonus) => bonus.state === 'APPLIED')
            .reduce((total, bonus) => total + bonus.value, 0)
        : record.scoreOverride.value
    const effectiveModifier = modifier(effectiveScore)
    return {
      abilityId: record.abilityId,
      score: {
        base: record.baseScore,
        effective: effectiveScore,
        contributions: numericContributions(resolvedBonuses, record.scoreOverride),
        override: record.scoreOverride
      },
      modifier: {
        base: effectiveModifier,
        effective: effectiveModifier,
        contributions: [],
        override: null
      }
    }
  })

  const savingThrows = baseFacts.savingThrows.map((record) => {
    const proficiencies = grantFold.proficiencies.filter(
      (proficiency) =>
        proficiency.kind === 'SAVE_ABILITY' &&
        (proficiency.matchId === '*' ||
          proficiency.matchId === record.abilityId ||
          proficiency.matchId === record.proficiencySubjectId)
    )
    const rank = record.proficiencyOverride?.value ?? highestRank(proficiencies)
    const selected =
      record.proficiencyOverride === null || rank === 'NONE'
        ? rank === 'NONE'
          ? null
          : (proficiencies.find((proficiency) => proficiency.scaling === rank) ?? null)
        : null
    const proficiencyValue = Math.floor(
      calculatedProficiencyBonus *
        (rank === 'DOUBLE' ? 2 : rank === 'FULL' ? 1 : rank === 'HALF' ? 0.5 : 0)
    )
    const bonuses = resolvedDerivedBonuses(
      record.bonuses,
      grantFold,
      modifierGroups,
      proficiencyValue,
      record.proficiencyOverride,
      selected
    )
    const total =
      record.totalOverride?.value ??
      abilityModifierAt(abilities, record.abilityIndex) +
        bonuses
          .filter((bonus) => bonus.state === 'APPLIED')
          .reduce((sum, bonus) => sum + bonus.value, 0)
    return {
      abilityId: record.abilityId,
      proficiency: {
        base: 'NONE' as const,
        effective: rank,
        contributions: proficiencyContributions(
          proficiencies,
          selected?.acceptedProficiencyIndex ?? null,
          record.proficiencyOverride !== null
        ),
        override: record.proficiencyOverride
      },
      total: {
        base: abilityModifierAt(abilities, record.abilityIndex),
        effective: total,
        contributions: numericContributions(bonuses, record.totalOverride),
        override: record.totalOverride
      }
    }
  })

  const skills = baseFacts.skills.map((record) => {
    const proficiencies = grantFold.proficiencies.filter(
      (proficiency) =>
        proficiency.kind === 'SKILL' &&
        (proficiency.matchId === '*' || record.proficiencySubjectIds.includes(proficiency.matchId))
    )
    const rank = record.proficiencyOverride?.value ?? highestRank(proficiencies)
    const selected =
      record.proficiencyOverride === null || rank === 'NONE'
        ? rank === 'NONE'
          ? null
          : (proficiencies.find((proficiency) => proficiency.scaling === rank) ?? null)
        : null
    const proficiencyValue = Math.floor(
      calculatedProficiencyBonus *
        (rank === 'DOUBLE' ? 2 : rank === 'FULL' ? 1 : rank === 'HALF' ? 0.5 : 0)
    )
    const bonuses = resolvedDerivedBonuses(
      record.bonuses,
      grantFold,
      modifierGroups,
      proficiencyValue,
      record.proficiencyOverride,
      selected
    )
    const abilityIndex =
      record.governingAbilityOverride === null
        ? record.governingAbilityIndex
        : record.governingAbilityOverride.abilityIndex
    const abilityModifier = abilityModifierAt(abilities, abilityIndex)
    const total =
      record.totalOverride?.value ??
      abilityModifier +
        bonuses
          .filter((bonus) => bonus.state === 'APPLIED')
          .reduce((sum, bonus) => sum + bonus.value, 0)
    return {
      skillId: record.skillId,
      governingAbility: {
        base: record.governingAbilityId,
        effective: record.governingAbilityOverride?.value ?? record.governingAbilityId,
        override:
          record.governingAbilityOverride === null
            ? null
            : {
                sourceId: record.governingAbilityOverride.sourceId,
                value: record.governingAbilityOverride.value
              }
      },
      proficiency: {
        base: 'NONE' as const,
        effective: rank,
        contributions: proficiencyContributions(
          proficiencies,
          selected?.acceptedProficiencyIndex ?? null,
          record.proficiencyOverride !== null
        ),
        override: record.proficiencyOverride
      },
      total: {
        base: abilityModifier,
        effective: total,
        contributions: numericContributions(bonuses, record.totalOverride),
        override: record.totalOverride
      },
      passive: {
        base: 10 + total,
        effective: record.passiveOverride?.value ?? 10 + total,
        contributions: [],
        override: record.passiveOverride
      }
    }
  })

  const initiativeBonuses = expandBonuses(baseFacts.initiative.bonuses, grantFold, modifierGroups)
  const initiativeBase = abilityModifierAt(abilities, baseFacts.initiative.abilityIndex)
  const spellcasting = baseFacts.spellcasting
  const spellcastingModifier =
    spellcasting === null ? 0 : abilityModifierAt(abilities, spellcasting.abilityIndex)
  const spellSaveDcBonuses =
    spellcasting === null
      ? []
      : expandBonuses(spellcasting.saveDcBonuses, grantFold, modifierGroups)
  const spellAttackBonuses =
    spellcasting === null
      ? []
      : expandBonuses(spellcasting.attackBonuses, grantFold, modifierGroups)
  const appliedTotal = (bonuses: readonly ResolvedBonus[]): number =>
    bonuses
      .filter((bonus) => bonus.state === 'APPLIED')
      .reduce((total, bonus) => total + bonus.value, 0)

  return {
    proficiencyBonus: {
      base: calculatedProficiencyBonus,
      effective: calculatedProficiencyBonus,
      contributions: [],
      override: null
    },
    abilities,
    savingThrows,
    skills,
    initiative: {
      base: initiativeBase,
      effective: initiativeBase + appliedTotal(initiativeBonuses),
      contributions: numericContributions(initiativeBonuses, null),
      override: null
    },
    spellcasting:
      spellcasting === null
        ? null
        : {
            abilityId: spellcasting.abilityId,
            saveDc: {
              base: 8 + calculatedProficiencyBonus + spellcastingModifier,
              effective:
                8 +
                calculatedProficiencyBonus +
                spellcastingModifier +
                appliedTotal(spellSaveDcBonuses),
              contributions: numericContributions(spellSaveDcBonuses, null),
              override: null
            },
            attackBonus: {
              base: calculatedProficiencyBonus + spellcastingModifier,
              effective:
                calculatedProficiencyBonus +
                spellcastingModifier +
                appliedTotal(spellAttackBonuses),
              contributions: numericContributions(spellAttackBonuses, null),
              override: null
            }
          }
  }
}
