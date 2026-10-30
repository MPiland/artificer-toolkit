import type { SummonPickOptionsDto } from '@artificer-toolkit/schema/api/summonPickOptions'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import {
  characterSheetPanelDtoSchema,
  type CharacterSheetPanelDto,
  type CharacterSheetPanelNumericCalculationDto,
  type CharacterSheetPanelTargetDto
} from '@artificer-toolkit/schema/api/characterSheetPanel'
import {
  FEATURE_ATTRIBUTE,
  roundLengthForDisplay,
  type CharacterCalculation,
  type CharacterMechanicSourceRef
} from '@artificer-toolkit/shared/core'
import type {
  CharacterMovementDisplayPreference,
  CharacterSheetAdjustment
} from '@artificer-toolkit/shared/character'
import {
  createCharacterMechanicSourceKey,
  createCharacterResourceOwnerKey,
  createCharacterSpellSourceKey,
  toCharacterResourceOwnerKey
} from '@artificer-toolkit/shared/character'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { systemCoreCodeRegistry } from '../platformSystemCoreCodes.js'
import type { CharacterBuilderResolution } from './builderTypes.js'
import type { CharacterPresentationLookup } from './characterRuleContext.js'
import { characterSourceActionIdPrefix } from './characterActionRuleFacts.js'
import type { CharacterSheetRuleProjection } from './characterSheetRuleProjection.js'
import { resolveCharacterSheetSkillKey } from './characterSheetVocabulary.js'
import { characterSheetAdjustmentMatchesPanelTarget } from './sheetPanelTarget.js'
import { getProficiencyTargetKind, type CharacterSheetProficiencyKind } from './sheetProficiency.js'
import { getKnownSpellIdsForClassIntent } from './sheetSpellIds.js'

const CORE_PANEL_COMMANDS = ['UPSERT_ADJUSTMENT', 'REMOVE_ADJUSTMENT', 'RESET_ADJUSTMENTS'] as const

const PROFICIENCY_OPTIONS = [
  { value: 'NONE', label: 'Not proficient' },
  { value: 'HALF', label: 'Half proficiency' },
  { value: 'FULL', label: 'Proficient' },
  { value: 'DOUBLE', label: 'Expertise' }
]

function formatCode(value: string): string {
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/gu, (letter) => letter.toUpperCase())
}

function isAbsoluteAdjustment(adjustment: CharacterSheetAdjustment): boolean {
  switch (adjustment.family) {
    case 'ABILITY':
      return adjustment.field === 'SCORE_OVERRIDE'
    case 'SAVING_THROW':
    case 'SKILL':
      return adjustment.field === 'TOTAL_OVERRIDE'
    case 'PASSIVE':
    case 'SENSE':
    case 'MOVEMENT':
      return true
    case 'DEFENSE':
    case 'PROFICIENCY':
      return false
    case 'HIT_POINTS':
      return adjustment.field === 'MAXIMUM_OVERRIDE'
    case 'SPELL':
      return adjustment.field === 'ATTACK_OVERRIDE' || adjustment.field === 'DC_OVERRIDE'
    case 'ITEM':
      return adjustment.field === 'ATTACK_OVERRIDE' || adjustment.field === 'WEIGHT_OVERRIDE'
    case 'COMPANION':
      return adjustment.field.endsWith('_OVERRIDE')
  }
}

function resolvePanelState(
  adjustments: readonly CharacterSheetAdjustment[],
  target: CharacterSheetPanelTargetDto
): 'DEFAULT' | 'ADJUSTED' | 'OVERRIDDEN' {
  const matching = adjustments.filter((adjustment) =>
    characterSheetAdjustmentMatchesPanelTarget(adjustment, target)
  )
  if (matching.some(isAbsoluteAdjustment)) return 'OVERRIDDEN'
  return matching.length ? 'ADJUSTED' : 'DEFAULT'
}

function adjustmentEditorMetadata(adjustment: CharacterSheetAdjustment | undefined) {
  return {
    ...(adjustment ? { adjustmentId: adjustment.id } : {}),
    ...(adjustment?.sourceNote ? { sourceNote: adjustment.sourceNote } : {})
  }
}

function getDisplayAdjustmentId(
  source: CharacterMechanicSourceRef | undefined,
  adjustments: readonly CharacterSheetAdjustment[]
): string | undefined {
  if (source?.kind !== 'MANUAL_ADJUSTMENT') return undefined
  return adjustments.some((adjustment) => adjustment.id === source.adjustmentId)
    ? source.adjustmentId
    : undefined
}

function findCompanionAdjustment(
  params: BuildCharacterSheetPanelParams,
  companionInstanceId: string,
  field: Extract<CharacterSheetAdjustment, { family: 'COMPANION' }>['field']
) {
  return params.adjustments.find(
    (adjustment) =>
      adjustment.family === 'COMPANION' &&
      adjustment.companionInstanceId === companionInstanceId &&
      adjustment.field === field
  )
}

function vocabularyOptions(records: readonly { id: string; label: string }[] = []) {
  return records.map(({ id, label }) => ({ value: id, label }))
}

function findSourceLabel(params: {
  source: CharacterMechanicSourceRef
  adjustments: readonly CharacterSheetAdjustment[]
  character: CharacterAuthored
  resolution: CharacterBuilderResolution
  sheet: CharacterSheetResponseDto
}): { label: string; note?: string } {
  const { source } = params
  switch (source.kind) {
    case 'MANUAL_ADJUSTMENT': {
      const adjustment = params.adjustments.find(
        (candidate) => candidate.id === source.adjustmentId
      )
      return {
        label: adjustment ? 'Manual adjustment' : 'Character effect',
        ...(adjustment?.sourceNote ? { note: adjustment.sourceNote } : {})
      }
    }
    case 'SYSTEM':
      return { label: params.resolution.registry.system?.label ?? 'Rules system' }
    case 'EQUIPMENT_INSTANCE': {
      const item = params.sheet.inventory.items.find(
        (candidate) => candidate.id === source.itemInstanceId
      )
      return { label: item?.label ?? 'Equipment' }
    }
    case 'COMPANION_INSTANCE':
      return { label: 'Companion' }
    case 'ACTIVE_EFFECT':
      return { label: 'Active effect' }
    case 'AUTHORED': {
      const authoredRecords = [
        ...params.resolution.registry.races,
        ...params.resolution.registry.classes,
        ...params.resolution.registry.backgrounds,
        ...params.resolution.registry.features,
        ...(params.resolution.registry.feats ?? [])
      ]
      const definition = authoredRecords.find((candidate) => candidate.id === source.definitionId)
      const grantedFeature = params.resolution.grants.features.find(
        (candidate) => candidate.id === source.definitionId
      )
      return {
        label:
          definition?.label ?? grantedFeature?.label ?? `${formatCode(source.sourceKind)} source`
      }
    }
  }
}

function toPanelCalculation(
  calculation: CharacterCalculation<number> | undefined,
  context: Omit<Parameters<typeof findSourceLabel>[0], 'source'>
): CharacterSheetPanelNumericCalculationDto {
  const resolved = calculation ?? {
    base: 0,
    contributions: [],
    effective: 0
  }
  const overrideAdjustment = resolved.override
    ? context.adjustments.find((adjustment) => adjustment.id === resolved.override?.adjustmentId)
    : undefined

  return {
    base: resolved.base,
    contributions: resolved.contributions
      .filter(
        (contribution) =>
          contribution.source.kind !== 'MANUAL_ADJUSTMENT' ||
          getDisplayAdjustmentId(contribution.source, context.adjustments) !== undefined
      )
      .map((contribution) => {
        const source = findSourceLabel({ ...context, source: contribution.source })
        return {
          id: contribution.id,
          source: contribution.source,
          sourceLabel: source.label,
          ...(source.note ? { sourceNote: source.note } : {}),
          value: contribution.value,
          state: contribution.state
        }
      }),
    ...(resolved.override && overrideAdjustment
      ? {
          override: {
            adjustmentId: resolved.override.adjustmentId,
            value: resolved.override.value,
            sourceLabel: 'Manual override',
            ...(overrideAdjustment?.sourceNote ? { sourceNote: overrideAdjustment.sourceNote } : {})
          }
        }
      : {}),
    effective: resolved.effective
  }
}

