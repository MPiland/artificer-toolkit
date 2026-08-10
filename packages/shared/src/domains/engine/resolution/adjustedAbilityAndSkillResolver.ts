import type {
  CharacterCalculation,
  CharacterCalculationContribution,
  CharacterMechanicSourceRef
} from '../../character/sheetCalculation.js'
import {
  CHARACTER_CALCULATION_CONTRIBUTION_STATE,
  createCharacterMechanicSourceKey
} from '../../character/sheetCalculation.js'
import type {
  CharacterMechanicalAdjustment,
  CharacterProficiencyLevel
} from '../../character/sheetAdjustment.js'
import type { EngineCalculationBreakdowns, EngineProficiency } from '../contracts/engineState.js'
import type { RulesSystem } from '../contracts/rulesSystem.js'
import type { CharacterAssemblyRegistry } from '../registry.js'
import type { CharacterBuildSnapshot } from '../snapshot.js'
import { resolveAbilityRecordKey } from './abilityKey.js'
import {
  toCalculationOverride,
  resolveNumericCalculation,
  resolveSelectionCalculation
} from './calculationResolver.js'
import {
  buildSkillSubjectAliasMap,
  resolveAbilityAlias,
  resolveSkillAlias
} from './derivedStatCalculator.js'
import { modifierContributions, type ResolvedModifierState } from './modifierResolver.js'
import { parseModifierDomainKey } from './modifierDomainKey.js'
import { SKILL_ABILITY_MAP } from './skillAbilityMap.js'

type NumericMechanicalAdjustment = Extract<CharacterMechanicalAdjustment, { value: number }>
type ProficiencyMechanicalAdjustment = Extract<
  CharacterMechanicalAdjustment,
  { value: CharacterProficiencyLevel }
>

function systemSource(systemId: string): CharacterMechanicSourceRef {
  return { kind: 'SYSTEM', systemId }
}

function manualContribution(
  adjustment: NumericMechanicalAdjustment
): CharacterCalculationContribution<number> {
  return {
    id: adjustment.id,
    source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: adjustment.id },
    value: adjustment.value,
    state: CHARACTER_CALCULATION_CONTRIBUTION_STATE.APPLIED
  }
}

function abilityMatches(left: string | undefined, right: string): boolean {
  if (!left) return false
  return (resolveAbilityAlias(left) ?? left) === (resolveAbilityAlias(right) ?? right)
}

function createAbilityScoreCalculation(
  abilityKey: string,
  snapshot: CharacterBuildSnapshot,
  modifierState: ResolvedModifierState
): CharacterCalculation<number> {
  const base = snapshot.abilities[abilityKey] ?? 10
  const authoredContributions = modifierContributions(
    modifierState,
    (parsed) =>
      parsed.valueDomainCode === 'ABILITY_SCORE' &&
      abilityMatches(parsed.params.ability, abilityKey)
  )
  const setContributions = authoredContributions.filter((contribution) => {
    const domainKey = Object.entries(modifierState.calculations).find(([, calculation]) =>
      calculation.contributions.some((candidate) => candidate.id === contribution.id)
    )?.[0]
    return domainKey ? parseModifierDomainKey(domainKey).modifierKind === 'SET_VALUE' : false
  })
  const appliedSet = setContributions.find(
    (contribution) => contribution.state === CHARACTER_CALCULATION_CONTRIBUTION_STATE.APPLIED
  )
  const contributions = authoredContributions.map((contribution) =>
    contribution.id === appliedSet?.id
      ? { ...contribution, value: contribution.value - base }
      : contribution
  )
  const manualAdjustments = (snapshot.adjustments ?? []).filter(
    (adjustment) =>
      adjustment.family === 'ABILITY' && abilityMatches(adjustment.ability, abilityKey)
  )
  const additive = manualAdjustments.find((adjustment) => adjustment.field === 'OTHER_MODIFIER')
  const override = manualAdjustments.find((adjustment) => adjustment.field === 'SCORE_OVERRIDE')

  return resolveNumericCalculation(
    base,
    [
      ...contributions,
      ...(additive && typeof additive.value === 'number' ? [manualContribution(additive)] : [])
    ],
    override && typeof override.value === 'number' ? toCalculationOverride(override) : undefined
  )
}

const PROFICIENCY_RANK: Record<CharacterProficiencyLevel, number> = {
  NONE: 0,
  HALF: 1,
  FULL: 2,
  DOUBLE: 3
}

function toProficiencyLevel(
  scaling: EngineProficiency['scaling'] | undefined
): CharacterProficiencyLevel {
  return scaling ?? 'NONE'
}

