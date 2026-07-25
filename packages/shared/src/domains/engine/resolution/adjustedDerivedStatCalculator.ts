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
import type {
  EngineCalculationBreakdowns,
  EngineDerivedStats,
  EngineProficiency,
  EngineSense
} from '../contracts/engineState.js'
import type { RulesSystem } from '../contracts/rulesSystem.js'
import type { CharacterAssemblyRegistry } from '../registry.js'
import type { CharacterBuildSnapshot } from '../snapshot.js'
import type { ResolvedModifierState } from './modifierResolver.js'
import { parseModifierDomainKey } from './modifierDomainKey.js'
import { resolveAbilityRecordKey } from './abilityKey.js'
import {
  buildSkillSubjectAliasMap,
  calculateDerivedStats,
  resolveAbilityAlias,
  resolveSkillAlias
} from './derivedStatCalculator.js'
import { resolveNumericCalculation, resolveSelectionCalculation } from './calculationResolver.js'
import { SKILL_ABILITY_MAP } from './skillAbilityMap.js'

type NumericMechanicalAdjustment = Extract<CharacterMechanicalAdjustment, { value: number }>

type ProficiencyMechanicalAdjustment = Extract<
  CharacterMechanicalAdjustment,
  { value: CharacterProficiencyLevel }
>

export interface AdjustedDerivedStatResult {
  derivedStats: EngineDerivedStats
  calculations: EngineCalculationBreakdowns
  senses: EngineSense[]
}

function systemSource(systemId: string): CharacterMechanicSourceRef {
  return { kind: 'SYSTEM', systemId }
}

function manualContribution(
  adjustment: NumericMechanicalAdjustment
): CharacterCalculationContribution<number> {
  return {
    id: adjustment.id,
    source: {
      kind: 'MANUAL_ADJUSTMENT',
      adjustmentId: adjustment.id
    },
    value: adjustment.value,
    state: CHARACTER_CALCULATION_CONTRIBUTION_STATE.APPLIED
  }
}

function adjustmentOverride<T extends string | number>(
  adjustment: { id: string; value: T } | undefined
): CharacterCalculation<T>['override'] | undefined {
  return adjustment
    ? {
        adjustmentId: adjustment.id,
        value: adjustment.value
      }
    : undefined
}