function findAdjustment<
  Family extends CharacterSheetAdjustment['family'],
  Adjustment extends Extract<CharacterSheetAdjustment, { family: Family }>
>(
  adjustments: readonly CharacterSheetAdjustment[],
  family: Family,
  predicate: (adjustment: Adjustment) => boolean
): Adjustment | undefined {
  return adjustments.find(
    (adjustment): adjustment is Adjustment =>
      adjustment.family === family && predicate(adjustment as Adjustment)
  )
}

function findRuleProjectionSkillKey(
  resolution: CharacterBuilderResolution,
  skillId: string
): string {
  return resolveCharacterSheetSkillKey(resolution.registry.system, skillId)
}

function findPassiveSkill(
  sheet: CharacterSheetResponseDto,
  passive: { code?: string; label: string }
) {
  const passiveText = `${passive.code ?? ''} ${passive.label}`.toUpperCase()
  return sheet.overview.skills.find((skill) => {
    const skillText = `${skill.code} ${skill.label}`.toUpperCase()
    return (
      passiveText.includes(skill.code.toUpperCase()) ||
      skillText.includes(passive.label.toUpperCase())
    )
  })
}

function getProficiencyLabel(
  proficiency: CharacterSheetRuleProjection['proficiencies'][number],
  kind: CharacterSheetProficiencyKind,
  resolution: CharacterBuilderResolution
): string {
  if (kind === 'LANGUAGE') {
    return (
      resolution.registry.system?.languages.find(
        (language) => language.id === proficiency.subjectId
      )?.label ?? 'Unknown language'
    )
  }
  if (proficiency.kind === 'EQUIPMENT_PROPERTY') {
    const propertyLabel = formatCode(proficiency.subjectId)
    if (kind === 'ARMOR') return `${propertyLabel} Armor`
    if (kind === 'WEAPON') return `${propertyLabel} Weapons`
    return propertyLabel
  }
  return (
    resolution.catalog.equipment.find((equipment) => equipment.id === proficiency.subjectId)
      ?.label ?? 'Unknown equipment'
  )
}

function requireSystemAbility(params: BuildCharacterSheetPanelParams, code: string) {
  const ability = params.resolution.registry.system?.abilities.find((entry) => entry.code === code)
  if (!ability) throw new Error(`Ability "${code}" is not available on this character sheet.`)
  return ability
}

function buildAbilityPanel(
  params: BuildCharacterSheetPanelParams,
  ruleProjection: CharacterSheetRuleProjection,
  target: Extract<CharacterSheetPanelTargetDto, { kind: 'ABILITY' }>
): CharacterSheetPanelDto {
  const ability = requireSystemAbility(params, target.ability)
  const matching = params.adjustments.filter(
    (adjustment) => adjustment.family === 'ABILITY' && adjustment.ability === target.ability
  )
  const otherModifier = findAdjustment(
    matching,
    'ABILITY',
    (adjustment) => adjustment.ability === target.ability && adjustment.field === 'OTHER_MODIFIER'
  )
  const scoreOverride = findAdjustment(
    matching,
    'ABILITY',
    (adjustment) => adjustment.ability === target.ability && adjustment.field === 'SCORE_OVERRIDE'
  )
  const calculation = toPanelCalculation(
    ruleProjection.calculations.abilityScores[target.ability],
    params
  )

  return {
    kind: 'ABILITY',
    panelId: `ability:${target.ability}`,
    characterId: params.character.id,
    target,
    title: ability.label,
    ...(ability.description ? { description: ability.description } : {}),
    state: resolvePanelState(params.adjustments, target),
    editable: params.editable,
    allowedCommands: [...CORE_PANEL_COMMANDS],
    ability: target.ability,
    score: calculation.effective,
    modifier: ruleProjection.derivedStats.abilityModifiers[target.ability] ?? 0,
    scoreCalculation: calculation,
    editors: [
      {
        kind: 'NUMBER',
        field: 'OTHER_MODIFIER',
        label: 'Other modifier',
        value: otherModifier?.field === 'OTHER_MODIFIER' ? otherModifier.value : null,
        commitIntent: 'ON_BLUR_OR_ENTER',
        validation: { integer: true },
        ...adjustmentEditorMetadata(otherModifier)
      },
      {
        kind: 'NUMBER',
        field: 'SCORE_OVERRIDE',
        label: 'Override score',
        value: scoreOverride?.field === 'SCORE_OVERRIDE' ? scoreOverride.value : null,
        commitIntent: 'ON_BLUR_OR_ENTER',
        validation: { integer: true, minimum: 0 },
        ...adjustmentEditorMetadata(scoreOverride)
      }
    ]
  }
}

function buildSavingThrowPanel(
  params: BuildCharacterSheetPanelParams,
  ruleProjection: CharacterSheetRuleProjection,
  target: Extract<CharacterSheetPanelTargetDto, { kind: 'SAVING_THROW' }>
): CharacterSheetPanelDto {
  const ability = requireSystemAbility(params, target.ability)
  const getNumeric = (field: 'MAGIC_BONUS' | 'MISC_BONUS' | 'TOTAL_OVERRIDE') =>
    findAdjustment(
      params.adjustments,
      'SAVING_THROW',
      (adjustment) => adjustment.ability === target.ability && adjustment.field === field
    )
  const proficiency = findAdjustment(
    params.adjustments,
    'SAVING_THROW',
    (adjustment) =>
      adjustment.ability === target.ability && adjustment.field === 'PROFICIENCY_OVERRIDE'
  )

  return {
    kind: 'SAVING_THROW',
    panelId: `saving-throw:${target.ability}`,
    characterId: params.character.id,
    target,
    title: `${ability.label} saving throw`,
    state: resolvePanelState(params.adjustments, target),
    editable: params.editable,
    allowedCommands: [...CORE_PANEL_COMMANDS],
    ability: target.ability,
    total: ruleProjection.derivedStats.savingThrows[target.ability] ?? 0,
    proficiency:
      ruleProjection.calculations.savingThrowProficiencyLevels[target.ability]?.effective ?? 'NONE',
    calculation: toPanelCalculation(
      ruleProjection.calculations.savingThrows[target.ability],
      params
    ),
    numericEditors: [
      ['MAGIC_BONUS', 'Magic bonus'],
      ['MISC_BONUS', 'Miscellaneous bonus'],
      ['TOTAL_OVERRIDE', 'Override total']
    ].map(([field, label]) => {
      const adjustment = getNumeric(field as 'MAGIC_BONUS' | 'MISC_BONUS' | 'TOTAL_OVERRIDE')
      return {
        kind: 'NUMBER' as const,
        field: field as 'MAGIC_BONUS' | 'MISC_BONUS' | 'TOTAL_OVERRIDE',
        label,
        value: typeof adjustment?.value === 'number' ? adjustment.value : null,
        commitIntent: 'ON_BLUR_OR_ENTER' as const,
        validation: { integer: true },
        ...adjustmentEditorMetadata(adjustment)
      }
    }),
    proficiencyEditor: {
      kind: 'SELECT',
      field: 'PROFICIENCY_OVERRIDE',
      label: 'Proficiency',
      value: proficiency?.field === 'PROFICIENCY_OVERRIDE' ? proficiency.value : null,
      options: PROFICIENCY_OPTIONS,
      commitIntent: 'IMMEDIATE',
      ...adjustmentEditorMetadata(proficiency)
    }
  }
}