function resolveProficiencyCalculation(
  proficiencies: readonly EngineProficiency[],
  kind: 'SAVE_ABILITY' | 'SKILL',
  subjectId: string,
  skillAliases: Map<string, string>,
  fallbackSource: CharacterMechanicSourceRef,
  override?: CharacterCalculation<CharacterProficiencyLevel>['override']
): CharacterCalculation<CharacterProficiencyLevel> {
  const matching = proficiencies.filter(
    (proficiency) =>
      proficiency.kind === kind &&
      (proficiency.subjectId === '*' ||
        (kind === 'SAVE_ABILITY'
          ? abilityMatches(proficiency.subjectId, subjectId)
          : resolveSkillAlias(proficiency.subjectId, skillAliases) === subjectId))
  )
  const highestRank = matching.reduce(
    (rank, proficiency) =>
      Math.max(rank, PROFICIENCY_RANK[toProficiencyLevel(proficiency.scaling)]),
    PROFICIENCY_RANK.NONE
  )
  const appliedIndex = matching.findIndex(
    (proficiency) => PROFICIENCY_RANK[toProficiencyLevel(proficiency.scaling)] === highestRank
  )
  const contributions = matching.map((proficiency, index) => {
    const source = proficiency.source ?? fallbackSource
    return {
      id: [
        'proficiency',
        createCharacterMechanicSourceKey(source),
        proficiency.grantId ?? String(index),
        kind,
        subjectId
      ].join(':'),
      source,
      value: toProficiencyLevel(proficiency.scaling),
      state:
        index === appliedIndex
          ? CHARACTER_CALCULATION_CONTRIBUTION_STATE.APPLIED
          : CHARACTER_CALCULATION_CONTRIBUTION_STATE.SUPPRESSED
    }
  })
  return resolveSelectionCalculation('NONE' as CharacterProficiencyLevel, contributions, override)
}

