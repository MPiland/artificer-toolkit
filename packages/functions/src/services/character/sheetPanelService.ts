import type {
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characters'
import {
  characterSheetPanelDtoSchema,
  type CharacterSheetPanelDto,
  type CharacterSheetPanelNumericCalculationDto,
  type CharacterSheetPanelTargetDto
} from '@artificer-toolkit/schema/api/characterSheetPanel'
import {
  ABILITIES,
  type AbilityCode,
  type CharacterCalculation,
  type CharacterMechanicSourceRef,
  type EngineCharacterOutput,
  type EngineProficiency
} from '@artificer-toolkit/shared/core'
import type {
  CharacterMovementDisplayPreference,
  CharacterSheetAdjustment
} from '@artificer-toolkit/shared/character'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

import type { CharacterBuilderResolution } from './builderService.js'
import {
  resolveCharacterSheetEngine,
  resolveCharacterSheetSkillKey
} from './sheetService.js'
import {
  characterSheetAdjustmentMatchesPanelTarget
} from './sheetPanelTarget.js'

const CORE_PANEL_COMMANDS = [
  'UPSERT_ADJUSTMENT',
  'REMOVE_ADJUSTMENT',
  'RESET_ADJUSTMENTS'
] as const

const PROFICIENCY_OPTIONS = [
  { value: 'NONE', label: 'Not proficient' },
  { value: 'HALF', label: 'Half proficiency' },
  { value: 'FULL', label: 'Proficient' },
  { value: 'DOUBLE', label: 'Expertise' }
]

const ABILITY_OPTIONS = Object.values(ABILITIES).map((ability) => ({
  value: ability.code,
  label: ability.label
}))

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
    sourceCategory: adjustment?.sourceCategory ?? ('MANUAL' as const),
    ...(adjustment?.sourceLabel ? { sourceLabel: adjustment.sourceLabel } : {}),
    ...(adjustment?.sourceNote ? { sourceNote: adjustment.sourceNote } : {})
  }
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
        label:
          adjustment?.sourceLabel ??
          (adjustment ? formatCode(adjustment.sourceCategory) : 'Manual adjustment'),
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
    case 'AUTHORED': {
      const authoredRecords = [
        ...params.resolution.registry.races,
        ...params.resolution.registry.classes,
        ...params.resolution.registry.backgrounds,
        ...params.resolution.registry.features,
        ...(params.resolution.registry.feats ?? [])
      ]
      const definition = authoredRecords.find(
        (candidate) => candidate.id === source.definitionId
      )
      const grantedFeature = params.resolution.grants.features.find(
        (candidate) => candidate.id === source.definitionId
      )
      return {
        label:
          definition?.label ??
          grantedFeature?.label ??
          `${formatCode(source.sourceKind)} source`
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
    ? context.adjustments.find(
        (adjustment) => adjustment.id === resolved.override?.adjustmentId
      )
    : undefined

  return {
    base: resolved.base,
    contributions: resolved.contributions.map((contribution) => {
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
    ...(resolved.override
      ? {
          override: {
            adjustmentId: resolved.override.adjustmentId,
            value: resolved.override.value,
            sourceLabel:
              overrideAdjustment?.sourceLabel ??
              (overrideAdjustment
                ? formatCode(overrideAdjustment.sourceCategory)
                : 'Manual override'),
            ...(overrideAdjustment?.sourceNote
              ? { sourceNote: overrideAdjustment.sourceNote }
              : {})
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

function findEngineSkillKey(
  resolution: CharacterBuilderResolution,
  skillId: string
): string {
  return resolveCharacterSheetSkillKey(resolution.registry.system?.skills, skillId)
}

function findPassiveSkill(
  sheet: CharacterSheetResponseDto,
  passive: { code?: string; label: string }
) {
  const passiveText = `${passive.code ?? ''} ${passive.label}`.toUpperCase()
  return sheet.overview.skills.find((skill) => {
    const skillText = `${skill.code} ${skill.label}`.toUpperCase()
    return passiveText.includes(skill.code.toUpperCase()) || skillText.includes(passive.label.toUpperCase())
  })
}

function getProficiencyTargetKind(
  proficiency: EngineProficiency,
  resolution: CharacterBuilderResolution
): 'ARMOR' | 'LANGUAGE' | 'TOOL' | 'WEAPON' | undefined {
  if (proficiency.kind === 'LANGUAGE') return 'LANGUAGE'
  if (proficiency.kind !== 'EQUIPMENT') return undefined

  const category = resolution.catalog.equipment.find(
    (equipment) => equipment.id === proficiency.subjectId
  )?.category
  switch (category) {
    case 'ARMOR':
    case 'SHIELD':
      return 'ARMOR'
    case 'TOOL':
      return 'TOOL'
    case 'WEAPON':
      return 'WEAPON'
    default:
      return undefined
  }
}

function getProficiencyLabel(
  targetId: string,
  kind: 'ARMOR' | 'LANGUAGE' | 'TOOL' | 'WEAPON',
  resolution: CharacterBuilderResolution
): string {
  if (kind === 'LANGUAGE') {
    return (
      resolution.registry.system?.languages.find((language) => language.id === targetId)?.label ??
      'Unknown language'
    )
  }
  return (
    resolution.catalog.equipment.find((equipment) => equipment.id === targetId)?.label ??
    'Unknown equipment'
  )
}

function buildAbilityPanel(
  params: BuildCharacterSheetPanelParams,
  engine: EngineCharacterOutput,
  target: Extract<CharacterSheetPanelTargetDto, { kind: 'ABILITY' }>
): CharacterSheetPanelDto {
  const ability = ABILITIES[target.ability]
  const matching = params.adjustments.filter(
    (adjustment) => adjustment.family === 'ABILITY' && adjustment.ability === target.ability
  )
  const otherModifier = findAdjustment(
    matching,
    'ABILITY',
    (adjustment) =>
      adjustment.ability === target.ability && adjustment.field === 'OTHER_MODIFIER'
  )
  const scoreOverride = findAdjustment(
    matching,
    'ABILITY',
    (adjustment) =>
      adjustment.ability === target.ability && adjustment.field === 'SCORE_OVERRIDE'
  )
  const calculation = toPanelCalculation(engine.calculations.abilityScores[target.ability], params)

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
    modifier: engine.derivedStats.abilityModifiers[target.ability] ?? 0,
    scoreCalculation: calculation,
    editors: [
      {
        kind: 'NUMBER',
        field: 'OTHER_MODIFIER',
        label: 'Other modifier',
        value:
          otherModifier?.field === 'OTHER_MODIFIER' ? otherModifier.value : null,
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
  engine: EngineCharacterOutput,
  target: Extract<CharacterSheetPanelTargetDto, { kind: 'SAVING_THROW' }>
): CharacterSheetPanelDto {
  const ability = ABILITIES[target.ability]
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
    total: engine.derivedStats.savingThrows[target.ability] ?? 0,
    proficiency:
      engine.calculations.savingThrowProficiencyLevels[target.ability]?.effective ?? 'NONE',
    calculation: toPanelCalculation(engine.calculations.savingThrows[target.ability], params),
    numericEditors: [
      ['MAGIC_BONUS', 'Magic bonus'],
      ['MISC_BONUS', 'Miscellaneous bonus'],
      ['TOTAL_OVERRIDE', 'Override total']
    ].map(([field, label]) => {
      const adjustment = getNumeric(
        field as 'MAGIC_BONUS' | 'MISC_BONUS' | 'TOTAL_OVERRIDE'
      )
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
      value:
        proficiency?.field === 'PROFICIENCY_OVERRIDE' ? proficiency.value : null,
      options: PROFICIENCY_OPTIONS,
      commitIntent: 'IMMEDIATE',
      ...adjustmentEditorMetadata(proficiency)
    }
  }
}

function buildSkillPanel(
  params: BuildCharacterSheetPanelParams,
  engine: EngineCharacterOutput,
  target: Extract<CharacterSheetPanelTargetDto, { kind: 'SKILL' }>
): CharacterSheetPanelDto {
  const row = params.sheet.overview.skills.find((skill) => skill.skillId === target.skillId)
  if (!row) throw new Error(`Skill "${target.skillId}" is not available on this character sheet.`)
  const engineKey = findEngineSkillKey(params.resolution, target.skillId)
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
      adjustment.skillId === target.skillId &&
      adjustment.field === 'GOVERNING_ABILITY_OVERRIDE'
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
    calculation: toPanelCalculation(engine.calculations.skillBonuses[engineKey], params),
    numericEditors: [
      ['MAGIC_BONUS', 'Magic bonus'],
      ['MISC_BONUS', 'Miscellaneous bonus'],
      ['TOTAL_OVERRIDE', 'Override total']
    ].map(([field, label]) => {
      const adjustment = getNumeric(
        field as 'MAGIC_BONUS' | 'MISC_BONUS' | 'TOTAL_OVERRIDE'
      )
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
      value:
        proficiency?.field === 'PROFICIENCY_OVERRIDE' ? proficiency.value : null,
      options: PROFICIENCY_OPTIONS,
      commitIntent: 'IMMEDIATE',
      ...adjustmentEditorMetadata(proficiency)
    },
    abilityEditor: {
      kind: 'SELECT',
      field: 'GOVERNING_ABILITY_OVERRIDE',
      label: 'Governing ability',
      value:
        governingAbility?.field === 'GOVERNING_ABILITY_OVERRIDE'
          ? governingAbility.value
          : null,
      options: ABILITY_OPTIONS,
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
  engine: EngineCharacterOutput,
  target: Extract<CharacterSheetPanelTargetDto, { kind: 'SENSES' }>
): CharacterSheetPanelDto {
  const passiveChecks = (params.resolution.registry.system?.passives ?? []).flatMap((passive) => {
    const skill = findPassiveSkill(params.sheet, passive)
    if (!skill) return []
    const engineKey = findEngineSkillKey(params.resolution, skill.skillId)
    const adjustment = findAdjustment(
      params.adjustments,
      'PASSIVE',
      (candidate) => candidate.skillId === skill.skillId
    )
    return [
      {
        skillId: skill.skillId,
        label: passive.label,
        total: engine.derivedStats.passiveChecks[engineKey] ?? 10 + skill.total,
        state: adjustment ? ('OVERRIDDEN' as const) : ('DEFAULT' as const),
        calculation: toPanelCalculation(engine.calculations.passiveChecks[engineKey], params),
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
    const engineSense = engine.senses.find(
      (candidate) => candidate.senseCode === sense.id || candidate.senseCode === sense.code
    )
    const calculation =
      engine.calculations.senseRanges[sense.id] ??
      engine.calculations.senseRanges[sense.code]
    const range =
      calculation?.effective ??
      (engineSense?.range?.rangeKind === 'DISTANCE' ? engineSense.range.amount : 0)
    const unit =
      engineSense?.range?.rangeKind === 'DISTANCE' ? engineSense.range.unit : 'FEET'
    return {
      senseId: sense.id,
      label: sense.label,
      range,
      unitLabel: formatCode(unit).toLowerCase(),
      state: adjustment ? ('OVERRIDDEN' as const) : ('DEFAULT' as const),
      calculation: toPanelCalculation(calculation, params),
      editor: {
        kind: 'NUMBER' as const,
        field: 'RANGE_OVERRIDE' as const,
        label: `Override ${sense.label} range`,
        value: adjustment?.value ?? null,
        commitIntent: 'ON_BLUR_OR_ENTER' as const,
        validation: { integer: true, minimum: 0 },
        ...adjustmentEditorMetadata(adjustment)
      }
    }
  })

  return {
    kind: 'SENSES',
    panelId: 'senses',
    characterId: params.character.id,
    target,
    title: 'Senses',
    state: resolvePanelState(params.adjustments, target),
    editable: params.editable,
    allowedCommands: [...CORE_PANEL_COMMANDS],
    passiveChecks,
    senses
  }
}

function buildMovementPanel(
  params: BuildCharacterSheetPanelParams,
  engine: EngineCharacterOutput,
  target: Extract<CharacterSheetPanelTargetDto, { kind: 'MOVEMENT' }>
): CharacterSheetPanelDto {
  const speeds = (params.resolution.registry.system?.speeds ?? []).map((speed) => {
    const adjustment = findAdjustment(
      params.adjustments,
      'MOVEMENT',
      (candidate) => candidate.speedId === speed.id
    )
    const engineSpeed = engine.derivedStats.movementSpeeds.find(
      (candidate) => candidate.speedId === speed.id || candidate.speedId === speed.code
    )
    const calculation =
      engine.calculations.movementSpeeds[speed.id] ??
      engine.calculations.movementSpeeds[speed.code]
    return {
      speedId: speed.id,
      label: speed.label,
      amount: calculation?.effective ?? engineSpeed?.amount ?? 0,
      unitLabel: formatCode(engineSpeed?.unit ?? 'FEET').toLowerCase(),
      state: adjustment ? ('OVERRIDDEN' as const) : ('DEFAULT' as const),
      calculation: toPanelCalculation(calculation, params),
      editor: {
        kind: 'NUMBER' as const,
        field: 'SPEED_OVERRIDE' as const,
        label: `Override ${speed.label} speed`,
        value: adjustment?.value ?? null,
        commitIntent: 'ON_BLUR_OR_ENTER' as const,
        validation: { integer: true, minimum: 0 },
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
    ...(engine.derivedStats.primaryMovementSpeedId
      ? { primarySpeedId: engine.derivedStats.primaryMovementSpeedId }
      : {}),
    preference: params.movementDisplayPreference,
    preferenceOptions: [
      { value: 'AUTO', label: 'Automatic' },
      ...speeds
        .filter((speed) => speed.amount > 0)
        .map((speed) => ({ value: speed.speedId, label: speed.label }))
    ],
    speeds
  }
}

function buildDefensePanel(
  params: BuildCharacterSheetPanelParams,
  engine: EngineCharacterOutput,
  target: Extract<CharacterSheetPanelTargetDto, { kind: 'DEFENSES' }>
): CharacterSheetPanelDto {
  const damageTypes = params.resolution.registry.system?.damageTypes ?? []
  const defenses = engine.defenses.map((defense) => {
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
      ...(defense.source?.kind === 'MANUAL_ADJUSTMENT'
        ? { adjustmentId: defense.source.adjustmentId }
        : {})
    }
  })
  const existing = new Set(
    defenses.map((defense) => `${defense.kind}:${defense.damageTypeId}`)
  )
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
  engine: EngineCharacterOutput,
  target: Extract<CharacterSheetPanelTargetDto, { kind: 'PROFICIENCIES' }>
): CharacterSheetPanelDto {
  const proficiencies = engine.proficiencies.flatMap((proficiency) => {
    const kind = getProficiencyTargetKind(proficiency, params.resolution)
    if (!kind || proficiency.subjectId === '*') return []
    const source = proficiency.source
      ? findSourceLabel({ ...params, source: proficiency.source })
      : { label: 'Character build' }
    return [
      {
        kind,
        targetId: proficiency.subjectId,
        label: getProficiencyLabel(proficiency.subjectId, kind, params.resolution),
        sourceLabel: source.label,
        ...(proficiency.source?.kind === 'MANUAL_ADJUSTMENT'
          ? { adjustmentId: proficiency.source.adjustmentId }
          : {})
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
  const languageOptions = (params.resolution.registry.system?.languages ?? []).flatMap(
    (language) =>
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

export interface BuildCharacterSheetPanelParams {
  character: CharacterAuthored
  resolution: CharacterBuilderResolution
  sheet: CharacterSheetResponseDto
  adjustments: readonly CharacterSheetAdjustment[]
  movementDisplayPreference: CharacterMovementDisplayPreference
  target: CharacterSheetPanelTargetDto
  editable: boolean
}

export function buildCharacterSheetPanel(
  params: BuildCharacterSheetPanelParams
): CharacterSheetPanelDto {
  const engine = resolveCharacterSheetEngine({
    character: params.character,
    resolution: params.resolution,
    adjustments: params.adjustments,
    movementDisplayPreference: params.movementDisplayPreference
  })
  let panel: CharacterSheetPanelDto
  switch (params.target.kind) {
    case 'ABILITY':
      panel = buildAbilityPanel(params, engine, params.target)
      break
    case 'SAVING_THROW':
      panel = buildSavingThrowPanel(params, engine, params.target)
      break
    case 'SKILL':
      panel = buildSkillPanel(params, engine, params.target)
      break
    case 'SKILLS':
      panel = buildSkillsPanel(params, params.target)
      break
    case 'SENSES':
      panel = buildSensesPanel(params, engine, params.target)
      break
    case 'MOVEMENT':
      panel = buildMovementPanel(params, engine, params.target)
      break
    case 'DEFENSES':
      panel = buildDefensePanel(params, engine, params.target)
      break
    case 'PROFICIENCIES':
      panel = buildProficiencyPanel(params, engine, params.target)
      break
  }
  return characterSheetPanelDtoSchema.parse(panel)
}

export function getAffectedCharacterSheetPanelTargets(
  command:
    | {
        type: 'UPSERT_SHEET_ADJUSTMENT'
        adjustment: {
          family: 'ABILITY' | 'SAVING_THROW' | 'SKILL' | 'PASSIVE' | 'SENSE' | 'MOVEMENT' | 'DEFENSE' | 'PROFICIENCY'
          ability?: AbilityCode
          skillId?: string
        }
      }
    | {
        type: 'REMOVE_SHEET_ADJUSTMENT'
        family: 'ABILITY' | 'SAVING_THROW' | 'SKILL' | 'PASSIVE' | 'SENSE' | 'MOVEMENT' | 'DEFENSE' | 'PROFICIENCY'
        target: CharacterSheetPanelTargetDto
      }
    | { type: 'RESET_SHEET_PANEL_ADJUSTMENTS'; target: CharacterSheetPanelTargetDto }
    | { type: 'SET_MOVEMENT_DISPLAY_PREFERENCE' }
): CharacterSheetPanelTargetDto[] {
  if (command.type === 'RESET_SHEET_PANEL_ADJUSTMENTS') return [command.target]
  if (command.type === 'SET_MOVEMENT_DISPLAY_PREFERENCE') return [{ kind: 'MOVEMENT' }]
  if (command.type === 'REMOVE_SHEET_ADJUSTMENT') return [command.target]

  switch (command.adjustment.family) {
    case 'ABILITY':
      return [{ kind: 'ABILITY', ability: command.adjustment.ability! }]
    case 'SAVING_THROW':
      return [{ kind: 'SAVING_THROW', ability: command.adjustment.ability! }]
    case 'SKILL':
      return [{ kind: 'SKILL', skillId: command.adjustment.skillId! }]
    case 'PASSIVE':
    case 'SENSE':
      return [{ kind: 'SENSES' }]
    case 'MOVEMENT':
      return [{ kind: 'MOVEMENT' }]
    case 'DEFENSE':
      return [{ kind: 'DEFENSES' }]
    case 'PROFICIENCY':
      return [{ kind: 'PROFICIENCIES' }]
  }
}