function buildSkillPanel(
  params: BuildCharacterSheetPanelParams,
  ruleProjection: CharacterSheetRuleProjection,
  target: Extract<CharacterSheetPanelTargetDto, { kind: 'SKILL' }>
): CharacterSheetPanelDto {
  const row = params.sheet.overview.skills.find((skill) => skill.skillId === target.skillId)
  if (!row) throw new Error(`Skill "${target.skillId}" is not available on this character sheet.`)
  const ruleProjectionKey = findRuleProjectionSkillKey(params.resolution, target.skillId)
  const getNumeric = (field: 'MAGIC_BONUS' | 'MISC_BONUS' | 'TOTAL_OVERRIDE') =>
    findAdjustment(
      params.adjustments,
      'SKILL',
      (adjustment) => adjustment.skillId === target.skillId && adjustment.field === field
    )
  const proficiency = findAdjustment(
    params.adjustments,
    'SKILL',
    (adjustment) =>
      adjustment.skillId === target.skillId && adjustment.field === 'PROFICIENCY_OVERRIDE'
  )
  const governingAbility = findAdjustment(
    params.adjustments,
    'SKILL',
    (adjustment) =>
      adjustment.skillId === target.skillId && adjustment.field === 'GOVERNING_ABILITY_OVERRIDE'
  )

  return {
    kind: 'SKILL',
    panelId: `skill:${target.skillId}`,
    characterId: params.character.id,
    target,
    title: row.label,
    state: resolvePanelState(params.adjustments, target),
    editable: params.editable,
    allowedCommands: [...CORE_PANEL_COMMANDS],
    skillId: row.skillId,
    code: row.code,
    ability: row.ability,
    total: row.total,
    proficiency: row.proficiency,
    calculation: toPanelCalculation(
      ruleProjection.calculations.skillBonuses[ruleProjectionKey],
      params
    ),
    numericEditors: [
      ['MAGIC_BONUS', 'Magic bonus'],
      ['MISC_BONUS', 'Miscellaneous bonus'],
      ['TOTAL_OVERRIDE', 'Override total']
    ].map(([field, label]) => {
      const adjustment = getNumeric(field as 'MAGIC_BONUS' | 'MISC_BONUS' | 'TOTAL_OVERRIDE')
      return {
        kind: 'NUMBER' as const,
        field: field as 'MAGIC_BONUS' | 'MISC_BONUS' | 'TOTAL_OVERRIDE',
        label,
        value: typeof adjustment?.value === 'number' ? adjustment.value : null,
        commitIntent: 'ON_BLUR_OR_ENTER' as const,
        validation: { integer: true },
        ...adjustmentEditorMetadata(adjustment)
      }
    }),
    proficiencyEditor: {
      kind: 'SELECT',
      field: 'PROFICIENCY_OVERRIDE',
      label: 'Proficiency',
      value: proficiency?.field === 'PROFICIENCY_OVERRIDE' ? proficiency.value : null,
      options: PROFICIENCY_OPTIONS,
      commitIntent: 'IMMEDIATE',
      ...adjustmentEditorMetadata(proficiency)
    },
    abilityEditor: {
      kind: 'SELECT',
      field: 'GOVERNING_ABILITY_OVERRIDE',
      label: 'Governing ability',
      value:
        governingAbility?.field === 'GOVERNING_ABILITY_OVERRIDE' ? governingAbility.value : null,
      options: params.sheet.overview.abilities.map((a) => ({ value: a.ability, label: a.label })),
      commitIntent: 'IMMEDIATE',
      ...adjustmentEditorMetadata(governingAbility)
    }
  }
}

function buildSkillsPanel(
  params: BuildCharacterSheetPanelParams,
  target: Extract<CharacterSheetPanelTargetDto, { kind: 'SKILLS' }>
): CharacterSheetPanelDto {
  return {
    kind: 'SKILLS',
    panelId: 'skills',
    characterId: params.character.id,
    target,
    title: 'Skills',
    state: resolvePanelState(params.adjustments, target),
    editable: false,
    allowedCommands: [],
    skills: params.sheet.overview.skills.map((skill) => ({
      target: { kind: 'SKILL', skillId: skill.skillId },
      ...skill,
      state: resolvePanelState(params.adjustments, {
        kind: 'SKILL',
        skillId: skill.skillId
      })
    }))
  }
}

function buildSensesPanel(
  params: BuildCharacterSheetPanelParams,
  ruleProjection: CharacterSheetRuleProjection,
  target: Extract<CharacterSheetPanelTargetDto, { kind: 'SENSES' }>
): CharacterSheetPanelDto {
  const passiveChecks = (params.resolution.registry.system?.passives ?? []).flatMap((passive) => {
    const skill = findPassiveSkill(params.sheet, passive)
    if (!skill) return []
    const ruleProjectionKey = findRuleProjectionSkillKey(params.resolution, skill.skillId)
    const adjustment = findAdjustment(
      params.adjustments,
      'PASSIVE',
      (candidate) => candidate.skillId === skill.skillId
    )
    return [
      {
        skillId: skill.skillId,
        label: passive.label,
        total: ruleProjection.derivedStats.passiveChecks[ruleProjectionKey] ?? 10 + skill.total,
        state: adjustment ? ('OVERRIDDEN' as const) : ('DEFAULT' as const),
        calculation: toPanelCalculation(
          ruleProjection.calculations.passiveChecks[ruleProjectionKey],
          params
        ),
        editor: {
          kind: 'NUMBER' as const,
          field: 'TOTAL_OVERRIDE' as const,
          label: `Override ${passive.label}`,
          value: adjustment?.value ?? null,
          commitIntent: 'ON_BLUR_OR_ENTER' as const,
          validation: { integer: true },
          ...adjustmentEditorMetadata(adjustment)
        }
      }
    ]
  })
  const senses = (params.resolution.registry.system?.senses ?? []).map((sense) => {
    const adjustment = findAdjustment(
      params.adjustments,
      'SENSE',
      (candidate) => candidate.senseId === sense.id
    )
    const ruleSense = ruleProjection.senses.find(
      (candidate) => candidate.senseDefinitionId === sense.id
    )
    const calculation = ruleProjection.calculations.senseRanges[sense.id]
    if (ruleSense?.range.rangeKind === 'DISTANCE' && !calculation)
      throw new Error(`A held sense is missing its range calculation: ${sense.id}`)
    // A sense the Character does not hold has no range; a range override on it adds the sense.
    const reach = !ruleSense
      ? ({ rangeKind: 'NOT_HELD' } as const)
      : ruleSense.range.rangeKind === 'UNLIMITED'
        ? ({ rangeKind: 'UNLIMITED' } as const)
        : ({
            rangeKind: 'DISTANCE',
            range: roundLengthForDisplay(ruleSense.range.amount),
            unitLabel: formatCode(ruleSense.range.unit).toLowerCase(),
            calculation: toPanelCalculation(calculation, params)
          } as const)
    return {
      senseId: sense.id,
      label: sense.label,
      ...reach,
      state: adjustment ? ('OVERRIDDEN' as const) : ('DEFAULT' as const),
      editor: {
        kind: 'LENGTH' as const,
        field: 'RANGE_OVERRIDE' as const,
        label: `Override ${sense.label} range`,
        value: adjustment?.value ?? null,
        commitIntent: 'ON_BLUR_OR_ENTER' as const,
        ...adjustmentEditorMetadata(adjustment)
      }
    }
  })

  const targetEntry = target.entry
  const visiblePassiveChecks =
    targetEntry?.kind === 'PASSIVE'
      ? passiveChecks.filter((passive) => passive.skillId === targetEntry.skillId)
      : targetEntry
        ? []
        : passiveChecks
  const visibleSenses =
    targetEntry?.kind === 'SENSE'
      ? senses.filter((sense) => sense.senseId === targetEntry.senseId)
      : targetEntry
        ? []
        : senses
  const focusedEntry = visiblePassiveChecks[0] ?? visibleSenses[0]

  return {
    kind: 'SENSES',
    panelId: targetEntry
      ? `senses:${targetEntry.kind}:${targetEntry.kind === 'PASSIVE' ? targetEntry.skillId : targetEntry.senseId}`
      : 'senses',
    characterId: params.character.id,
    target,
    title: focusedEntry?.label ?? 'Senses',
    state: resolvePanelState(params.adjustments, target),
    editable: params.editable,
    allowedCommands: [...CORE_PANEL_COMMANDS],
    passiveChecks: visiblePassiveChecks,
    senses: visibleSenses
  }
}