export function resolveAdjustedAbilityAndSkillStats(
  snapshot: CharacterBuildSnapshot,
  modifierState: ResolvedModifierState,
  proficiencies: readonly EngineProficiency[],
  registry: CharacterAssemblyRegistry,
  rules: RulesSystem,
  authoredAbilityScores: Record<string, number>,
  authoredProficiencyBonus: number
) {
  const source = systemSource(snapshot.systemId)
  const skillAliases = buildSkillSubjectAliasMap(registry)
  const proficiencyBonus = resolveNumericCalculation(authoredProficiencyBonus)
  const abilityScores: Record<string, CharacterCalculation<number>> = {}
  const abilityModifiers: Record<string, CharacterCalculation<number>> = {}
  for (const abilityKey of Object.keys(authoredAbilityScores)) {
    const score = createAbilityScoreCalculation(abilityKey, snapshot, modifierState)
    abilityScores[abilityKey] = score
    abilityModifiers[abilityKey] = resolveNumericCalculation(rules.abilityModifier(score.effective))
  }
  const savingThrowProficiencyLevels: EngineCalculationBreakdowns['savingThrowProficiencyLevels'] =
    {}
  const savingThrows: EngineCalculationBreakdowns['savingThrows'] = {}
  for (const abilityKey of Object.keys(abilityModifiers)) {
    const canonicalAbility = resolveAbilityAlias(abilityKey) ?? abilityKey
    const proficiencyOverride = (snapshot.adjustments ?? []).find(
      (adjustment): adjustment is ProficiencyMechanicalAdjustment =>
        adjustment.family === 'SAVING_THROW' &&
        adjustment.field === 'PROFICIENCY_OVERRIDE' &&
        abilityMatches(adjustment.ability, abilityKey)
    )
    const proficiencyLevel = resolveProficiencyCalculation(
      proficiencies,
      'SAVE_ABILITY',
      canonicalAbility,
      skillAliases,
      source,
      proficiencyOverride ? toCalculationOverride(proficiencyOverride) : undefined
    )
    savingThrowProficiencyLevels[abilityKey] = proficiencyLevel
    const proficiencyValue = Math.floor(
      proficiencyBonus.effective * rules.proficiencyMultiplier(proficiencyLevel.effective)
    )
    const targetAdjustments = (snapshot.adjustments ?? []).filter(
      (adjustment) =>
        adjustment.family === 'SAVING_THROW' && abilityMatches(adjustment.ability, abilityKey)
    )
    const totalOverride = targetAdjustments.find(
      (adjustment) => adjustment.field === 'TOTAL_OVERRIDE'
    )
    const manualBonuses = targetAdjustments.filter(
      (
        adjustment
      ): adjustment is Extract<NumericMechanicalAdjustment, { family: 'SAVING_THROW' }> =>
        adjustment.field === 'MAGIC_BONUS' || adjustment.field === 'MISC_BONUS'
    )
    savingThrows[abilityKey] = resolveNumericCalculation(
      abilityModifiers[abilityKey]?.effective ?? 0,
      [
        ...(proficiencyValue === 0
          ? []
          : [
              {
                id: `saving-throw-proficiency:${canonicalAbility}`,
                source:
                  proficiencyLevel.contributions.find(
                    (contribution) =>
                      contribution.state === CHARACTER_CALCULATION_CONTRIBUTION_STATE.APPLIED
                  )?.source ?? source,
                value: proficiencyValue,
                state: CHARACTER_CALCULATION_CONTRIBUTION_STATE.APPLIED
              }
            ]),
        ...modifierContributions(
          modifierState,
          (parsed) =>
            parsed.valueDomainCode === 'SAVING_THROW_MODIFIER' &&
            abilityMatches(parsed.params.ability, abilityKey) &&
            parsed.modifierKind !== 'SET_VALUE'
        ),
        ...manualBonuses.map(manualContribution)
      ],
      totalOverride && typeof totalOverride.value === 'number'
        ? toCalculationOverride(totalOverride)
        : undefined
    )
  }
  const skillGoverningAbilities: EngineCalculationBreakdowns['skillGoverningAbilities'] = {}
  const skillProficiencyLevels: EngineCalculationBreakdowns['skillProficiencyLevels'] = {}
  const skillBonuses: EngineCalculationBreakdowns['skillBonuses'] = {}
  const passiveChecks: EngineCalculationBreakdowns['passiveChecks'] = {}
  for (const [skillId, defaultAbility] of Object.entries(SKILL_ABILITY_MAP)) {
    const skillAdjustments = (snapshot.adjustments ?? []).filter(
      (adjustment) =>
        (adjustment.family === 'SKILL' || adjustment.family === 'PASSIVE') &&
        resolveSkillAlias(adjustment.skillId, skillAliases) === skillId
    )
    const governingOverride = skillAdjustments.find(
      (adjustment) =>
        adjustment.family === 'SKILL' && adjustment.field === 'GOVERNING_ABILITY_OVERRIDE'
    )
    const governing = resolveSelectionCalculation(
      defaultAbility,
      [],
      governingOverride && typeof governingOverride.value === 'string'
        ? toCalculationOverride(governingOverride)
        : undefined
    )
    skillGoverningAbilities[skillId] = governing
    const proficiencyOverride = skillAdjustments.find(
      (adjustment) => adjustment.family === 'SKILL' && adjustment.field === 'PROFICIENCY_OVERRIDE'
    )
    const proficiencyLevel = resolveProficiencyCalculation(
      proficiencies,
      'SKILL',
      skillId,
      skillAliases,
      source,
      proficiencyOverride && typeof proficiencyOverride.value === 'string'
        ? toCalculationOverride(proficiencyOverride)
        : undefined
    )
    skillProficiencyLevels[skillId] = proficiencyLevel
    const proficiencyValue = Math.floor(
      proficiencyBonus.effective * rules.proficiencyMultiplier(proficiencyLevel.effective)
    )
    const abilityKey =
      resolveAbilityRecordKey(abilityModifiers, governing.effective) ?? governing.effective
    const totalOverride = skillAdjustments.find(
      (adjustment) => adjustment.family === 'SKILL' && adjustment.field === 'TOTAL_OVERRIDE'
    )
    const manualBonuses = skillAdjustments.filter(
      (adjustment): adjustment is Extract<NumericMechanicalAdjustment, { family: 'SKILL' }> =>
        adjustment.family === 'SKILL' &&
        (adjustment.field === 'MAGIC_BONUS' || adjustment.field === 'MISC_BONUS')
    )
    const skillCalculation = resolveNumericCalculation(
      abilityModifiers[abilityKey]?.effective ?? 0,
      [
        ...(proficiencyValue === 0
          ? []
          : [
              {
                id: `skill-proficiency:${skillId}`,
                source:
                  proficiencyLevel.contributions.find(
                    (contribution) =>
                      contribution.state === CHARACTER_CALCULATION_CONTRIBUTION_STATE.APPLIED
                  )?.source ?? source,
                value: proficiencyValue,
                state: CHARACTER_CALCULATION_CONTRIBUTION_STATE.APPLIED
              }
            ]),
        ...modifierContributions(
          modifierState,
          (parsed) =>
            parsed.valueDomainCode === 'SKILL_MODIFIER' &&
            resolveSkillAlias(parsed.params.skillId ?? '', skillAliases) === skillId &&
            parsed.modifierKind !== 'SET_VALUE'
        ),
        ...manualBonuses.map(manualContribution)
      ],
      totalOverride && typeof totalOverride.value === 'number'
        ? toCalculationOverride(totalOverride)
        : undefined
    )
    skillBonuses[skillId] = skillCalculation
    const passiveOverride = skillAdjustments.find(
      (adjustment) => adjustment.family === 'PASSIVE' && adjustment.field === 'TOTAL_OVERRIDE'
    )
    passiveChecks[skillId] = resolveNumericCalculation(
      rules.passiveScore(skillCalculation.effective),
      [],
      passiveOverride ? toCalculationOverride(passiveOverride) : undefined
    )
  }
  return {
    proficiencyBonus,
    abilityScores,
    abilityModifiers,
    savingThrowProficiencyLevels,
    savingThrows,
    skillGoverningAbilities,
    skillProficiencyLevels,
    skillBonuses,
    passiveChecks
  }
}