function modifierContributions(
  state: ResolvedModifierState,
  predicate: (parsed: ReturnType<typeof parseModifierDomainKey>) => boolean
): CharacterCalculationContribution<number>[] {
  return Object.entries(state.calculations).flatMap(([domainKey, calculation]) =>
    predicate(parseModifierDomainKey(domainKey))
      ? calculation.contributions.map((contribution) => ({ ...contribution }))
      : []
  )
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
      ? {
          ...contribution,
          value: contribution.value - base
        }
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
    override && typeof override.value === 'number' ? adjustmentOverride(override) : undefined
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
  const matching = proficiencies.filter((proficiency) => {
    if (proficiency.kind !== kind) return false
    return (
      proficiency.subjectId === '*' ||
      (kind === 'SAVE_ABILITY'
        ? abilityMatches(proficiency.subjectId, subjectId)
        : resolveSkillAlias(proficiency.subjectId, skillAliases) === subjectId)
    )
  })
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

function resolveMovement(
  snapshot: CharacterBuildSnapshot,
  registry: CharacterAssemblyRegistry,
  rules: RulesSystem,
  modifierState: ResolvedModifierState
): {
  speeds: EngineDerivedStats['movementSpeeds']
  primarySpeedId?: string
  calculations: Record<string, CharacterCalculation<number>>
} {
  const selectedRaceId = snapshot.subraceId ?? snapshot.raceId
  const baseSpeeds = selectedRaceId ? (registry.races[selectedRaceId]?.speeds ?? []) : []
  const adjustments = (snapshot.adjustments ?? []).filter(
    (adjustment) => adjustment.family === 'MOVEMENT'
  )
  const orderedIds = [
    ...baseSpeeds.map((speed) => speed.speedId),
    ...(registry.system?.speeds ?? [])
      .map((speed) => speed.id)
      .filter((speedId) => adjustments.some((adjustment) => adjustment.speedId === speedId)),
    ...adjustments.map((adjustment) => adjustment.speedId)
  ].filter((speedId, index, all) => all.indexOf(speedId) === index)
  const baseById = new Map(baseSpeeds.map((speed) => [speed.speedId, speed]))
  const defaultUnit = baseSpeeds[0]?.unit ?? 'FEET'
  const calculations: Record<string, CharacterCalculation<number>> = {}
  const speeds = orderedIds.map((speedId) => {
    const baseSpeed = baseById.get(speedId)
    const override = adjustments.find((adjustment) => adjustment.speedId === speedId)
    const calculation = resolveNumericCalculation(
      baseSpeed?.amount ?? 0,
      modifierContributions(
        modifierState,
        (parsed) =>
          parsed.valueDomainCode === 'SPEED' &&
          parsed.params.speedId === speedId &&
          parsed.modifierKind !== 'SET_VALUE'
      ),
      override ? adjustmentOverride(override) : undefined
    )
    calculations[speedId] = calculation
    return {
      speedId,
      amount: calculation.effective,
      unit: baseSpeed?.unit ?? defaultUnit
    }
  })
  const speedCodes = new Map((registry.system?.speeds ?? []).map((speed) => [speed.id, speed.code]))
  const primarySpeedId = rules.selectPrimaryMovementSpeedId(
    speeds.map((speed) => ({
      speedId: speed.speedId,
      code: speedCodes.get(speed.speedId)
    })),
    snapshot.movementDisplayPreference ?? { mode: 'AUTO' }
  )

  return {
    speeds,
    ...(primarySpeedId ? { primarySpeedId } : {}),
    calculations
  }
}

function resolveSenses(
  snapshot: CharacterBuildSnapshot,
  senses: readonly EngineSense[],
  modifierState: ResolvedModifierState
): {
  senses: EngineSense[]
  calculations: Record<string, CharacterCalculation<number>>
} {
  const adjustments = (snapshot.adjustments ?? []).filter(
    (adjustment) => adjustment.family === 'SENSE'
  )
  const orderedIds = [
    ...senses.map((sense) => sense.senseCode),
    ...adjustments.map((adjustment) => adjustment.senseId)
  ].filter((senseId, index, all) => all.indexOf(senseId) === index)
  const calculations: Record<string, CharacterCalculation<number>> = {}
  const resolved = orderedIds.map((senseId) => {
    const matching = senses.filter((sense) => sense.senseCode === senseId)
    const distanceRanges = matching.flatMap((sense) =>
      sense.range?.rangeKind === 'DISTANCE' ? [sense.range] : []
    )
    const baseRange = distanceRanges.reduce(
      (best, candidate) => (candidate.amount > (best?.amount ?? -1) ? candidate : best),
      distanceRanges[0]
    )
    const override = adjustments.find((adjustment) => adjustment.senseId === senseId)
    if (!baseRange && !override) {
      return matching[0] ?? { senseCode: senseId }
    }

    const calculation = resolveNumericCalculation(
      baseRange?.amount ?? 0,
      modifierContributions(
        modifierState,
        (parsed) =>
          parsed.valueDomainCode === 'SENSE_RANGE' &&
          (parsed.params.senseCode === senseId || parsed.params.senseId === senseId) &&
          parsed.modifierKind !== 'SET_VALUE'
      ),
      override ? adjustmentOverride(override) : undefined
    )
    calculations[senseId] = calculation
    return {
      senseCode: senseId,
      range: {
        id: baseRange?.id ?? override?.id ?? `sense:${senseId}`,
        rangeKind: 'DISTANCE' as const,
        amount: calculation.effective,
        unit: baseRange?.unit ?? 'FEET'
      }
    }
  })

  return { senses: resolved, calculations }
}

function resolveSpellcastingAbility(
  snapshot: CharacterBuildSnapshot,
  registry: CharacterAssemblyRegistry
): string | undefined {
  for (const classRecord of snapshot.classes) {
    const ability = registry.classes[classRecord.classId]?.spellcasting?.ability
    if (ability) return ability
  }
  return undefined
}

export function calculateAdjustedDerivedStats(
  snapshot: CharacterBuildSnapshot,
  modifierState: ResolvedModifierState,
  proficiencies: EngineProficiency[],
  senses: EngineSense[],
  registry: CharacterAssemblyRegistry,
  rules: RulesSystem,
  activeEquipmentInstanceIds?: ReadonlySet<string>
): AdjustedDerivedStatResult {
  const authored = calculateDerivedStats(
    snapshot,
    modifierState.values,
    proficiencies,
    registry,
    rules,
    activeEquipmentInstanceIds
  )
  const source = systemSource(snapshot.systemId)
  const skillAliases = buildSkillSubjectAliasMap(registry)
  const proficiencyBonus = resolveNumericCalculation(authored.proficiencyBonus)
  const abilityScores: Record<string, CharacterCalculation<number>> = {}
  const abilityModifiers: Record<string, CharacterCalculation<number>> = {}

  for (const abilityKey of Object.keys(authored.abilityScores)) {
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
      proficiencyOverride ? adjustmentOverride(proficiencyOverride) : undefined
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
        ? adjustmentOverride(totalOverride)
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
        ? adjustmentOverride(governingOverride)
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
        ? adjustmentOverride(proficiencyOverride)
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
        ? adjustmentOverride(totalOverride)
        : undefined
    )
    skillBonuses[skillId] = skillCalculation
    const passiveOverride = skillAdjustments.find(
      (adjustment) => adjustment.family === 'PASSIVE' && adjustment.field === 'TOTAL_OVERRIDE'
    )
    passiveChecks[skillId] = resolveNumericCalculation(
      rules.passiveScore(skillCalculation.effective),
      [],
      passiveOverride ? adjustmentOverride(passiveOverride) : undefined
    )
  }

  const hitPointAdjustments = (snapshot.adjustments ?? []).filter(
    (adjustment) => adjustment.family === 'HIT_POINTS'
  )
  const hitPointModifier = hitPointAdjustments.find(
    (adjustment) => adjustment.field === 'MAXIMUM_MODIFIER'
  )
  const hitPointOverride = hitPointAdjustments.find(
    (adjustment) => adjustment.field === 'MAXIMUM_OVERRIDE'
  )
  const constitutionKey =
    resolveAbilityRecordKey(abilityModifiers, 'CONSTITUTION') ?? 'CONSTITUTION'
  const authoredConstitutionKey =
    resolveAbilityRecordKey(authored.abilityModifiers, 'CONSTITUTION') ?? 'CONSTITUTION'
  const constitutionHitPointDelta =
    ((abilityModifiers[constitutionKey]?.effective ?? 0) -
      (authored.abilityModifiers[authoredConstitutionKey] ?? 0)) *
    snapshot.hitpoints.length
  const maxHitPoints = resolveNumericCalculation(
    snapshot.hitpoints.reduce((total, entry) => total + entry.value, 0),
    [
      ...(constitutionHitPointDelta === 0
        ? []
        : [
            {
              id: 'hit-points:constitution-modifier-delta',
              source,
              value: constitutionHitPointDelta,
              state: CHARACTER_CALCULATION_CONTRIBUTION_STATE.APPLIED
            }
          ]),
      ...modifierContributions(
        modifierState,
        (parsed) =>
          parsed.valueDomainCode === 'HIT_POINTS_MAX' && parsed.modifierKind !== 'SET_VALUE'
      ),
      ...(hitPointModifier ? [manualContribution(hitPointModifier)] : [])
    ],
    hitPointOverride ? adjustmentOverride(hitPointOverride) : undefined
  )

  const dexterityKey = resolveAbilityRecordKey(abilityModifiers, 'DEXTERITY') ?? 'DEXTERITY'
  const oldDexterityKey =
    resolveAbilityRecordKey(authored.abilityModifiers, 'DEXTERITY') ?? 'DEXTERITY'
  const activeArmor = snapshot.equipmentItems.some(
    (item) =>
      item.equippedState?.slot === 'ARMOR' &&
      (!activeEquipmentInstanceIds || activeEquipmentInstanceIds.has(item.instanceId))
  )
  const armorModifierContributions = modifierContributions(
    modifierState,
    (parsed) => parsed.valueDomainCode === 'ARMOR_CLASS' && parsed.modifierKind !== 'SET_VALUE'
  )
  const armorModifierTotal = armorModifierContributions.reduce(
    (total, contribution) =>
      contribution.state === CHARACTER_CALCULATION_CONTRIBUTION_STATE.APPLIED
        ? total + contribution.value
        : total,
    0
  )
  const adjustedAuthoredArmorClass =
    authored.armorClass +
    (activeArmor
      ? 0
      : (abilityModifiers[dexterityKey]?.effective ?? 0) -
        (authored.abilityModifiers[oldDexterityKey] ?? 0))
  const armorClass = resolveNumericCalculation(
    adjustedAuthoredArmorClass - armorModifierTotal,
    armorModifierContributions
  )

  const initiativeModifierContributions = modifierContributions(
    modifierState,
    (parsed) => parsed.valueDomainCode === 'INITIATIVE' && parsed.modifierKind !== 'SET_VALUE'
  )
  const initiative = resolveNumericCalculation(
    abilityModifiers[dexterityKey]?.effective ?? 0,
    initiativeModifierContributions
  )

  const movement = resolveMovement(snapshot, registry, rules, modifierState)
  const resolvedSenses = resolveSenses(snapshot, senses, modifierState)

  const spellcastingAbility = resolveSpellcastingAbility(snapshot, registry)
  const spellcastingAbilityKey = spellcastingAbility
    ? resolveAbilityRecordKey(abilityModifiers, spellcastingAbility)
    : undefined
  const spellModifier = spellcastingAbilityKey
    ? (abilityModifiers[spellcastingAbilityKey]?.effective ?? 0)
    : undefined
  const spellSaveDC =
    spellModifier === undefined
      ? undefined
      : resolveNumericCalculation(
          8 + proficiencyBonus.effective + spellModifier,
          modifierContributions(
            modifierState,
            (parsed) => parsed.valueDomainCode === 'SAVE_DC' && parsed.modifierKind !== 'SET_VALUE'
          )
        )
  const spellAttackBonus =
    spellModifier === undefined
      ? undefined
      : resolveNumericCalculation(
          proficiencyBonus.effective + spellModifier,
          modifierContributions(
            modifierState,
            (parsed) =>
              parsed.valueDomainCode === 'ATTACK_ROLL' &&
              parsed.params.attackDomain === 'SPELL' &&
              parsed.modifierKind !== 'SET_VALUE'
          )
        )

  const calculations: EngineCalculationBreakdowns = {
    proficiencyBonus,
    abilityScores,
    abilityModifiers,
    savingThrowProficiencyLevels,
    savingThrows,
    skillGoverningAbilities,
    skillProficiencyLevels,
    skillBonuses,
    passiveChecks,
    movementSpeeds: movement.calculations,
    senseRanges: resolvedSenses.calculations,
    initiative,
    armorClass,
    maxHitPoints,
    ...(spellSaveDC ? { spellSaveDC } : {}),
    ...(spellAttackBonus ? { spellAttackBonus } : {})
  }
  const derivedStats: EngineDerivedStats = {
    proficiencyBonus: proficiencyBonus.effective,
    abilityScores: Object.fromEntries(
      Object.entries(abilityScores).map(([key, calculation]) => [key, calculation.effective])
    ),
    abilityModifiers: Object.fromEntries(
      Object.entries(abilityModifiers).map(([key, calculation]) => [key, calculation.effective])
    ),
    savingThrows: Object.fromEntries(
      Object.entries(savingThrows).map(([key, calculation]) => [key, calculation.effective])
    ),
    skillBonuses: Object.fromEntries(
      Object.entries(skillBonuses).map(([key, calculation]) => [key, calculation.effective])
    ),
    skillGoverningAbilities: Object.fromEntries(
      Object.entries(skillGoverningAbilities).map(([key, calculation]) => [
        key,
        calculation.effective
      ])
    ),
    passiveChecks: Object.fromEntries(
      Object.entries(passiveChecks).map(([key, calculation]) => [key, calculation.effective])
    ),
    movementSpeeds: movement.speeds,
    ...(movement.primarySpeedId ? { primaryMovementSpeedId: movement.primarySpeedId } : {}),
    initiative: initiative.effective,
    armorClass: armorClass.effective,
    maxHitPoints: maxHitPoints.effective,
    ...(spellSaveDC ? { spellSaveDC: spellSaveDC.effective } : {}),
    ...(spellAttackBonus ? { spellAttackBonus: spellAttackBonus.effective } : {})
  }

  return {
    derivedStats,
    calculations,
    senses: resolvedSenses.senses
  }
}