function buildMovementPanel(
  params: BuildCharacterSheetPanelParams,
  ruleProjection: CharacterSheetRuleProjection,
  target: Extract<CharacterSheetPanelTargetDto, { kind: 'MOVEMENT' }>
): CharacterSheetPanelDto {
  const speeds = (params.resolution.registry.system?.speeds ?? []).map((speed) => {
    const adjustment = findAdjustment(
      params.adjustments,
      'MOVEMENT',
      (candidate) => candidate.speedId === speed.id
    )
    const ruleSpeed = ruleProjection.derivedStats.movementSpeeds.find(
      (candidate) => candidate.speedId === speed.id || candidate.speedId === speed.code
    )
    const calculation =
      ruleProjection.calculations.movementSpeeds[speed.id] ??
      ruleProjection.calculations.movementSpeeds[speed.code]
    if (ruleSpeed && !calculation)
      throw new Error(`A held speed is missing its calculation: ${speed.id}`)
    // A speed the Character does not hold has no value; a speed override on it adds the speed.
    const held = !ruleSpeed
      ? ({ speedKind: 'NOT_HELD' } as const)
      : ({
          speedKind: 'HELD',
          amount: roundLengthForDisplay(ruleSpeed.amount),
          unitLabel: formatCode(ruleSpeed.unit).toLowerCase(),
          calculation: toPanelCalculation(calculation, params)
        } as const)
    return {
      speedId: speed.id,
      label: speed.label,
      ...held,
      state: adjustment ? ('OVERRIDDEN' as const) : ('DEFAULT' as const),
      editor: {
        kind: 'LENGTH' as const,
        field: 'SPEED_OVERRIDE' as const,
        label: `Override ${speed.label} speed`,
        value: adjustment?.value ?? null,
        ...(ruleSpeed ? { defaultUnit: ruleSpeed.unit } : {}),
        commitIntent: 'ON_BLUR_OR_ENTER' as const,
        ...adjustmentEditorMetadata(adjustment)
      }
    }
  })
  return {
    kind: 'MOVEMENT',
    panelId: 'movement',
    characterId: params.character.id,
    target,
    title: 'Movement',
    state: resolvePanelState(params.adjustments, target),
    editable: params.editable,
    allowedCommands: [...CORE_PANEL_COMMANDS, 'SET_MOVEMENT_DISPLAY_PREFERENCE'],
    ...(ruleProjection.derivedStats.primaryMovementSpeedId
      ? { primarySpeedId: ruleProjection.derivedStats.primaryMovementSpeedId }
      : {}),
    preference: params.movementDisplayPreference,
    preferenceOptions: [
      { value: 'AUTO', label: 'Automatic' },
      ...speeds
        .filter((speed) => speed.speedKind === 'HELD' && speed.amount > 0)
        .map((speed) => ({ value: speed.speedId, label: speed.label }))
    ],
    speeds
  }
}

function buildDefensePanel(
  params: BuildCharacterSheetPanelParams,
  ruleProjection: CharacterSheetRuleProjection,
  target: Extract<CharacterSheetPanelTargetDto, { kind: 'DEFENSES' }>
): CharacterSheetPanelDto {
  const damageTypes = params.resolution.registry.system?.damageTypes ?? []
  const defenses = ruleProjection.defenses.map((defense) => {
    const adjustmentId = getDisplayAdjustmentId(defense.source, params.adjustments)
    const source = defense.source
      ? findSourceLabel({ ...params, source: defense.source })
      : { label: 'Character build' }
    return {
      kind: defense.kind,
      damageTypeId: defense.damageTypeId,
      label:
        damageTypes.find((damageType) => damageType.id === defense.damageTypeId)?.label ??
        formatCode(defense.damageTypeId),
      sourceLabel: source.label,
      ...(adjustmentId ? { adjustmentId } : {})
    }
  })
  const existing = new Set(defenses.map((defense) => `${defense.kind}:${defense.damageTypeId}`))
  return {
    kind: 'DEFENSES',
    panelId: 'defenses',
    characterId: params.character.id,
    target,
    title: 'Defenses',
    state: resolvePanelState(params.adjustments, target),
    editable: params.editable,
    allowedCommands: [...CORE_PANEL_COMMANDS],
    defenses,
    additionOptions: damageTypes.flatMap((damageType) =>
      (['RESISTANCE', 'IMMUNITY', 'VULNERABILITY'] as const).flatMap((defenseKind) =>
        existing.has(`${defenseKind}:${damageType.id}`)
          ? []
          : [
              {
                defenseKind,
                damageTypeId: damageType.id,
                label: `${damageType.label} ${formatCode(defenseKind).toLowerCase()}`
              }
            ]
      )
    )
  }
}

function buildProficiencyPanel(
  params: BuildCharacterSheetPanelParams,
  ruleProjection: CharacterSheetRuleProjection,
  target: Extract<CharacterSheetPanelTargetDto, { kind: 'PROFICIENCIES' }>
): CharacterSheetPanelDto {
  const proficiencies = ruleProjection.proficiencies.flatMap((proficiency) => {
    const kind = getProficiencyTargetKind(proficiency, params.resolution)
    if (!kind || proficiency.subjectId === '*') return []
    const source = proficiency.source
      ? findSourceLabel({ ...params, source: proficiency.source })
      : { label: 'Character build' }
    const adjustmentId = getDisplayAdjustmentId(proficiency.source, params.adjustments)
    return [
      {
        kind,
        targetId: proficiency.subjectId,
        label: getProficiencyLabel(proficiency, kind, params.resolution),
        sourceLabel: source.label,
        ...(adjustmentId ? { adjustmentId } : {})
      }
    ]
  })
  const existing = new Set(
    proficiencies.map((proficiency) => `${proficiency.kind}:${proficiency.targetId}`)
  )
  const equipmentOptions = params.resolution.catalog.equipment.flatMap((equipment) => {
    const kind = getProficiencyTargetKind(
      { kind: 'EQUIPMENT', subjectId: equipment.id, scaling: 'FULL' },
      params.resolution
    )
    if (!kind || existing.has(`${kind}:${equipment.id}`)) return []
    return [{ kind, targetId: equipment.id, label: equipment.label }]
  })
  const languageOptions = (params.resolution.registry.system?.languages ?? []).flatMap((language) =>
    existing.has(`LANGUAGE:${language.id}`)
      ? []
      : [{ kind: 'LANGUAGE' as const, targetId: language.id, label: language.label }]
  )

  return {
    kind: 'PROFICIENCIES',
    panelId: 'proficiencies',
    characterId: params.character.id,
    target,
    title: 'Proficiencies',
    state: resolvePanelState(params.adjustments, target),
    editable: params.editable,
    allowedCommands: [...CORE_PANEL_COMMANDS],
    proficiencies,
    additionOptions: [...languageOptions, ...equipmentOptions].sort((left, right) =>
      left.label.localeCompare(right.label)
    )
  }
}

type SheetSpell = CharacterSheetResponseDto['spells']['spells'][number]
type SheetSpellSource = NonNullable<SheetSpell['sources']>[number]

function formatSpellLevel(level: number): string {
  return level === 0 ? 'Cantrip' : `Level ${level}`
}

function formatSpellCastingTime(spell: SheetSpell): string | undefined {
  if (!spell.castingTime) return undefined
  return `${spell.castingTime.amount} ${formatCode(spell.castingTime.unit).toLowerCase()}`
}

function applySpellDamageBonus(expression: string, bonus: number): string {
  if (bonus === 0) return expression
  return `${expression} ${bonus > 0 ? '+' : '-'} ${Math.abs(bonus)}`
}

function resolveSpellOutcomeLabel(
  outcome: NonNullable<SheetSpell['mechanics']>[number]['outcomes'][number],
  castLevel: number,
  damageBonus: number
): string {
  switch (outcome.kind) {
    case 'DAMAGE': {
      const expression =
        outcome.scaling?.find((entry) => entry.level === castLevel)?.expression ??
        outcome.expression
      return `${applySpellDamageBonus(expression, damageBonus)} ${outcome.damageTypeLabel} damage`
    }
    case 'HEAL': {
      const expression =
        outcome.scaling?.find((entry) => entry.level === castLevel)?.expression ??
        outcome.expression
      return `${expression} ${outcome.temporary ? 'temporary hit points' : 'healing'}`
    }
    case 'CONDITION':
      return outcome.label
    case 'EFFECT':
      return outcome.label ?? formatCode(outcome.effectKind)
  }
}

function findSpellAdjustment(
  params: BuildCharacterSheetPanelParams,
  source: SheetSpellSource['source'],
  field: Extract<CharacterSheetAdjustment, { family: 'SPELL' }>['field']
) {
  const sourceKey = createCharacterSpellSourceKey(source)
  return findAdjustment(
    params.adjustments,
    'SPELL',
    (adjustment) =>
      createCharacterSpellSourceKey(adjustment.source) === sourceKey && adjustment.field === field
  )
}

function findItemAdjustment(
  params: BuildCharacterSheetPanelParams,
  itemInstanceId: string,
  field: Extract<CharacterSheetAdjustment, { family: 'ITEM' }>['field']
) {
  return findAdjustment(
    params.adjustments,
    'ITEM',
    (adjustment) => adjustment.itemInstanceId === itemInstanceId && adjustment.field === field
  )
}

function formatItemMeasurement(
  measurement: CharacterSheetResponseDto['inventory']['items'][number]['weight']
): string | undefined {
  if (!measurement) return undefined
  return `${measurement.amount} ${formatCode(measurement.unit).toLowerCase()}`
}

function buildItemPanel(
  params: BuildCharacterSheetPanelParams,
  ruleProjection: CharacterSheetRuleProjection,
  target: Extract<CharacterSheetPanelTargetDto, { kind: 'ITEM' }>
): CharacterSheetPanelDto {
  const item = params.sheet.inventory.items.find(
    (candidate) => candidate.id === target.itemInstanceId
  )
  if (!item) {
    throw new Error(
      `Owned item "${target.itemInstanceId}" is not available on this character sheet.`
    )
  }

  const mechanics = ruleProjection.itemMechanics.find(
    (candidate) => candidate.itemInstanceId === target.itemInstanceId
  )
  const equipment = params.resolution.registry.equipment.find(
    (candidate) => candidate.id === item.equipmentId
  )
  const features = (equipment?.features ?? []).flatMap((feature) => {
    if (feature.attributes?.includes(FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET)) return []
    const chargeUse = ruleProjection.equipmentFeatureChargeUses.find(
      (use) =>
        use.featureId === feature.id &&
        use.equipmentId === item.equipmentId &&
        use.itemInstanceId === item.id
    )
    const description = params.presentation.features[feature.id]?.description
    return [
      {
        id: feature.id,
        label: feature.label,
        ...(description ? { description } : {}),
        ...(chargeUse
          ? {
              resourceCost: chargeUse.cost,
              resourceGrantId: createCharacterResourceOwnerKey({
                kind: 'ITEM_INSTANCE',
                chargeId: chargeUse.chargeId,
                itemInstanceId: chargeUse.itemInstanceId
              })
            }
          : {})
      }
    ]
  })
  // The item's resolved attacks, including its manual attack and damage adjustments.
  const actionPrefix = characterSourceActionIdPrefix(
    createCharacterMechanicSourceKey({
      kind: 'EQUIPMENT_INSTANCE',
      equipmentId: item.equipmentId,
      itemInstanceId: item.id
    })
  )
  const attacks = params.sheet.actions.items.flatMap((action) =>
    action.id.startsWith(actionPrefix) && action.mechanic?.attackBonus !== undefined
      ? [action.mechanic]
      : []
  )
  const attackFacts =
    attacks.length === 0
      ? []
      : [
          {
            label: 'Attack bonus',
            value: [
              ...new Set(
                attacks.map((attack) =>
                  (attack.attackBonus ?? 0) >= 0
                    ? `+${attack.attackBonus}`
                    : String(attack.attackBonus)
                )
              )
            ].join(' / ')
          },
          {
            label: 'Damage',
            value: attacks
              .map((attack) =>
                attack.outcomes
                  .flatMap((outcome) =>
                    outcome.kind === 'DAMAGE'
                      ? [`${outcome.expression} ${outcome.damageTypeLabel.toLowerCase()}`]
                      : []
                  )
                  .join(' + ')
              )
              .filter((damage) => damage.length > 0)
              .join(' / ')
          }
        ]
  const numericEditors = [
    ['ATTACK_BONUS', 'Attack bonus', { integer: true }],
    ['ATTACK_OVERRIDE', 'Attack override', { integer: true }],
    ['DAMAGE_BONUS', 'Damage bonus', { integer: true }],
    ['COST_OVERRIDE', 'Cost override', { integer: true, minimum: 0 }],
    ['WEIGHT_OVERRIDE', 'Weight override', { integer: false, minimum: 0 }]
  ] as const
  const propertyEditors = [
    ['SILVERED', 'Silvered'],
    ['ADAMANTINE', 'Adamantine'],
    ['DUAL_WIELD', 'Dual wield'],
    ['DISPLAY_AS_ATTACK', 'Display in Actions']
  ] as const
  const manualPropertyLabels = mechanics
    ? [
        mechanics.properties.silvered ? 'Silvered' : undefined,
        mechanics.properties.adamantine ? 'Adamantine' : undefined,
        mechanics.properties.dualWield ? 'Dual wield' : undefined,
        mechanics.displayAsAttack ? 'Display in Actions' : undefined
      ].filter((label): label is string => Boolean(label))
    : []
  const facts = [
    ...(item.category ? [{ label: 'Category', value: formatCode(item.category) }] : []),
    { label: 'Quantity', value: String(item.quantity) },
    ...(formatItemMeasurement(item.weight)
      ? [{ label: 'Weight', value: formatItemMeasurement(item.weight)! }]
      : []),
    ...(item.cost
      ? [
          {
            label: 'Cost',
            value: `${item.cost.amount} ${item.costLabel ?? 'currency'}`
          }
        ]
      : []),
    ...(item.armorClass !== undefined
      ? [{ label: 'Armor class', value: String(item.armorClass) }]
      : []),
    ...(item.degradation !== undefined
      ? [
          {
            label: 'Corrosion',
            value: `-${item.degradation} ${item.armorClass !== undefined ? 'armor class' : 'damage rolls'}`
          }
        ]
      : []),
    ...(item.properties?.length
      ? [
          {
            label: 'Properties',
            value: item.properties.map((property) => property.label).join(', ')
          }
        ]
      : []),
    ...attackFacts,
    ...(manualPropertyLabels.length
      ? [{ label: 'Manual properties', value: manualPropertyLabels.join(', ') }]
      : [])
  ]
  const resources = params.sheet.resources.items.flatMap((resource) =>
    resource.owner.kind === 'ITEM_INSTANCE' && resource.owner.itemInstanceId === item.id
      ? [
          {
            id: resource.id,
            target: { kind: 'RESOURCE' as const, owner: resource.owner },
            label: resource.label,
            remaining: resource.remaining,
            maximum: resource.max,
            recoveries: resource.recoveries
          }
        ]
      : []
  )

  return {
    kind: 'ITEM',
    panelId: `item:${item.id}`,
    characterId: params.character.id,
    target,
    title: item.label,
    state: resolvePanelState(params.adjustments, target),
    editable: params.editable,
    allowedCommands: [
      'UPSERT_ADJUSTMENT',
      'REMOVE_ADJUSTMENT',
      'RESET_ADJUSTMENTS',
      'UPDATE_OWNED_ITEM',
      'REMOVE_OWNED_ITEM',
      'SET_ITEM_EQUIPPED',
      'SET_ITEM_ATTUNED',
      'USE_RESOURCE',
      'RECOVER_RESOURCE'
    ],
    itemInstanceId: item.id,
    equipmentId: item.equipmentId,
    authoredName: item.equipmentLabel ?? item.label,
    displayName: item.label,
    ...(item.description ? { description: item.description } : {}),
    facts,
    equippedSlot: item.equippedSlot,
    attuned: item.attuned,
    requiresAttunement: item.requiresAttunement,
    features,
    numericEditors: numericEditors.map(([field, label, validation]) => {
      const adjustment = findItemAdjustment(params, item.id, field)
      return {
        kind: 'NUMBER' as const,
        field,
        label,
        value: typeof adjustment?.value === 'number' ? adjustment.value : null,
        commitIntent: 'ON_BLUR_OR_ENTER' as const,
        validation,
        ...adjustmentEditorMetadata(adjustment)
      }
    }),
    propertyEditors: propertyEditors.map(([field, label]) => {
      const adjustment = findItemAdjustment(params, item.id, field)
      return {
        kind: 'BOOLEAN' as const,
        field,
        label,
        value: adjustment?.value === true,
        commitIntent: 'IMMEDIATE' as const,
        ...adjustmentEditorMetadata(adjustment)
      }
    }),
    textEditors: [
      {
        kind: 'TEXT',
        field: 'CUSTOM_NAME',
        label: 'Custom name',
        value: item.customName ?? null,
        multiline: false,
        maximumLength: 120,
        commitIntent: 'ON_BLUR_OR_ENTER'
      },
      {
        kind: 'TEXT',
        field: 'NOTES',
        label: 'Item notes',
        value: item.notes ?? null,
        multiline: true,
        maximumLength: 2000,
        commitIntent: 'ON_BLUR_OR_ENTER'
      }
    ],
    resources
  }
}

function buildSpellCustomizationOptions(
  params: BuildCharacterSheetPanelParams,
  spell: SheetSpell,
  source: SheetSpellSource
): Extract<CharacterSheetPanelDto, { kind: 'SPELL' }>['customizationOptions'] {
  const mechanics = spell.mechanics ?? []
  const hasAttack = mechanics.some((mechanic) => mechanic.attackBonus !== undefined)
  const hasSave = mechanics.some((mechanic) => mechanic.save !== undefined)
  const hasDamage = mechanics.some((mechanic) =>
    mechanic.outcomes.some((outcome) => outcome.kind === 'DAMAGE')
  )

  const numericOption = (
    category: 'TO_HIT' | 'SAVE_DC' | 'DAMAGE',
    label: string,
    supportedModes: readonly ('BONUS' | 'OVERRIDE')[],
    bonusField: 'ATTACK_BONUS' | 'DC_BONUS' | 'DAMAGE_BONUS',
    overrideField?: 'ATTACK_OVERRIDE' | 'DC_OVERRIDE'
  ) => {
    const override = overrideField
      ? findSpellAdjustment(params, source.source, overrideField)
      : undefined
    const bonus = findSpellAdjustment(params, source.source, bonusField)
    const configured = override ?? bonus
    return {
      category,
      label,
      supportedModes: [...supportedModes],
      ...(configured
        ? {
            configured: {
              adjustmentId: configured.id,
              mode: override ? ('OVERRIDE' as const) : ('BONUS' as const),
              value: configured.value,
              ...(configured.sourceNote ? { sourceNote: configured.sourceNote } : {})
            }
          }
        : {})
    }
  }

  return [
    ...(hasAttack
      ? [
          numericOption(
            'TO_HIT',
            'To Hit',
            ['BONUS', 'OVERRIDE'],
            'ATTACK_BONUS',
            'ATTACK_OVERRIDE'
          )
        ]
      : []),
    ...(hasSave
      ? [numericOption('SAVE_DC', 'Save DC', ['BONUS', 'OVERRIDE'], 'DC_BONUS', 'DC_OVERRIDE')]
      : []),
    ...(hasDamage ? [numericOption('DAMAGE', 'Damage', ['BONUS'], 'DAMAGE_BONUS')] : [])
  ]
}

type CharacterSheetSpellSource = NonNullable<
  CharacterSheetResponseDto['spells']['spells'][number]['sources']
>[number]

function getKnownSpellPanelFields(
  params: BuildCharacterSheetPanelParams,
  source: CharacterSheetSpellSource
) {
  const canManageKnown =
    source.classId !== undefined &&
    params.knownSpellEligibleIdsByClass.get(source.classId)?.has(source.source.spellId) === true &&
    source.acquisition !== 'ALWAYS_PREPARED' &&
    source.acquisition !== 'GRANTED' &&
    (source.source.sourceKind === 'CLASS' || source.source.sourceKind === 'SUBCLASS')
  return {
    known:
      canManageKnown && source.classId
        ? getKnownSpellIdsForClassIntent(params.character, source.classId).has(
            source.source.spellId
          )
        : false,
    canManageKnown,
    ...(canManageKnown && source.classId ? { knownClassId: source.classId } : {})
  }
}

function buildSpellPanel(
  params: BuildCharacterSheetPanelParams,
  ruleProjection: CharacterSheetRuleProjection,
  target: Extract<CharacterSheetPanelTargetDto, { kind: 'SPELL' }>
): CharacterSheetPanelDto {
  const spell = params.sheet.spells.spells.find(
    (candidate) => candidate.id === target.source.spellId
  )
  const sourceKey = createCharacterSpellSourceKey(target.source)
  const source = spell?.sources?.find(
    (candidate) => createCharacterSpellSourceKey(candidate.source) === sourceKey
  )
  if (!spell || !source) {
    throw new Error(`Spell source "${sourceKey}" is not available on this character sheet.`)
  }

  const sourceMechanics = ruleProjection.spellMechanics.find(
    (candidate) => createCharacterSpellSourceKey(candidate.source) === sourceKey
  )
  const castLevel = target.castLevel ?? source.fixedLevel ?? spell.level
  const knownSource = getKnownSpellPanelFields(params, source)
  const effects = (spell.mechanics ?? []).flatMap((mechanic) =>
    mechanic.outcomes.map((outcome) => ({
      label: formatCode(outcome.kind),
      value: resolveSpellOutcomeLabel(outcome, castLevel, sourceMechanics?.damageBonus ?? 0)
    }))
  )
  const activeEntries = params.sheet.spells.activeGroups
    .flatMap((group) => group.entries)
    .filter((entry) => createCharacterSpellSourceKey(entry.source) === sourceKey)
    .sort(
      (left, right) =>
        Number(right.castLevel === castLevel) - Number(left.castLevel === castLevel) ||
        left.castLevel - right.castLevel
    )
  const facts = [
    {
      label: 'Level',
      value: `${formatSpellLevel(spell.level)}${spell.school ? ` ${formatCode(spell.school).toLowerCase()}` : ''}`
    },
    ...(formatSpellCastingTime(spell)
      ? [{ label: 'Casting time', value: formatSpellCastingTime(spell)! }]
      : []),
    ...((spell.mechanics ?? []).find((mechanic) => mechanic.rangeLabel)?.rangeLabel
      ? [
          {
            label: 'Range',
            value: (spell.mechanics ?? []).find((mechanic) => mechanic.rangeLabel)!.rangeLabel!
          }
        ]
      : []),
    ...(spell.components?.length
      ? [{ label: 'Components', value: spell.components.map(formatCode).join(', ') }]
      : []),
    ...(spell.materialDescription
      ? [{ label: 'Materials', value: spell.materialDescription }]
      : []),
    ...(sourceMechanics?.attackBonus !== undefined
      ? [
          {
            label: 'Spell attack',
            value:
              sourceMechanics.attackBonus >= 0
                ? `+${sourceMechanics.attackBonus}`
                : String(sourceMechanics.attackBonus)
          }
        ]
      : []),
    ...(sourceMechanics?.saveDC !== undefined
      ? [{ label: 'Save DC', value: String(sourceMechanics.saveDC) }]
      : [])
  ]

  return {
    kind: 'SPELL',
    panelId: `spell:${sourceKey}:${castLevel}`,
    characterId: params.character.id,
    target,
    title: source.customName ?? spell.label,
    state: resolvePanelState(params.adjustments, target),
    editable: params.editable,
    allowedCommands: [
      'CAST_SPELL',
      ...(knownSource.canManageKnown ? (['SET_KNOWN_SPELLS'] as const) : []),
      'SET_SPELL_MECHANIC_CUSTOMIZATION',
      'REMOVE_SPELL_MECHANIC_CUSTOMIZATION',
      'UPDATE_SPELL_SOURCE_CUSTOMIZATION',
      'RESET_ADJUSTMENTS'
    ],
    source: source.source,
    sourceLabel: source.label,
    spellId: spell.id,
    displayName: source.customName ?? spell.label,
    authoredName: spell.label,
    ...(spell.description ? { description: spell.description } : {}),
    facts,
    effects,
    references: [],
    prepared: Boolean(source.prepared),
    canPrepare: source.canPrepare,
    ...(source.classId ? { preparationClassId: source.classId } : {}),
    ...knownSource,
    displayAsAttack: Boolean(source.displayAsAttack),
    legalCastModes: activeEntries.map((entry) => ({
      kind: source.castMode ?? (spell.level === 0 ? 'AT_WILL' : 'SPELL_SLOT'),
      label: entry.castLevel === 0 ? 'Cast at will' : `Cast at level ${entry.castLevel}`,
      ...(entry.cast.slotKey ? { slotKey: entry.cast.slotKey } : {}),
      castLevel: entry.castLevel,
      available: entry.available,
      ...(entry.unavailableReason ? { unavailableReason: entry.unavailableReason } : {}),
      ...params.castSummonPickOptions?.({ spellId: spell.id, castLevel: entry.castLevel })
    })),
    calculations: {
      ...(spell.mechanics?.some((mechanic) => mechanic.attackBonus !== undefined) &&
      sourceMechanics?.calculations.attackBonus
        ? {
            attackBonus: toPanelCalculation(sourceMechanics.calculations.attackBonus, params)
          }
        : {}),
      ...(spell.mechanics?.some((mechanic) => mechanic.save !== undefined) &&
      sourceMechanics?.calculations.saveDC
        ? { saveDC: toPanelCalculation(sourceMechanics.calculations.saveDC, params) }
        : {}),
      ...(spell.mechanics?.some((mechanic) =>
        mechanic.outcomes.some((outcome) => outcome.kind === 'DAMAGE')
      ) && sourceMechanics
        ? {
            damageBonus: toPanelCalculation(sourceMechanics.calculations.damageBonus, params)
          }
        : {})
    },
    customizationOptions: buildSpellCustomizationOptions(params, spell, source),
    textEditors: [
      {
        kind: 'TEXT',
        field: 'CUSTOM_NAME',
        label: 'Custom name',
        value: source.customName ?? null,
        multiline: false,
        maximumLength: 120,
        commitIntent: 'ON_BLUR_OR_ENTER'
      },
      {
        kind: 'TEXT',
        field: 'NOTES',
        label: 'Spell notes',
        value: source.notes ?? null,
        multiline: true,
        maximumLength: 2000,
        commitIntent: 'ON_BLUR_OR_ENTER'
      }
    ]
  }
}

function buildSpellsPanel(
  params: BuildCharacterSheetPanelParams,
  target: Extract<CharacterSheetPanelTargetDto, { kind: 'SPELLS' }>
): CharacterSheetPanelDto {
  const sources = params.sheet.spells.spells.flatMap((spell) =>
    (spell.sources ?? []).map((source) => ({
      ...getKnownSpellPanelFields(params, source),
      target: { kind: 'SPELL' as const, source: source.source },
      source: source.source,
      spellId: spell.id,
      label: source.customName ?? spell.label,
      sourceLabel: source.label,
      level: spell.level,
      prepared: Boolean(source.prepared),
      canPrepare: source.canPrepare,
      ...(source.classId ? { preparationClassId: source.classId } : {}),
      state: resolvePanelState(params.adjustments, {
        kind: 'SPELL',
        source: source.source
      })
    }))
  )

  return {
    kind: 'SPELLS',
    panelId: 'spells',
    characterId: params.character.id,
    target,
    title: 'Manage Spells',
    state: resolvePanelState(params.adjustments, target),
    editable: params.editable,
    allowedCommands: [
      'SET_PREPARED_SPELLS',
      'SET_KNOWN_SPELLS',
      'USE_SPELL_SLOT',
      'RESTORE_SPELL_SLOT'
    ],
    slots: params.sheet.spells.slots.map((slot) => ({
      slotKey: slot.slotKey,
      label: slot.label,
      used: slot.used,
      maximum: slot.max,
      remaining: slot.remaining
    })),
    groups: [...new Set(sources.map((source) => source.level))]
      .sort((left, right) => left - right)
      .map((level) => ({
        level,
        label: formatSpellLevel(level),
        sources: sources
          .filter((source) => source.level === level)
          .map(({ level: _level, ...source }) => source)
          .sort(
            (left, right) =>
              left.label.localeCompare(right.label) ||
              createCharacterSpellSourceKey(left.source).localeCompare(
                createCharacterSpellSourceKey(right.source)
              )
          )
      }))
  }
}

function buildExtrasPanel(
  params: BuildCharacterSheetPanelParams,
  target: Extract<CharacterSheetPanelTargetDto, { kind: 'EXTRAS' }>
): CharacterSheetPanelDto {
  const items = params.sheet.extras.items
  return {
    kind: 'EXTRAS',
    panelId: 'extras',
    characterId: params.character.id,
    target,
    title: 'Extras',
    state: 'DEFAULT',
    editable: params.editable,
    allowedCommands: ['ADD_EXTRA'],
    companionCount: items.filter((item) => item.kind === 'COMPANION').length,
    mountCount: items.filter((item) => item.kind === 'MOUNT').length,
    ownedCreatureCount: items.filter((item) => item.kind === 'OWNED').length,
    vehicleCount: items.filter((item) => item.kind === 'VEHICLE').length
  }
}

function buildResourcePanel(
  params: BuildCharacterSheetPanelParams,
  target: Extract<CharacterSheetPanelTargetDto, { kind: 'RESOURCE' }>
): CharacterSheetPanelDto {
  const resourceId = createCharacterResourceOwnerKey(toCharacterResourceOwnerKey(target.owner))
  const resource = params.sheet.resources.items.find((item) => item.id === resourceId)
  if (!resource) {
    throw new Error(`Resource "${resourceId}" is not available on this character sheet.`)
  }

  return {
    kind: 'RESOURCE',
    panelId: `resource:${resourceId}`,
    characterId: params.character.id,
    target,
    title: resource.label,
    ...(resource.description ? { description: resource.description } : {}),
    state: 'DEFAULT',
    editable: params.editable,
    allowedCommands: ['USE_RESOURCE', 'RECOVER_RESOURCE'],
    owner: resource.owner,
    sourceLabel: resource.sourceLabel,
    used: resource.used,
    maximum: resource.max,
    remaining: resource.remaining,
    recoveries: resource.recoveries
  }
}

function buildCompanionPanel(
  params: BuildCharacterSheetPanelParams,
  target: Extract<CharacterSheetPanelTargetDto, { kind: 'COMPANION' }>
): CharacterSheetPanelDto {
  const companion = params.sheet.extras.items.find((item) => item.id === target.companionInstanceId)
  if (!companion || companion.kind === 'VEHICLE' || companion.kind === 'SPELL_SUMMON') {
    throw new Error(
      `Creature "${target.companionInstanceId}" is not available on this character sheet.`
    )
  }
  const resources = params.sheet.resources.items.flatMap((resource) =>
    resource.owner.kind === 'COMPANION_FEATURE' &&
    resource.owner.companionInstanceId === companion.id
      ? [
          {
            target: { kind: 'RESOURCE' as const, owner: resource.owner },
            label: resource.label,
            remaining: resource.remaining,
            maximum: resource.max,
            recoveries: resource.recoveries
          }
        ]
      : []
  )
  const facts = [
    { label: 'Stat block', value: companion.authoredName },
    { label: 'Origin', value: companion.originLabel },
    { label: 'Armor class', value: String(companion.armorClass) },
    ...(companion.speedLabel ? [{ label: 'Speed', value: companion.speedLabel }] : []),
    ...(companion.carryingCapacityLabel
      ? [{ label: 'Carrying capacity', value: companion.carryingCapacityLabel }]
      : []),
    ...(companion.riderCapacity === undefined
      ? []
      : [{ label: 'Rider capacity', value: String(companion.riderCapacity) }])
  ]
  const armorClass = findCompanionAdjustment(params, companion.id, 'ARMOR_CLASS_OVERRIDE')
  const maximumHitPoints = findCompanionAdjustment(
    params,
    companion.id,
    'MAXIMUM_HIT_POINTS_OVERRIDE'
  )
  const size = findCompanionAdjustment(params, companion.id, 'SIZE_OVERRIDE')
  const alignment = findCompanionAdjustment(params, companion.id, 'ALIGNMENT_OVERRIDE')
  const creatureType = findCompanionAdjustment(params, companion.id, 'CREATURE_TYPE_OVERRIDE')
  return {
    kind: 'COMPANION',
    panelId: `companion:${companion.id}`,
    characterId: params.character.id,
    target,
    title: companion.displayName,
    state: resolvePanelState(params.adjustments, target),
    editable: params.editable,
    allowedCommands: [
      ...CORE_PANEL_COMMANDS,
      'USE_RESOURCE',
      'RECOVER_RESOURCE',
      'UPDATE_EXTRA',
      'REMOVE_EXTRA'
    ],
    companionInstanceId: companion.id,
    creatureId: companion.creatureId,
    relationshipKind: companion.relationshipKind,
    relationshipLabel: companion.relationshipLabel,
    originKind: companion.originKind,
    originLabel: companion.originLabel,
    authoredName: companion.authoredName,
    displayName: companion.displayName,
    isActive: companion.isActive,
    armorClass: companion.armorClass,
    ...(companion.size ? { size: companion.size } : {}),
    ...(companion.alignmentId ? { alignmentId: companion.alignmentId } : {}),
    ...(companion.creatureTypeId ? { creatureTypeId: companion.creatureTypeId } : {}),
    hitPoints: companion.hitPoints,
    hitDice: companion.hitDice,
    facts,
    actions: companion.actions,
    features: companion.features,
    equipmentItemIds: companion.equipmentItemIds,
    resources,
    numericEditors: [
      {
        kind: 'NUMBER' as const,
        field: 'ARMOR_CLASS_OVERRIDE',
        label: 'Override armor class',
        value: typeof armorClass?.value === 'number' ? armorClass.value : null,
        commitIntent: 'ON_BLUR_OR_ENTER' as const,
        validation: { integer: true, minimum: 0 },
        ...adjustmentEditorMetadata(armorClass)
      },
      {
        kind: 'NUMBER' as const,
        field: 'MAXIMUM_HIT_POINTS_OVERRIDE',
        label: 'Override maximum hit points',
        value: typeof maximumHitPoints?.value === 'number' ? maximumHitPoints.value : null,
        commitIntent: 'ON_BLUR_OR_ENTER' as const,
        validation: { integer: true, minimum: 0 },
        ...adjustmentEditorMetadata(maximumHitPoints)
      }
    ],
    selectEditors: [
      {
        kind: 'SELECT' as const,
        field: 'SIZE_OVERRIDE',
        label: 'Override size',
        value: size?.field === 'SIZE_OVERRIDE' ? size.value : null,
        options: systemCoreCodeRegistry
          .entries(params.character.systemId, 'size')
          .map(({ code, label }) => ({ value: code, label })),
        commitIntent: 'IMMEDIATE' as const,
        ...adjustmentEditorMetadata(size)
      },
      {
        kind: 'SELECT' as const,
        field: 'ALIGNMENT_OVERRIDE',
        label: 'Override alignment',
        value: alignment?.field === 'ALIGNMENT_OVERRIDE' ? alignment.value : null,
        options: vocabularyOptions(params.resolution.registry.system?.alignments),
        commitIntent: 'IMMEDIATE' as const,
        ...adjustmentEditorMetadata(alignment)
      },
      {
        kind: 'SELECT' as const,
        field: 'CREATURE_TYPE_OVERRIDE',
        label: 'Override creature type',
        value: creatureType?.field === 'CREATURE_TYPE_OVERRIDE' ? creatureType.value : null,
        options: vocabularyOptions(params.resolution.registry.system?.creatureTypes),
        commitIntent: 'IMMEDIATE' as const,
        ...adjustmentEditorMetadata(creatureType)
      }
    ],
    textEditors: [
      {
        kind: 'TEXT',
        field: 'CUSTOM_NAME',
        label: 'Custom name',
        value: companion.customName ?? null,
        multiline: false,
        maximumLength: 120,
        commitIntent: 'ON_BLUR_OR_ENTER'
      },
      {
        kind: 'TEXT',
        field: 'NOTES',
        label: 'Notes',
        value: companion.notes ?? null,
        multiline: true,
        maximumLength: 2000,
        commitIntent: 'ON_BLUR_OR_ENTER'
      }
    ]
  }
}

function buildVehiclePanel(
  params: BuildCharacterSheetPanelParams,
  target: Extract<CharacterSheetPanelTargetDto, { kind: 'VEHICLE' }>
): CharacterSheetPanelDto {
  const vehicle = params.sheet.extras.items.find(
    (item) => item.kind === 'VEHICLE' && item.id === target.vehicleInstanceId
  )
  if (!vehicle || vehicle.kind !== 'VEHICLE') {
    throw new Error(
      `Vehicle "${target.vehicleInstanceId}" is not available on this character sheet.`
    )
  }
  const facts = [
    { label: 'Vehicle type', value: vehicle.authoredName },
    { label: 'Category', value: vehicle.categoryLabel },
    ...(vehicle.speedLabel ? [{ label: 'Speed', value: vehicle.speedLabel }] : []),
    ...(vehicle.crewLabel ? [{ label: 'Crew', value: vehicle.crewLabel }] : []),
    ...(vehicle.passengerCapacity === undefined
      ? []
      : [{ label: 'Passengers', value: String(vehicle.passengerCapacity) }]),
    ...(vehicle.cargoCapacityLabel ? [{ label: 'Cargo', value: vehicle.cargoCapacityLabel }] : [])
  ]
  return {
    kind: 'VEHICLE',
    panelId: `vehicle:${vehicle.id}`,
    characterId: params.character.id,
    target,
    title: vehicle.displayName,
    state: 'DEFAULT',
    editable: params.editable,
    allowedCommands: ['UPDATE_EXTRA', 'REMOVE_EXTRA'],
    vehicleInstanceId: vehicle.id,
    vehicleId: vehicle.vehicleId,
    authoredName: vehicle.authoredName,
    displayName: vehicle.displayName,
    categoryLabel: vehicle.categoryLabel,
    isActive: vehicle.isActive,
    hitPoints: vehicle.hitPoints,
    facts,
    actions: vehicle.actions,
    features: vehicle.features,
    equipmentItemIds: vehicle.equipmentItemIds,
    textEditors: [
      {
        kind: 'TEXT',
        field: 'CUSTOM_NAME',
        label: 'Custom name',
        value: vehicle.customName ?? null,
        multiline: false,
        maximumLength: 120,
        commitIntent: 'ON_BLUR_OR_ENTER'
      },
      {
        kind: 'TEXT',
        field: 'NOTES',
        label: 'Notes',
        value: vehicle.notes ?? null,
        multiline: true,
        maximumLength: 2000,
        commitIntent: 'ON_BLUR_OR_ENTER'
      }
    ]
  }
}

interface BuildCharacterSheetPanelParams {
  character: CharacterAuthored
  resolution: CharacterBuilderResolution
  presentation: CharacterPresentationLookup
  sheet: CharacterSheetResponseDto
  ruleProjection: CharacterSheetRuleProjection
  knownSpellEligibleIdsByClass: ReadonlyMap<string, ReadonlySet<string>>
  adjustments: readonly CharacterSheetAdjustment[]
  movementDisplayPreference: CharacterMovementDisplayPreference
  target: CharacterSheetPanelTargetDto
  editable: boolean
  castSummonPickOptions?: (cast: { spellId: string; castLevel: number }) => SummonPickOptionsDto
}

export function buildCharacterSheetPanel(
  params: BuildCharacterSheetPanelParams
): CharacterSheetPanelDto {
  const ruleProjection = params.ruleProjection
  let panel: CharacterSheetPanelDto
  switch (params.target.kind) {
    case 'ABILITY':
      panel = buildAbilityPanel(params, ruleProjection, params.target)
      break
    case 'SAVING_THROW':
      panel = buildSavingThrowPanel(params, ruleProjection, params.target)
      break
    case 'SKILL':
      panel = buildSkillPanel(params, ruleProjection, params.target)
      break
    case 'SKILLS':
      panel = buildSkillsPanel(params, params.target)
      break
    case 'SENSES':
      panel = buildSensesPanel(params, ruleProjection, params.target)
      break
    case 'MOVEMENT':
      panel = buildMovementPanel(params, ruleProjection, params.target)
      break
    case 'DEFENSES':
      panel = buildDefensePanel(params, ruleProjection, params.target)
      break
    case 'PROFICIENCIES':
      panel = buildProficiencyPanel(params, ruleProjection, params.target)
      break
    case 'SPELL':
      panel = buildSpellPanel(params, ruleProjection, params.target)
      break
    case 'SPELLS':
      panel = buildSpellsPanel(params, params.target)
      break
    case 'ITEM':
      panel = buildItemPanel(params, ruleProjection, params.target)
      break
    case 'EXTRAS':
      panel = buildExtrasPanel(params, params.target)
      break
    case 'RESOURCE':
      panel = buildResourcePanel(params, params.target)
      break
    case 'COMPANION':
      panel = buildCompanionPanel(params, params.target)
      break
    case 'VEHICLE':
      panel = buildVehiclePanel(params, params.target)
      break
    case 'FEATURE':
    case 'BACKGROUND':
    case 'HIT_POINTS':
      throw new Error(`Character Sheet panel "${params.target.kind}" is not implemented yet.`)
  }
  return characterSheetPanelDtoSchema.parse(panel)
}
