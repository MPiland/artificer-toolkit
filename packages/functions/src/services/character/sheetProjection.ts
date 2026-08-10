import {
  createCreatureRepository,
  createVehicleRepository,
  getCharacterSheetExtraCatalogQuery,
  getCharacterSheetMechanicsQuery,
  type CharacterSpellCustomization,
  type DBLike
} from '@artificer-toolkit/db'
import {
  ABILITIES,
  AUTHORED_RECORD_STATUS,
  CHARACTER_EXTRA_KIND_OPTIONS,
  CHARACTER_EXTRA_KIND_REGISTRY,
  CLASS_CATEGORY,
  CREATURE_ORIGIN_KIND_OPTIONS,
  CREATURE_ORIGIN_KIND_REGISTRY,
  CREATURE_RELATIONSHIP_KIND_REGISTRY,
  EQUIPMENT_PROPERTY_REGISTRY,
  FEATURE_ATTRIBUTE,
  MEASUREMENT_UNIT_REGISTRY,
  PREPARE_LIMIT_METHOD_KIND,
  ROUNDING_CODE,
  SCALING_AMOUNT_KIND,
  SIZE_OPTIONS,
  SPELLCASTING_ATTRIBUTE,
  VEHICLE_CATEGORY_REGISTRY,
  resolveRulesSystem,
  type CharacterBuildSnapshot,
  type CharacterMechanicSourceRef,
  type EngineCharacterOutput,
  type EngineProficiency,
  type EngineResource,
  type EngineSense,
  type EngineSpellSlots,
  type MeasurementUnitCode
} from '@artificer-toolkit/shared/core'
import {
  createCharacterDefinitionSourceInstanceId,
  createCharacterResourceOwnerKey,
  createCharacterSpellSourceKey,
  clampCharacterCurrentHitPoints,
  resolveCharacterEffectiveMaximumHitPoints,
  toCharacterResourceOwnerKey,
  type CharacterMovementDisplayPreference,
  type CharacterResourceOwnerRef,
  type CharacterResourceUsage,
  type CharacterSheetAdjustment
} from '@artificer-toolkit/shared/character'
import { compileCharge, resolveCompiledChargeMaximum } from '@artificer-toolkit/shared/compilers'
import { SKILL_ABILITY_MAP } from '@artificer-toolkit/shared/engine/resolution'
import type {
  CharacterAuthored,
  CharacterProvenance,
  CreatureAuthored,
  VehicleAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import { getCharacterProvenanceIdentityKey } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characters'
import { type CharacterBuilderResolution } from './builderService.js'

import {
  getAbilityDerivedTotal,
  isAbilityCode,
  resolveAbilityCode,
  resolveCharacterSheetEngine,
  ENGINE_ABILITY_ALIASES,
  classSpellSelectionKey,
  createSkillReference,
  getClassSpellSelectionSources,
  toSkillFallbackCode,
  toSkillFallbackLabel
} from './characterEngine.js'
import {
  abilityModifier,
  clamp,
  findResourceByOwner,
  formatCodeLabel,
  formatModifier,
  getHitPointAdjustment,
  getNoteGroups,
  getSpellSlotKey,
  parseSlotLevel,
  type SheetResource,
  type SheetSpell,
  type SheetSpellSlot,
  type SheetSpellSource
} from './sheetCommandReducer.js'
import {
  projectCharacterSheetMechanics,
  type CharacterSheetProjectedMechanic
} from './sheetMechanicsProjector.js'

import { getProficiencyTargetKind } from './sheetProficiency.js'
import { getConditionOptions } from './sheetCommandValidation.js'

function createVocabularyLabelMap(
  records: ReadonlyArray<{ id: string; code?: string; label: string }> | undefined
): Map<string, string> {
  const labels = new Map<string, string>()
  for (const record of records ?? []) {
    labels.set(record.id, record.label)
    if (record.code) labels.set(record.code, record.label)
  }
  return labels
}

function formatProficiencyScaling(scaling: EngineProficiency['scaling']): string {
  switch (scaling) {
    case 'DOUBLE':
      return 'Expertise'
    case 'HALF':
      return 'Half proficiency'
    case 'FULL':
      return 'Proficient'
  }
}

function formatProficiencyKind(kind: string): string {
  switch (kind) {
    case 'EQUIPMENT':
      return 'Equipment'
    case 'EQUIPMENT_PROPERTY':
      return 'Equipment property'
    case 'LANGUAGE':
      return 'Language'
    case 'SAVE_ABILITY':
      return 'Saving throw'
    case 'SKILL':
      return 'Skill'
    default:
      return formatCodeLabel(kind)
  }
}

function formatAllProficiencyLabel(kind: string): string {
  switch (kind) {
    case 'EQUIPMENT':
      return 'All equipment'
    case 'EQUIPMENT_PROPERTY':
      return 'All equipment properties'
    case 'LANGUAGE':
      return 'All languages'
    case 'SAVE_ABILITY':
      return 'All saving throws'
    case 'SKILL':
      return 'All skills'
    default:
      return `All ${formatCodeLabel(kind).toLowerCase()}`
  }
}

function formatProficiencyLabel(params: {
  equipmentLabels: ReadonlyMap<string, string>
  languageLabels: ReadonlyMap<string, string>
  proficiency: EngineProficiency
  skillLabels: ReadonlyMap<string, string>
}): string {
  const { proficiency } = params
  if (proficiency.subjectId === '*') return formatAllProficiencyLabel(proficiency.kind)

  switch (proficiency.kind) {
    case 'EQUIPMENT':
      return params.equipmentLabels.get(proficiency.subjectId) ?? 'Unknown equipment'
    case 'EQUIPMENT_PROPERTY': {
      const propertyLabel = formatCodeLabel(proficiency.subjectId)
      if (proficiency.category === 'ARMOR') return `${propertyLabel} Armor`
      if (proficiency.category === 'WEAPON') return `${propertyLabel} Weapons`
      return propertyLabel
    }
    case 'LANGUAGE':
      return params.languageLabels.get(proficiency.subjectId) ?? 'Unknown language'
    case 'SAVE_ABILITY':
      return isAbilityCode(proficiency.subjectId)
        ? `${ABILITIES[proficiency.subjectId].label} saves`
        : 'Unknown saving throw'
    case 'SKILL':
      return params.skillLabels.get(proficiency.subjectId) ?? 'Unknown skill'
    default:
      return formatCodeLabel(proficiency.subjectId)
  }
}

function formatSenseRange(sense: EngineSense): string {
  if (sense.range?.rangeKind !== 'DISTANCE') return 'Available'
  return `${sense.range.amount} ${formatCodeLabel(sense.range.unit).toLowerCase()}`
}

type OverviewSkillRow = CharacterSheetResponseDto['overview']['skills'][number]

type CharacterBuilderGrantFeature = CharacterBuilderResolution['grants']['features'][number]

const STANDARD_PASSIVE_SKILLS = [
  { code: 'PASSIVE_PERCEPTION', label: 'Passive Perception', skillCode: 'PERCEPTION' },
  { code: 'PASSIVE_INVESTIGATION', label: 'Passive Investigation', skillCode: 'INVESTIGATION' },
  { code: 'PASSIVE_INSIGHT', label: 'Passive Insight', skillCode: 'INSIGHT' }
] as const

function resolvePassiveSkillCode(passive: { code?: string; label: string }): string | undefined {
  const value = `${passive.code ?? ''} ${passive.label}`.toUpperCase()
  if (value.includes('PERCEPTION')) return 'PERCEPTION'
  if (value.includes('INVESTIGATION')) return 'INVESTIGATION'
  if (value.includes('INSIGHT')) return 'INSIGHT'
  return undefined
}

function buildPassiveOverviewFacts(params: {
  passives?: ReadonlyArray<{ code?: string; label: string }>
  passiveChecks: Readonly<Record<string, number>>
}): Array<{ label: string; value: string }> {
  const passiveDefinitions = params.passives?.length ? params.passives : STANDARD_PASSIVE_SKILLS
  const seenSkillCodes = new Set<string>()

  return passiveDefinitions.flatMap((passive) => {
    const skillCode = resolvePassiveSkillCode(passive)
    if (!skillCode || seenSkillCodes.has(skillCode)) return []
    const total = params.passiveChecks[skillCode.toLowerCase()]
    if (total === undefined) return []

    seenSkillCodes.add(skillCode)
    return [{ label: passive.label, value: String(total) }]
  })
}

function hasFeatureAttribute(feature: CharacterBuilderGrantFeature, attribute: string): boolean {
  return feature.attributes?.includes(attribute) === true
}

function isSheetVisibleFeature(feature: CharacterBuilderGrantFeature): boolean {
  return !hasFeatureAttribute(feature, FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET)
}

function getSelectedFeatureOptionIds(character: CharacterAuthored): Set<string> {
  return new Set(
    character.intent.featureAcquisitions.flatMap((acquisition) =>
      (acquisition.selections ?? [])
        .filter((selection) => selection.selectionKey === 'options')
        .flatMap((selection) =>
          selection.values.flatMap((value) => {
            if (value.kind === 'ID') return [value.id]
            if (value.kind === 'IDS') return value.ids
            return []
          })
        )
    )
  )
}

function toSheetActionKind(
  mechanic: CharacterSheetProjectedMechanic
): CharacterSheetResponseDto['actions']['items'][number]['kind'] {
  switch (mechanic.activation?.kind) {
    case 'ACTION':
      return 'ACTION'
    case 'BONUS_ACTION':
      return 'BONUS_ACTION'
    case 'REACTION':
      return 'REACTION'
    default:
      return 'OTHER'
  }
}

function isRollableSheetMechanic(mechanic: CharacterSheetProjectedMechanic): boolean {
  return (
    mechanic.attackBonus !== undefined ||
    mechanic.outcomes.some(
      (outcome) => 'expression' in outcome && /\b\d+d\d+\b/i.test(outcome.expression)
    )
  )
}

function formatClassSummary(resolution: CharacterBuilderResolution): string {
  const summary = resolution.summary.classes
    .map((classSummary) => {
      const subclass = classSummary.subclassLabel ? ` (${classSummary.subclassLabel})` : ''
      return `${classSummary.classLabel}${subclass} ${classSummary.classLevel}`
    })
    .join(' / ')

  return summary || 'No class selected'
}

function formatSlotLabel(slotKey: string, level: number | null): string {
  if (slotKey === 'PACT') return 'Pact Magic'
  return level == null ? slotKey : `Level ${level}`
}

function getSpellSlotMaximums(slotMaximums: EngineSpellSlots) {
  const standardSlots = Object.entries(slotMaximums.maxByLevel).map(([level, max]) => {
    const slotLevel = Number(level)
    return {
      slotKey: getSpellSlotKey(slotLevel),
      label: formatSlotLabel(getSpellSlotKey(slotLevel), slotLevel),
      level: slotLevel,
      max
    }
  })
  const pactSlots =
    slotMaximums.pactMagic && slotMaximums.pactMagic.slots > 0
      ? [
          {
            slotKey: 'PACT',
            label: formatSlotLabel('PACT', slotMaximums.pactMagic.level),
            level: slotMaximums.pactMagic.level,
            max: slotMaximums.pactMagic.slots
          }
        ]
      : []

  return [...standardSlots, ...pactSlots]
    .filter((slot) => slot.max > 0)
    .sort((left, right) => (left.level ?? 0) - (right.level ?? 0))
}

function getPreparedAndKnownSpellIds(character: CharacterAuthored): {
  learned: Set<string>
  prepared: Set<string>
} {
  const learned = new Set<string>()
  const prepared = new Set<string>()

  for (const classState of character.state.classes ?? []) {
    const classIntent = character.intent.classes.find((row) => row.classId === classState.classId)
    const knownSpellIds = classIntent
      ? getKnownSpellIdsForClassIntent(character, classIntent.classId)
      : new Set(classState.spells?.learned ?? [])
    for (const spellId of knownSpellIds) learned.add(spellId)
    for (const spellId of classState.spells?.prepared ?? []) prepared.add(spellId)
  }

  for (const selection of character.intent.spellSelections ?? []) {
    const source = selection.source
    if (source.kind === 'CLASS' || source.kind === 'SUBCLASS') {
      const classId =
        source.kind === 'CLASS'
          ? source.classId
          : character.intent.classes.find(
              (classIntent) => classIntent.subclassId === source.subclassId
            )?.classId
      if (
        classId &&
        character.state.classes?.some(
          (classState) => classState.classId === classId && classState.spells?.learned !== undefined
        )
      ) {
        continue
      }
    }
    for (const spellId of selection.spells) learned.add(spellId)
  }

  return { learned, prepared }
}

function getClassSpellSelectionIdsForClass(
  character: CharacterAuthored,
  classId: string
): Set<string> {
  const classIntent = character.intent.classes.find((entry) => entry.classId === classId)
  if (!classIntent) return new Set<string>()

  const spellIds = new Set<string>()
  for (const selection of character.intent.spellSelections ?? []) {
    if (selection.source.kind === 'CLASS' && selection.source.classId === classId) {
      for (const spellId of selection.spells) spellIds.add(spellId)
    }
    if (
      selection.source.kind === 'SUBCLASS' &&
      selection.source.subclassId === classIntent.subclassId
    ) {
      for (const spellId of selection.spells) spellIds.add(spellId)
    }
  }
  return spellIds
}

function getKnownSpellIdsForClassIntent(
  character: CharacterAuthored,
  classId: string
): Set<string> {
  const classState = character.state.classes?.find((row) => row.classId === classId)
  if (classState?.spells?.learned !== undefined) {
    return new Set(classState.spells.learned)
  }
  return getClassSpellSelectionIdsForClass(character, classId)
}

type CharacterSheetSpellSource = {
  id?: string
  classId?: string
  label: string
  source: {
    spellId: string
    sourceKind:
      | 'BACKGROUND'
      | 'CLASS'
      | 'FEAT'
      | 'FEATURE'
      | 'ITEM'
      | 'OPTION'
      | 'RACE'
      | 'SUBCLASS'
    sourceInstanceId: string
  }
  canPrepare: boolean
  prepared: boolean
  provenance?:
    | 'CLASS'
    | 'SUBCLASS'
    | 'RACE'
    | 'BACKGROUND'
    | 'FEAT'
    | 'FEATURE'
    | 'OPTION'
    | 'EQUIPMENT'
  acquisition?: 'KNOWN' | 'PREPARED' | 'ALWAYS_PREPARED' | 'GRANTED'
  castMode?: 'SPELL_SLOT' | 'AT_WILL' | 'RITUAL' | 'FIXED_LEVEL' | 'LIMITED_USE'
  fixedLevel?: number
  resourceGrantId?: string
  resourceOwner?: CharacterResourceOwnerRef
}

function getSpellClassIdsById(
  resolution: CharacterBuilderResolution
): Map<string, ReadonlySet<string>> {
  return new Map(resolution.catalog.spells.map((spell) => [spell.id, new Set(spell.classIds)]))
}

function getSubclassAliasLabels(
  classIntent: CharacterAuthored['intent']['classes'][number],
  resolution: CharacterBuilderResolution
): Set<string> {
  if (!classIntent.subclassId) return new Set<string>()

  const labels = new Set<string>()
  const classSummary = resolution.summary.classes.find(
    (summary) =>
      summary.classId === classIntent.classId && summary.subclassId === classIntent.subclassId
  )
  if (classSummary?.subclassLabel) labels.add(classSummary.subclassLabel)

  const subclassGrantSources = [
    ...resolution.grants.features,
    ...resolution.grants.resources,
    ...resolution.grants.spellcasting
  ].filter(
    (grant) =>
      grant.source.kind === 'SUBCLASS' && grant.source.subclassId === classIntent.subclassId
  )

  for (const grant of subclassGrantSources) {
    labels.add(grant.sourceLabel)
  }

  return labels
}

function getSpellClassIdsForClassIntent(
  classIntent: CharacterAuthored['intent']['classes'][number],
  resolution: CharacterBuilderResolution
): Set<string> {
  const classIds = new Set<string>([classIntent.classId])
  if (!classIntent.subclassId) return classIds

  classIds.add(classIntent.subclassId)
  const subclassAliasLabels = getSubclassAliasLabels(classIntent, resolution)
  for (const classRecord of resolution.registry.classes) {
    if (
      classRecord.category !== CLASS_CATEGORY.SUBCLASS ||
      classRecord.parentClassId !== classIntent.classId
    )
      continue
    if (
      classRecord.id === classIntent.subclassId ||
      classRecord.specializations?.some(
        (specialization) => specialization.id === classIntent.subclassId
      ) ||
      subclassAliasLabels.has(classRecord.label)
    ) {
      classIds.add(classRecord.id)
    }
  }

  return classIds
}

function getSpellClassIdsByActiveClassId(
  character: CharacterAuthored,
  resolution: CharacterBuilderResolution
): Map<string, ReadonlySet<string>> {
  return new Map(
    character.intent.classes.map((classIntent) => [
      classIntent.classId,
      getSpellClassIdsForClassIntent(classIntent, resolution)
    ])
  )
}

function isSpellAvailableForClass(
  spellClassIdsById: ReadonlyMap<string, ReadonlySet<string>>,
  spellId: string,
  classIds: ReadonlySet<string>
): boolean {
  const spellClassIds = spellClassIdsById.get(spellId)
  if (!spellClassIds) return false
  return [...classIds].some((classId) => spellClassIds.has(classId))
}

function isSpellcastingPreparationCapable(
  classRecord: CharacterBuilderResolution['registry']['classes'][number] | undefined
): boolean {
  const spellcasting = classRecord?.spellcasting
  if (!spellcasting) return false
  return Boolean(
    spellcasting.attributes?.includes(SPELLCASTING_ATTRIBUTE.PREPARES_SPELLS) ||
    spellcasting.prepareLimit ||
    spellcasting.spellLimits.some((limit) => (limit.preparedSpellsLimit ?? 0) > 0)
  )
}

type SheetClassRecord = CharacterBuilderResolution['registry']['classes'][number]

type SheetSpellcasting = NonNullable<SheetClassRecord['spellcasting']>

type SheetPrepareLimit = NonNullable<SheetSpellcasting['prepareLimit']>

function getActiveSpellLimit(
  spellcasting: SheetSpellcasting,
  classLevel: number
): SheetSpellcasting['spellLimits'][number] | undefined {
  return spellcasting.spellLimits
    .filter((limit) => limit.classLevel <= classLevel)
    .sort((left, right) => right.classLevel - left.classLevel)[0]
}

function roundPrepareLimitValue(
  value: number,
  rounding: SheetPrepareLimit['rounding'] = ROUNDING_CODE.DOWN
): number {
  switch (rounding) {
    case ROUNDING_CODE.UP:
      return Math.ceil(value)
    case ROUNDING_CODE.NEAREST:
      return Math.round(value)
    case ROUNDING_CODE.DOWN:
    default:
      return Math.floor(value)
  }
}

function scalePrepareLimitValue(
  value: number,
  scaling: SheetPrepareLimit['scaling'],
  rounding: SheetPrepareLimit['rounding']
): number {
  switch (scaling) {
    case SCALING_AMOUNT_KIND.HALF:
      return roundPrepareLimitValue(value / 2, rounding)
    case SCALING_AMOUNT_KIND.DOUBLE:
      return value * 2
    case SCALING_AMOUNT_KIND.FULL:
    case undefined:
    default:
      return value
  }
}

function getActivePrepareLimitTableAmount(
  prepareLimit: SheetPrepareLimit,
  classLevel: number
): number {
  return (
    prepareLimit.perLevel
      ?.filter((limit) => limit.classLevel <= classLevel)
      .sort((left, right) => right.classLevel - left.classLevel)[0]?.amount ?? 0
  )
}

function resolveSpellcastingPreparedSpellLimit(
  spellcasting: SheetSpellcasting,
  classLevel: number,
  resolution: CharacterBuilderResolution
): number | undefined {
  const activeLimit = getActiveSpellLimit(spellcasting, classLevel)
  if (activeLimit?.preparedSpellsLimit !== undefined) return activeLimit.preparedSpellsLimit

  const prepareLimit = spellcasting.prepareLimit
  if (!prepareLimit) return undefined

  let amount = 0
  for (const methodKind of prepareLimit.methodKinds) {
    switch (methodKind) {
      case PREPARE_LIMIT_METHOD_KIND.SPELLCASTING_ABILITY: {
        const abilityScore = spellcasting.ability
          ? resolution.summary.abilities[spellcasting.ability]
          : undefined
        amount += abilityScore === undefined ? 0 : abilityModifier(abilityScore)
        break
      }
      case PREPARE_LIMIT_METHOD_KIND.CLASS_LEVEL:
        amount += scalePrepareLimitValue(classLevel, prepareLimit.scaling, prepareLimit.rounding)
        break
      case PREPARE_LIMIT_METHOD_KIND.PER_LEVEL:
        amount += getActivePrepareLimitTableAmount(prepareLimit, classLevel)
        break
    }
  }

  return Math.max(1, amount)
}

function getPreparedSpellLimitForClassIntent(
  classIntent: CharacterAuthored['intent']['classes'][number],
  resolution: CharacterBuilderResolution
): number | undefined {
  const classById = new Map(
    resolution.registry.classes.map((classRecord) => [classRecord.id, classRecord])
  )
  const limits = [...getSpellClassIdsForClassIntent(classIntent, resolution)]
    .map((classId) => {
      const spellcasting = classById.get(classId)?.spellcasting
      return spellcasting
        ? resolveSpellcastingPreparedSpellLimit(spellcasting, classIntent.classLevel, resolution)
        : undefined
    })
    .filter((limit): limit is number => limit !== undefined)

  return limits.length ? Math.max(...limits) : undefined
}

function getPreparationCapableClassIds(
  character: CharacterAuthored,
  resolution: CharacterBuilderResolution
): Set<string> {
  const classById = new Map(
    resolution.registry.classes.map((classRecord) => [classRecord.id, classRecord])
  )
  const classIds = new Set<string>()

  for (const classIntent of character.intent.classes) {
    const spellClassIds = getSpellClassIdsForClassIntent(classIntent, resolution)
    if (
      [...spellClassIds].some((classId) => isSpellcastingPreparationCapable(classById.get(classId)))
    ) {
      classIds.add(classIntent.classId)
    }
  }

  return classIds
}

function getSheetSpellIdsByClass(
  character: CharacterAuthored,
  resolution: CharacterBuilderResolution,
  preparationCapableClassIds: ReadonlySet<string>
): Map<string, Set<string>> {
  const spellClassIdsByActiveClassId = getSpellClassIdsByActiveClassId(character, resolution)
  const spellClassIdsById = getSpellClassIdsById(resolution)
  const classById = new Map(
    resolution.registry.classes.map((classRecord) => [classRecord.id, classRecord])
  )
  const spellIdsByClassId = new Map<string, Set<string>>()

  function addSpell(classId: string, spellId: string) {
    const spellClassIds = spellClassIdsByActiveClassId.get(classId)
    if (!spellClassIds || !isSpellAvailableForClass(spellClassIdsById, spellId, spellClassIds))
      return
    const spellIds = spellIdsByClassId.get(classId) ?? new Set<string>()
    spellIds.add(spellId)
    spellIdsByClassId.set(classId, spellIds)
  }

  for (const classIntent of character.intent.classes) {
    const classSpellIds = new Set([
      ...getKnownSpellIdsForClassIntent(character, classIntent.classId),
      ...getClassSpellSelectionIdsForClass(character, classIntent.classId)
    ])
    for (const spellId of classSpellIds) addSpell(classIntent.classId, spellId)
    const classState = character.state.classes?.find((row) => row.classId === classIntent.classId)
    for (const spellId of classState?.spells?.prepared ?? []) {
      addSpell(classIntent.classId, spellId)
    }

    if (!preparationCapableClassIds.has(classIntent.classId)) continue
    const preparationClassIds = [...getSpellClassIdsForClassIntent(classIntent, resolution)].filter(
      (classId) => isSpellcastingPreparationCapable(classById.get(classId))
    )
    const maxPreparableSpellLevel = Math.max(
      0,
      ...preparationClassIds.flatMap((classId) => {
        const spellcasting = classById.get(classId)?.spellcasting
        const activeLimit = spellcasting
          ? getActiveSpellLimit(spellcasting, classIntent.classLevel)
          : undefined
        return activeLimit?.slots.map((slot) => slot.spellLevel) ?? []
      })
    )
    if (maxPreparableSpellLevel === 0) continue

    const preparationClassIdSet = new Set(preparationClassIds)
    for (const spell of resolution.catalog.spells) {
      if (spell.level <= 0 || spell.level > maxPreparableSpellLevel) continue
      if (!spell.classIds.some((classId) => preparationClassIdSet.has(classId))) continue
      addSpell(classIntent.classId, spell.id)
    }
  }

  return spellIdsByClassId
}

function getSpellSourcesBySpellId(
  character: CharacterAuthored,
  classLabels: ReadonlyMap<string, string>,
  sheetSpellIdsByClassId: ReadonlyMap<string, ReadonlySet<string>>,
  preparationCapableClassIds: ReadonlySet<string>,
  spellAccess: readonly EngineCharacterOutput['spellAccess'][number][],
  featureLabels: ReadonlyMap<string, string>
): Map<string, CharacterSheetSpellSource[]> {
  const classStateById = new Map(
    (character.state.classes ?? []).map((classState) => [classState.classId, classState])
  )
  const knownSpellIdsByClassId = new Map(
    character.intent.classes.map((classIntent) => [
      classIntent.classId,
      getKnownSpellIdsForClassIntent(character, classIntent.classId)
    ])
  )
  const classOrder = new Map(
    character.intent.classes.map((classIntent, index) => [classIntent.classId, index])
  )
  const activeClassIds = new Set(character.intent.classes.map((classIntent) => classIntent.classId))
  const classSelectionSources = getClassSpellSelectionSources(character)
  const sourcesBySpellId = new Map<string, Map<string, CharacterSheetSpellSource>>()

  function addSpellSource(
    spellId: string,
    classId: string,
    sourceId?: string,
    provenance: 'CLASS' | 'SUBCLASS' = 'CLASS'
  ) {
    if (!activeClassIds.has(classId)) return
    if (!sheetSpellIdsByClassId.get(classId)?.has(spellId)) return
    const sources = sourcesBySpellId.get(spellId) ?? new Map<string, CharacterSheetSpellSource>()
    const classState = classStateById.get(classId)
    const prepared = classState?.spells?.prepared?.includes(spellId) ?? false
    const known = knownSpellIdsByClassId.get(classId)?.has(spellId) ?? false
    const selectedSource =
      sourceId === undefined
        ? classSelectionSources.get(classSpellSelectionKey(classId, spellId))
        : undefined
    const effectiveProvenance = selectedSource?.sourceKind ?? provenance
    const sourceInstanceId = createCharacterDefinitionSourceInstanceId(
      effectiveProvenance,
      sourceId ?? selectedSource?.sourceRecordId ?? classId
    )
    const source = {
      spellId,
      sourceKind: effectiveProvenance,
      sourceInstanceId
    }
    const sourceKey = createCharacterSpellSourceKey(source)
    const current = sources.get(sourceKey)
    sources.set(sourceKey, {
      id: sourceInstanceId,
      classId,
      label: classLabels.get(classId) ?? 'Class',
      source,
      provenance: effectiveProvenance,
      ...(prepared
        ? { acquisition: 'PREPARED' as const }
        : known
          ? { acquisition: 'KNOWN' as const }
          : {}),
      castMode: 'SPELL_SLOT',
      canPrepare: preparationCapableClassIds.has(classId),
      prepared: current?.prepared || prepared
    })
    sourcesBySpellId.set(spellId, sources)
  }

  for (const classIntent of character.intent.classes) {
    if (!preparationCapableClassIds.has(classIntent.classId)) continue
    for (const spellId of sheetSpellIdsByClassId.get(classIntent.classId) ?? []) {
      addSpellSource(spellId, classIntent.classId)
    }
  }

  for (const selection of character.intent.spellSelections ?? []) {
    const source = selection.source
    if (source.kind === 'CLASS') {
      for (const spellId of selection.spells) addSpellSource(spellId, source.classId, selection.id)
      continue
    }

    if (source.kind === 'SUBCLASS') {
      const owningClass = character.intent.classes.find(
        (classIntent) => classIntent.subclassId === source.subclassId
      )
      if (!owningClass) continue
      for (const spellId of selection.spells)
        addSpellSource(spellId, owningClass.classId, selection.id, 'SUBCLASS')
      continue
    }

    for (const spellId of selection.spells) {
      const existing = sourcesBySpellId.get(spellId) ?? new Map<string, CharacterSheetSpellSource>()
      const sourceInstanceId = createCharacterDefinitionSourceInstanceId(source.kind, selection.id)
      const spellSource = {
        spellId,
        sourceKind: source.kind,
        sourceInstanceId
      }
      existing.set(createCharacterSpellSourceKey(spellSource), {
        id: sourceInstanceId,
        label: source.kind === 'FEATURE' ? 'Feature' : 'Option',
        source: spellSource,
        provenance: source.kind,
        acquisition: 'GRANTED',
        castMode: 'SPELL_SLOT',
        canPrepare: false,
        prepared: true
      })
      sourcesBySpellId.set(spellId, existing)
    }
  }

  for (const classState of character.state.classes ?? []) {
    for (const spellId of classState.spells?.learned ?? []) {
      if (sheetSpellIdsByClassId.get(classState.classId)?.has(spellId))
        addSpellSource(spellId, classState.classId)
    }
    for (const spellId of classState.spells?.prepared ?? []) {
      if (sheetSpellIdsByClassId.get(classState.classId)?.has(spellId))
        addSpellSource(spellId, classState.classId)
    }
  }

  for (const access of spellAccess) {
    const sources =
      sourcesBySpellId.get(access.spellId) ?? new Map<string, CharacterSheetSpellSource>()
    const attributes = new Set(access.attributes ?? [])
    const source = {
      spellId: access.spellId,
      sourceKind: 'FEATURE' as const,
      sourceInstanceId: access.sourceInstanceId
    }
    sources.set(createCharacterSpellSourceKey(source), {
      id: access.id,
      label:
        featureLabels.get(access.sourceFeatureId) ??
        (access.source.kind === 'CLASS'
          ? (classLabels.get(access.source.classId) ?? 'Feature')
          : 'Feature'),
      source,
      provenance: 'FEATURE',
      acquisition: attributes.has('PREPARED')
        ? 'ALWAYS_PREPARED'
        : attributes.has('KNOWN')
          ? 'KNOWN'
          : 'GRANTED',
      castMode: attributes.has('LIMITED_USE')
        ? 'LIMITED_USE'
        : attributes.has('CAST_AT_WILL')
          ? 'AT_WILL'
          : attributes.has('CAST_AT_LEVEL')
            ? 'FIXED_LEVEL'
            : attributes.has('RITUAL')
              ? 'RITUAL'
              : 'SPELL_SLOT',
      ...(attributes.has('CAST_AT_LEVEL') && access.castAtLevel !== undefined
        ? { fixedLevel: access.castAtLevel }
        : {}),
      ...(access.charges ? { resourceGrantId: access.id } : {}),
      canPrepare: false,
      prepared: attributes.has('PREPARED')
    })
    sourcesBySpellId.set(access.spellId, sources)
  }

  return new Map(
    [...sourcesBySpellId.entries()].map(([spellId, sources]) => [
      spellId,
      [...sources.values()].sort((left, right) => {
        const leftOrder = left.classId
          ? (classOrder.get(left.classId) ?? Number.MAX_SAFE_INTEGER)
          : Number.MAX_SAFE_INTEGER
        const rightOrder = right.classId
          ? (classOrder.get(right.classId) ?? Number.MAX_SAFE_INTEGER)
          : Number.MAX_SAFE_INTEGER
        return leftOrder - rightOrder || left.label.localeCompare(right.label)
      })
    ])
  )
}

function getSpellPreparationSources(
  character: CharacterAuthored,
  classLabels: ReadonlyMap<string, string>,
  sheetSpellIdsByClassId: ReadonlyMap<string, ReadonlySet<string>>,
  preparationCapableClassIds: ReadonlySet<string>,
  resolution: CharacterBuilderResolution
) {
  const classStateById = new Map(
    (character.state.classes ?? []).map((classState) => [classState.classId, classState])
  )

  return character.intent.classes
    .filter((classIntent) => preparationCapableClassIds.has(classIntent.classId))
    .map((classIntent) => {
      const sheetSpellIds = sheetSpellIdsByClassId.get(classIntent.classId) ?? new Set<string>()
      const preparedSpellLimit = getPreparedSpellLimitForClassIntent(classIntent, resolution)
      return {
        classId: classIntent.classId,
        label: classLabels.get(classIntent.classId) ?? 'Class',
        ...(preparedSpellLimit === undefined ? {} : { preparedSpellLimit }),
        preparedSpellIds: [
          ...new Set(classStateById.get(classIntent.classId)?.spells?.prepared ?? [])
        ].filter((spellId) => sheetSpellIds.has(spellId))
      }
    })
}

function isActiveSpellSource(spell: SheetSpell, source: SheetSpellSource): boolean {
  if (source.acquisition === 'ALWAYS_PREPARED' || source.acquisition === 'GRANTED') return true
  if (spell.level === 0) return source.acquisition === 'KNOWN' || Boolean(source.prepared)
  if (source.canPrepare) return Boolean(source.prepared)
  return source.acquisition === 'KNOWN' || Boolean(source.prepared)
}

function applyFlatSpellDamageBonus(expression: string, bonus: number): string {
  if (bonus === 0) return expression
  return `${expression} ${bonus > 0 ? '+' : '-'} ${Math.abs(bonus)}`
}

function getSpellPrimaryEffect(
  mechanics: readonly CharacterSheetProjectedMechanic[],
  castLevel: number,
  damageBonus: number
): string | undefined {
  const outcomes = mechanics.flatMap((mechanic) => mechanic.outcomes)
  const damage = outcomes.find((outcome) => outcome.kind === 'DAMAGE')
  if (damage?.kind === 'DAMAGE') {
    const expression =
      damage.scaling?.find((entry) => entry.level === castLevel)?.expression ?? damage.expression
    return `${applyFlatSpellDamageBonus(expression, damageBonus)} ${damage.damageTypeLabel}`
  }

  return undefined
}

function projectSpellMechanicsForCast(
  mechanics: readonly CharacterSheetProjectedMechanic[],
  castLevel: number,
  sourceMechanics: EngineCharacterOutput['spellMechanics'][number] | undefined
): CharacterSheetProjectedMechanic[] {
  return mechanics.map((mechanic) => ({
    ...mechanic,
    ...(mechanic.trigger === 'SPELL_ATTACK' && sourceMechanics?.attackBonus !== undefined
      ? { attackBonus: sourceMechanics.attackBonus }
      : {}),
    ...(mechanic.save && sourceMechanics?.saveDC !== undefined
      ? { save: { ...mechanic.save, dc: sourceMechanics.saveDC } }
      : {}),
    outcomes: mechanic.outcomes.map((outcome) => {
      if (outcome.kind !== 'DAMAGE' && outcome.kind !== 'HEAL') return outcome
      const expression =
        outcome.scaling?.find((entry) => entry.level === castLevel)?.expression ??
        outcome.expression
      return {
        ...outcome,
        expression:
          outcome.kind === 'DAMAGE'
            ? applyFlatSpellDamageBonus(expression, sourceMechanics?.damageBonus ?? 0)
            : expression
      }
    })
  }))
}

function getExplicitSpellCastLevels(
  spell: SheetSpell,
  source: SheetSpellSource,
  ownedSlotLevels: ReadonlySet<number>
): number[] {
  const baseLevel = source.fixedLevel ?? spell.level
  if ((source.castMode ?? 'SPELL_SLOT') !== 'SPELL_SLOT' || spell.level === 0) return [baseLevel]

  const explicitLevels = new Set(
    (spell.mechanics ?? []).flatMap((mechanic) =>
      mechanic.outcomes.flatMap((outcome) =>
        outcome.kind === 'DAMAGE' || outcome.kind === 'HEAL'
          ? (outcome.scaling ?? []).map((entry) => entry.level)
          : []
      )
    )
  )
  return [
    baseLevel,
    ...[...explicitLevels].filter((level) => level > baseLevel && ownedSlotLevels.has(level))
  ].sort((left, right) => left - right)
}

function getSpellCastAvailability(params: {
  spell: SheetSpell
  source: SheetSpellSource
  castLevel: number
  baseEntry: boolean
  slots: readonly SheetSpellSlot[]
  resources: readonly SheetResource[]
}): {
  available: boolean
  unavailableReason?: string
  slotKey?: string
} {
  const castMode = params.source.castMode ?? 'SPELL_SLOT'
  if (params.spell.level === 0 || castMode === 'AT_WILL' || castMode === 'RITUAL')
    return { available: true }

  if (castMode === 'LIMITED_USE' || castMode === 'FIXED_LEVEL') {
    if (!params.source.resourceOwner) {
      return castMode === 'FIXED_LEVEL'
        ? { available: true }
        : { available: false, unavailableReason: 'No linked uses are available.' }
    }
    const resource = findResourceByOwner(params.resources, params.source.resourceOwner)
    return resource?.remaining
      ? { available: true }
      : { available: false, unavailableReason: 'No uses remaining.' }
  }

  const eligibleSlots = params.slots
    .filter((slot) => {
      const level = slot.level ?? parseSlotLevel(slot.slotKey)
      return (
        level !== null &&
        (params.baseEntry ? level >= params.castLevel : level === params.castLevel) &&
        slot.max > 0
      )
    })
    .sort(
      (left, right) =>
        (left.level ?? parseSlotLevel(left.slotKey) ?? 0) -
        (right.level ?? parseSlotLevel(right.slotKey) ?? 0)
    )
  const selected = eligibleSlots.find((slot) => slot.remaining > 0) ?? eligibleSlots[0]
  if (!selected) {
    return {
      available: false,
      unavailableReason: `No level ${params.castLevel} spell slot is available.`
    }
  }
  return selected.remaining > 0
    ? { available: true, slotKey: selected.slotKey }
    : {
        available: false,
        unavailableReason: `${selected.label} spell slots are exhausted.`,
        slotKey: selected.slotKey
      }
}

function buildActiveSpellGroups(params: {
  spells: readonly SheetSpell[]
  slots: readonly SheetSpellSlot[]
  resources: readonly SheetResource[]
  spellMechanics: EngineCharacterOutput['spellMechanics']
}): CharacterSheetResponseDto['spells']['activeGroups'] {
  const ownedSlotLevels = new Set(
    params.slots.flatMap((slot) => {
      const level = slot.level ?? parseSlotLevel(slot.slotKey)
      return level !== null && slot.max > 0 ? [level] : []
    })
  )
  const spellMechanicsBySourceKey = new Map(
    params.spellMechanics.map((mechanics) => [
      createCharacterSpellSourceKey(mechanics.source),
      mechanics
    ])
  )
  const rows = params.spells.flatMap((spell) =>
    (spell.sources ?? []).flatMap((source) => {
      if (!isActiveSpellSource(spell, source)) return []
      const sourceKey = createCharacterSpellSourceKey(source.source)
      const sourceMechanics = spellMechanicsBySourceKey.get(sourceKey)
      const castLevels = getExplicitSpellCastLevels(spell, source, ownedSlotLevels)
      return castLevels.map((castLevel, index) => {
        const mechanics = spell.mechanics ?? []
        const availability = getSpellCastAvailability({
          spell,
          source,
          castLevel,
          baseEntry: index === 0,
          slots: params.slots,
          resources: params.resources
        })
        const displayName = source.customName ?? spell.label
        const primaryEffect = getSpellPrimaryEffect(
          mechanics,
          castLevel,
          sourceMechanics?.damageBonus ?? 0
        )
        const projectedMechanics = projectSpellMechanicsForCast(
          mechanics,
          castLevel,
          sourceMechanics
        )
        const activation = mechanics
          .map((mechanic) => mechanic.activation)
          .find((candidate) => candidate?.kind.trim())
        const activationType: 'ACTION' | 'BONUS_ACTION' | 'REACTION' | 'FREE' | undefined =
          activation?.kind === 'ACTION'
            ? 'ACTION'
            : activation?.kind === 'BONUS_ACTION'
              ? 'BONUS_ACTION'
              : activation?.kind === 'REACTION'
                ? 'REACTION'
                : activation?.kind === 'FREE'
                  ? 'FREE'
                  : undefined
        const activationKindLabel = activation ? formatCodeLabel(activation.kind) : undefined
        const activationLabel =
          activation && activationKindLabel
            ? activation.amount === 1
              ? activationKindLabel
              : `${activation.amount} ${activationKindLabel.toLowerCase()}s`
            : undefined
        const rangeLabel = mechanics
          .map((mechanic) => mechanic.rangeLabel?.trim())
          .find((candidate): candidate is string => Boolean(candidate))
        const hasAttack = mechanics.some(
          (mechanic) => mechanic.trigger === 'SPELL_ATTACK' || mechanic.attackBonus !== undefined
        )
        const authoredAttackBonus = mechanics.find(
          (mechanic) => mechanic.attackBonus !== undefined
        )?.attackBonus
        const save = mechanics.find((mechanic) => mechanic.save)?.save
        const attackBonus = sourceMechanics?.attackBonus ?? authoredAttackBonus
        const saveDc = sourceMechanics?.saveDC ?? save?.dc
        const hitOrDcLabel =
          hasAttack && attackBonus !== undefined
            ? formatModifier(attackBonus)
            : save && saveDc !== undefined
              ? `${ABILITIES[save.ability].short} ${saveDc}`
              : undefined
        return {
          rowId: `${sourceKey}:level:${castLevel}`,
          target: { kind: 'SPELL' as const, source: source.source, castLevel },
          spellId: spell.id,
          source: source.source,
          sourceId: source.id ?? source.source.sourceInstanceId,
          displayName,
          sourceLabel: source.label,
          castLevel,
          ...(activationType ? { activationType } : {}),
          ...(activationLabel ? { activationLabel } : {}),
          ...(rangeLabel ? { rangeLabel } : {}),
          ...(hitOrDcLabel ? { hitOrDcLabel } : {}),
          ...(primaryEffect ? { primaryEffect } : {}),
          ...(projectedMechanics.length ? { mechanics: projectedMechanics } : {}),
          available: availability.available,
          ...(availability.unavailableReason
            ? { unavailableReason: availability.unavailableReason }
            : {}),
          cast: {
            spellId: spell.id,
            sourceId: source.id ?? source.source.sourceInstanceId,
            ...(availability.slotKey ? { slotKey: availability.slotKey } : {})
          }
        }
      })
    })
  )

  const duplicateCounts = new Map<string, number>()
  for (const row of rows) {
    const key = `${row.castLevel}:${row.displayName.toLocaleLowerCase()}`
    duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1)
  }

  return [...new Set(rows.map((row) => row.castLevel))]
    .sort((left, right) => left - right)
    .map((level) => ({
      level,
      label: level === 0 ? 'Cantrips' : `Level ${level}`,
      entries: rows
        .filter((row) => row.castLevel === level)
        .map((row) => {
          const duplicateKey = `${row.castLevel}:${row.displayName.toLocaleLowerCase()}`
          return (duplicateCounts.get(duplicateKey) ?? 0) > 1
            ? { ...row, sourceQualifier: row.sourceLabel }
            : row
        })
        .sort(
          (left, right) =>
            left.displayName.localeCompare(right.displayName) ||
            left.rowId.localeCompare(right.rowId)
        )
    }))
}

function findResourceDefinition(
  resolution: CharacterBuilderResolution,
  resource: CharacterBuilderResolution['grants']['resources'][number],
  resourceDefinitionId = resource.id
) {
  switch (resource.source.kind) {
    case 'CLASS': {
      const source = resource.source
      const record = resolution.registry.classes.find(
        (candidate) => candidate.id === source.classId
      )
      return record?.resources?.id === resourceDefinitionId ? record.resources : undefined
    }
    case 'SUBCLASS': {
      const source = resource.source
      const record = resolution.registry.classes.find(
        (candidate) =>
          candidate.category === CLASS_CATEGORY.SUBCLASS &&
          candidate.resources?.id === resourceDefinitionId &&
          (candidate.id === source.subclassId || candidate.label === resource.sourceLabel)
      )
      return record?.resources?.id === resourceDefinitionId ? record.resources : undefined
    }
    default:
      return undefined
  }
}

type CharacterResourceGrantRecord = NonNullable<
  CharacterAuthored['intent']['resourceGrants']
>[number]

function isSameResourceGrantSource(
  left: CharacterResourceGrantRecord['source'],
  right: CharacterBuilderResolution['grants']['resources'][number]['source']
): boolean {
  if (left.kind !== right.kind) return false

  if (left.kind === 'CLASS' && right.kind === 'CLASS') {
    return left.classId === right.classId
  }

  if (left.kind === 'SUBCLASS' && right.kind === 'SUBCLASS') {
    return left.subclassId === right.subclassId
  }

  return false
}

function findResourceGrantRecord(
  character: CharacterAuthored,
  resource: CharacterBuilderResolution['grants']['resources'][number]
): CharacterResourceGrantRecord | undefined {
  return character.intent.resourceGrants?.find(
    (grant) =>
      grant.resourceId === resource.id && isSameResourceGrantSource(grant.source, resource.source)
  )
}

function getResourceRecovery(
  resetKind: string
): CharacterSheetResponseDto['resources']['items'][number]['recoveries'][number] {
  switch (resetKind) {
    case 'DAILY':
    case 'DAWN':
    case 'DUSK':
    case 'SHORT_REST':
    case 'LONG_REST':
    case 'MANUAL':
      return { trigger: resetKind, amount: { kind: 'ALL' } }
    default:
      return { trigger: 'MANUAL', amount: { kind: 'ALL' } }
  }
}

function resourceGrantSourceRef(
  source: CharacterProvenance,
  systemId: string
): CharacterMechanicSourceRef {
  if (source.kind === 'MANUAL') {
    return { kind: 'SYSTEM', systemId }
  }

  const definitionId = (() => {
    switch (source.kind) {
      case 'CLASS':
        return source.classId
      case 'SUBCLASS':
        return source.subclassId
      case 'RACE':
        return source.raceId
      case 'SUBRACE':
        return source.subraceId
      case 'ANCESTRY':
        return source.optionId
      case 'BACKGROUND':
        return source.backgroundId
      case 'FEAT':
        return source.featId
      case 'FEATURE':
        return source.featureId
      case 'OPTION':
        return source.optionId
    }
  })()
  return {
    kind: 'AUTHORED',
    sourceKind: source.kind,
    definitionId,
    sourceInstanceId: getCharacterProvenanceIdentityKey(source)
  }
}

function getResourceSheetConfig(params: {
  character: CharacterAuthored
  proficiencyBonus: number
  resolution: CharacterBuilderResolution
  resource: CharacterBuilderResolution['grants']['resources'][number]
  resourceDefinitionId?: string
  resolvedRecovery?: EngineResource['rechargeOn']
  totalLevel: number
}): {
  max: number
  recoveries: CharacterSheetResponseDto['resources']['items'][number]['recoveries']
} | null {
  const definition = findResourceDefinition(
    params.resolution,
    params.resource,
    params.resourceDefinitionId
  )
  if (!definition) return null

  const charge = compileCharge(definition.charges)
  return {
    max: resolveCompiledChargeMaximum(charge, {
      abilities: params.resolution.summary.abilities,
      classLevels: Object.fromEntries(
        params.character.intent.classes.map((entry) => [entry.classId, entry.classLevel])
      ),
      proficiencyBonus: params.proficiencyBonus,
      sourceClassLevel:
        'classLevel' in params.resource.source ? params.resource.source.classLevel : undefined,
      totalLevel: params.totalLevel
    }),
    recoveries: [getResourceRecovery(params.resolvedRecovery ?? definition.charges.resetKind)]
  }
}

function formatExtraMeasurement(amount: number, unit: MeasurementUnitCode): string {
  return `${amount} ${MEASUREMENT_UNIT_REGISTRY[unit].label.toLowerCase()}`
}

function formatExtraSpeedLabel(
  speeds: ReadonlyArray<{ speedId: string; amount: number; unit: MeasurementUnitCode }> | undefined,
  speedDefinitions: ReadonlyArray<{ id: string; code?: string; label: string }> | undefined
): string | undefined {
  if (!speeds?.length) return undefined
  const resolvedSpeeds = speeds.map((speed) => {
    const definition = speedDefinitions?.find(
      (candidate) => candidate.id === speed.speedId || candidate.code === speed.speedId
    )
    const normalizedCode = definition?.code?.toUpperCase() ?? speed.speedId.toUpperCase()
    const normalizedLabel = definition?.label.trim().toLowerCase()
    const isWalking =
      normalizedCode === 'WALK' ||
      normalizedCode === 'WALKING' ||
      normalizedLabel === 'walk' ||
      normalizedLabel === 'walking' ||
      normalizedLabel === 'walking speed'
    return { definition, isWalking, speed }
  })
  const selected = resolvedSpeeds.find(({ isWalking }) => !isWalking) ?? resolvedSpeeds[0]
  if (!selected) return undefined

  const measurement = formatExtraMeasurement(selected.speed.amount, selected.speed.unit)
  if (selected.isWalking) return measurement
  const movementLabel = selected.definition?.label.replace(/\s+speed$/i, '')
  return movementLabel ? `${movementLabel} ${measurement}` : measurement
}

function toExtraFeatures(
  features:
    | ReadonlyArray<{ id: string; label: string; description: string; section?: string }>
    | undefined
) {
  return (features ?? [])
    .filter((feature) => feature.section === undefined || feature.section === 'TRAIT')
    .map((feature) => ({
      id: feature.id,
      label: feature.label,
      ...(feature.description ? { description: feature.description } : {})
    }))
}

function toExtraActions(
  features:
    | ReadonlyArray<{ id: string; label: string; description: string; section?: string }>
    | undefined
) {
  return (features ?? [])
    .filter((feature) => feature.section !== undefined && feature.section !== 'TRAIT')
    .map((feature) => ({
      id: feature.id,
      label: feature.label,
      ...(feature.description ? { description: feature.description } : {})
    }))
}

function toCreatureHitDice(
  state: NonNullable<CharacterAuthored['state']['creatures']>[number]['hitDice'] | undefined,
  authored: { hitDice?: { count: number; die: number } }
) {
  const hitDice =
    state ??
    (authored.hitDice
      ? [{ die: authored.hitDice.die, total: authored.hitDice.count, used: 0 }]
      : [])
  return hitDice.map((die) => ({
    ...die,
    used: Math.min(die.used, die.total),
    remaining: Math.max(die.total - die.used, 0)
  }))
}

function createCompanionInputs(
  character: CharacterAuthored,
  creaturesById: ReadonlyMap<
    string,
    {
      id: string
      abilityScores: Record<string, number>
      armorClass: number
      hitPoints: number
      size?: NonNullable<CharacterBuildSnapshot['companions']>[number]['size']
      alignmentId?: string
      creatureTypeId?: string
    }
  >
): NonNullable<CharacterBuildSnapshot['companions']> {
  return (character.state.creatures ?? []).flatMap((instance) => {
    const creature = creaturesById.get(instance.creatureId)
    if (!creature) return []
    return [
      {
        companionInstanceId: instance.id,
        creatureId: creature.id,
        abilityScores: creature.abilityScores,
        armorClass: creature.armorClass,
        maxHitPoints: creature.hitPoints,
        ...(creature.size ? { size: creature.size } : {}),
        ...(creature.alignmentId ? { alignmentId: creature.alignmentId } : {}),
        ...(creature.creatureTypeId ? { creatureTypeId: creature.creatureTypeId } : {})
      }
    ]
  })
}

export async function buildCharacterSheetResponse(params: {
  db: DBLike
  character: CharacterAuthored
  resolution: CharacterBuilderResolution
  streamVersion: number
  hasBuilderDraft?: boolean
  adjustments?: readonly CharacterSheetAdjustment[]
  movementDisplayPreference?: CharacterMovementDisplayPreference
  resourceUsage?: readonly CharacterResourceUsage[]
  spellCustomizations?: readonly CharacterSpellCustomization[]
  additionalConditions?: ReadonlyArray<{ conditionTypeId: string; notes?: string }>
}): Promise<CharacterSheetResponseDto> {
  const { character, resolution } = params
  const adjustments = params.adjustments ?? []
  const spellCustomizations = params.spellCustomizations ?? []
  const selectedCreatureIds = [
    ...new Set((character.state.creatures ?? []).map((instance) => instance.creatureId))
  ]
  const selectedVehicleIds = [
    ...new Set((character.state.vehicles ?? []).map((instance) => instance.vehicleId))
  ]
  const extraCatalogFilter = {
    systemId: character.systemId,
    userId: character.userId,
    includeMaster: true
  }
  const [extraCatalog, creaturesById, vehiclesById] = await Promise.all([
    getCharacterSheetExtraCatalogQuery(params.db, {
      systemId: character.systemId,
      userId: character.userId
    }),
    selectedCreatureIds.length > 0
      ? createCreatureRepository(params.db).findByIds(selectedCreatureIds, extraCatalogFilter)
      : Promise.resolve(new Map<string, CreatureAuthored>()),
    selectedVehicleIds.length > 0
      ? createVehicleRepository(params.db).findByIds(selectedVehicleIds, extraCatalogFilter)
      : Promise.resolve(new Map<string, VehicleAuthored>())
  ])
  const totalLevel = Math.max(resolution.summary.totalLevel, 1)
  const engineOutput = resolveCharacterSheetEngine({
    character,
    resolution,
    adjustments,
    movementDisplayPreference: params.movementDisplayPreference,
    companions: createCompanionInputs(character, creaturesById)
  })
  const rulesSystem = resolveRulesSystem({
    code: resolution.registry.system?.rulesetCode ?? '',
    version: resolution.registry.system?.rulesetVersion ?? ''
  })
  const itemMechanicsByInstanceId = new Map(
    engineOutput.itemMechanics.map((item) => [item.itemInstanceId, item])
  )
  const spellCustomizationsBySourceKey = new Map(
    spellCustomizations.map((customization) => [
      createCharacterSpellSourceKey(customization.source),
      customization
    ])
  )
  const proficiencyBonus = engineOutput.derivedStats.proficiencyBonus
  const maxHitPoints = resolveCharacterEffectiveMaximumHitPoints(
    engineOutput.derivedStats.maxHitPoints
  )
  const conditionOptions = await getConditionOptions(params.db, character.systemId)
  const conditionsById = new Map(conditionOptions.map((condition) => [condition.id, condition]))
  const equipmentById = new Map(
    resolution.registry.equipment.map((equipment) => [equipment.id, equipment])
  )
  const equipmentLabels = new Map(
    resolution.catalog.equipment.map((equipment) => [equipment.id, equipment.label])
  )
  const skillLabels = createVocabularyLabelMap(resolution.registry.system?.skills)
  const languageLabels = createVocabularyLabelMap(resolution.registry.system?.languages)
  const senseLabels = createVocabularyLabelMap(resolution.registry.system?.senses)
  const damageTypeLabels = createVocabularyLabelMap(resolution.registry.system?.damageTypes)
  const currencyOptions =
    resolution.registry.system?.currencies.map((currency) => ({
      id: currency.id,
      label: currency.label
    })) ?? []
  const currencyLabels = new Map(currencyOptions.map((currency) => [currency.id, currency.label]))
  const skillReference = createSkillReference(resolution.registry.system?.skills)
  const spellSlotsUsed = new Map(
    (character.state.spellSlots ?? []).map((slot) => [slot.slotKey, slot.used])
  )
  const spellSlots = getSpellSlotMaximums(engineOutput.spellSlots).map((slot) => {
    const used = Math.min(spellSlotsUsed.get(slot.slotKey) ?? 0, slot.max)
    return {
      ...slot,
      used,
      remaining: Math.max(slot.max - used, 0)
    }
  })
  const { learned, prepared } = getPreparedAndKnownSpellIds(character)
  const knownSpellIds = new Set([...learned, ...prepared])
  const resourceUsage = new Map(
    (params.resourceUsage ?? []).map((resource) => [
      createCharacterResourceOwnerKey(resource.owner),
      resource.used
    ])
  )
  if (params.resourceUsage === undefined) {
    for (const resource of character.state.resources ?? []) {
      resourceUsage.set(
        createCharacterResourceOwnerKey({
          kind: 'AUTHORED_GRANT',
          resourceGrantId: resource.resourceGrantId
        }),
        resource.used
      )
    }
  }
  const resourceRecoveryByDefinitionId = new Map(
    engineOutput.resources.map((resource) => [resource.resourceId, resource.rechargeOn])
  )
  const resourceFeatureByDefinitionId = new Map(
    engineOutput.resources.map((resource) => [resource.resourceId, resource.sourceFeatureId])
  )
  const classLabels = new Map(
    resolution.registry.classes.map((classRecord) => [classRecord.id, classRecord.label])
  )
  const featureLabels = new Map(
    resolution.grants.features.map((feature) => [feature.id, feature.label])
  )
  const creatureTypeLabels = new Map(
    resolution.registry.system?.creatureTypes?.map((creatureType) => [
      creatureType.id,
      creatureType.label
    ]) ?? []
  )
  const activeCreatures = extraCatalog.creatures.filter(
    (creature) =>
      (creature.status ?? AUTHORED_RECORD_STATUS.ACTIVE) === AUTHORED_RECORD_STATUS.ACTIVE
  )
  const activeVehicles = extraCatalog.vehicles.filter(
    (vehicle) => (vehicle.status ?? AUTHORED_RECORD_STATUS.ACTIVE) === AUTHORED_RECORD_STATUS.ACTIVE
  )
  const companionMechanicsByInstanceId = new Map(
    engineOutput.companions.map((companion) => [companion.companionInstanceId, companion])
  )
  const creatureExtras: CharacterSheetResponseDto['extras']['items'] = (
    character.state.creatures ?? []
  ).flatMap((instance) => {
    const creature = creaturesById.get(instance.creatureId)
    if (!creature) return []
    const mechanics = companionMechanicsByInstanceId.get(instance.id)
    const maximumHitPoints = Math.max(mechanics?.maxHitPoints ?? creature.hitPoints, 0)
    const currentHitPoints = clamp(
      instance.currentHitPoints ?? maximumHitPoints,
      0,
      maximumHitPoints
    )
    const hitDice = toCreatureHitDice(instance.hitDice, creature)
    return [
      {
        kind: instance.relationshipKind,
        kindLabel: CHARACTER_EXTRA_KIND_REGISTRY[instance.relationshipKind].label,
        id: instance.id,
        creatureId: creature.id,
        relationshipKind: instance.relationshipKind,
        relationshipLabel: CREATURE_RELATIONSHIP_KIND_REGISTRY[instance.relationshipKind].label,
        originKind: instance.originKind,
        originLabel: CREATURE_ORIGIN_KIND_REGISTRY[instance.originKind].label,
        authoredName: creature.label,
        displayName: instance.customName ?? creature.label,
        ...(instance.customName ? { customName: instance.customName } : {}),
        ...(instance.notes ? { notes: instance.notes } : {}),
        isActive: instance.isActive ?? true,
        armorClass: Math.max(mechanics?.armorClass ?? creature.armorClass, 0),
        ...(mechanics?.size ? { size: mechanics.size } : {}),
        ...(mechanics?.alignmentId ? { alignmentId: mechanics.alignmentId } : {}),
        ...(mechanics?.creatureTypeId ? { creatureTypeId: mechanics.creatureTypeId } : {}),
        ...(formatExtraSpeedLabel(creature.speeds, resolution.registry.system?.speeds)
          ? {
              speedLabel: formatExtraSpeedLabel(creature.speeds, resolution.registry.system?.speeds)
            }
          : {}),
        ...(creature.carryingCapacity
          ? {
              carryingCapacityLabel: formatExtraMeasurement(
                creature.carryingCapacity.amount,
                creature.carryingCapacity.unit
              )
            }
          : {}),
        ...(creature.mountProfile?.riderCount === undefined
          ? {}
          : { riderCapacity: creature.mountProfile.riderCount }),
        hitPoints: {
          current: currentHitPoints,
          maximum: maximumHitPoints,
          temp: Math.max(instance.tempHitPoints ?? 0, 0)
        },
        hitDice,
        actions: toExtraActions(creature.features),
        features: toExtraFeatures(creature.features),
        equipmentItemIds: (character.state.creatureEquipment?.[instance.id] ?? []).map(
          (assignment) => assignment.equipmentItemId
        )
      }
    ]
  })
  const vehicleExtras: CharacterSheetResponseDto['extras']['items'] = (
    character.state.vehicles ?? []
  ).flatMap((instance) => {
    const vehicle = vehiclesById.get(instance.vehicleId)
    if (!vehicle) return []
    const maximumHitPoints = Math.max(vehicle.hitPoints ?? 0, 0)
    return [
      {
        kind: 'VEHICLE' as const,
        kindLabel: CHARACTER_EXTRA_KIND_REGISTRY.VEHICLE.label,
        id: instance.id,
        vehicleId: vehicle.id,
        categoryLabel: VEHICLE_CATEGORY_REGISTRY[vehicle.category].label,
        authoredName: vehicle.label,
        displayName: instance.customName ?? vehicle.label,
        ...(instance.customName ? { customName: instance.customName } : {}),
        ...(instance.notes ? { notes: instance.notes } : {}),
        isActive: instance.isActive ?? true,
        ...(vehicle.speed === undefined
          ? {}
          : {
              speedLabel: `${vehicle.speed}${vehicle.speedNote ? ` (${vehicle.speedNote})` : ''}`
            }),
        ...(vehicle.crewMin === undefined && vehicle.crewMax === undefined
          ? {}
          : {
              crewLabel:
                vehicle.crewMin === vehicle.crewMax || vehicle.crewMax === undefined
                  ? String(vehicle.crewMin ?? vehicle.crewMax)
                  : `${vehicle.crewMin ?? 0}-${vehicle.crewMax}`
            }),
        ...(vehicle.passengerCapacity === undefined
          ? {}
          : { passengerCapacity: vehicle.passengerCapacity }),
        ...(vehicle.cargoCapacity ? { cargoCapacityLabel: vehicle.cargoCapacity } : {}),
        hitPoints: {
          current: clamp(instance.currentHitPoints ?? maximumHitPoints, 0, maximumHitPoints),
          maximum: maximumHitPoints
        },
        actions: toExtraActions(vehicle.features),
        features: toExtraFeatures(vehicle.features),
        equipmentItemIds: (character.state.vehicleEquipment?.[instance.id] ?? []).map(
          (assignment) => assignment.equipmentItemId
        )
      }
    ]
  })
  const sheetExtras = {
    kindOptions: [...CHARACTER_EXTRA_KIND_OPTIONS],
    originOptions: [...CREATURE_ORIGIN_KIND_OPTIONS],
    creatureOptions: activeCreatures.map((creature) => ({
      id: creature.id,
      label: creature.label,
      ...(creature.description ? { description: creature.description } : {}),
      ...(creature.creatureTypeId && creatureTypeLabels.get(creature.creatureTypeId)
        ? { creatureTypeLabel: creatureTypeLabels.get(creature.creatureTypeId) }
        : {}),
      ...(creature.size
        ? { sizeLabel: SIZE_OPTIONS.find((size) => size.code === creature.size)?.label }
        : {}),
      armorClass: creature.armorClass,
      maximumHitPoints: creature.hitPoints,
      ...(formatExtraSpeedLabel(creature.speeds, resolution.registry.system?.speeds)
        ? {
            speedLabel: formatExtraSpeedLabel(creature.speeds, resolution.registry.system?.speeds)
          }
        : {})
    })),
    vehicleOptions: activeVehicles.map((vehicle) => ({
      id: vehicle.id,
      label: vehicle.label,
      ...(vehicle.description ? { description: vehicle.description } : {}),
      categoryLabel: VEHICLE_CATEGORY_REGISTRY[vehicle.category].label,
      ...(vehicle.hitPoints === undefined ? {} : { maximumHitPoints: vehicle.hitPoints }),
      ...(vehicle.speed === undefined ? {} : { speedLabel: String(vehicle.speed) })
    })),
    items: [...creatureExtras, ...vehicleExtras]
  } satisfies CharacterSheetResponseDto['extras']
  const preparationCapableClassIds = getPreparationCapableClassIds(character, resolution)
  const sheetSpellIdsByClassId = getSheetSpellIdsByClass(
    character,
    resolution,
    preparationCapableClassIds
  )
  const displayedSpellIds = new Set(knownSpellIds)
  for (const spellIds of sheetSpellIdsByClassId.values()) {
    for (const spellId of spellIds) displayedSpellIds.add(spellId)
  }
  for (const access of engineOutput.spellAccess) displayedSpellIds.add(access.spellId)
  const spellSourcesBySpellId = getSpellSourcesBySpellId(
    character,
    classLabels,
    sheetSpellIdsByClassId,
    preparationCapableClassIds,
    engineOutput.spellAccess,
    featureLabels
  )
  const spellPreparationSources = getSpellPreparationSources(
    character,
    classLabels,
    sheetSpellIdsByClassId,
    preparationCapableClassIds,
    resolution
  )
  const overviewSkills = Object.entries(engineOutput.derivedStats.skillBonuses)
    .map(([skill, total]) => {
      const metadata = skillReference.metadataByCanonical.get(skill)
      return {
        skillId: metadata?.skillId ?? skill,
        code: metadata?.code ?? toSkillFallbackCode(skill),
        label: metadata?.label ?? toSkillFallbackLabel(skill),
        ability: metadata?.ability ?? resolveAbilityCode(SKILL_ABILITY_MAP[skill] ?? 'DEXTERITY'),
        total,
        rollMode: engineOutput.rollModes.skillChecks[skill],
        proficiency: engineOutput.calculations.skillProficiencyLevels[skill]?.effective ?? 'NONE'
      }
    })
    .filter((row): row is OverviewSkillRow => row.ability !== undefined)
  const passiveFacts = buildPassiveOverviewFacts({
    passives: resolution.registry.system?.passives,
    passiveChecks: engineOutput.derivedStats.passiveChecks
  })
  const sheetReferenceFeatures = resolution.grants.features.filter(isSheetVisibleFeature)
  const equipmentActionFeatureIds = engineOutput.equipmentFeatureChargeUses.flatMap((use) => {
    const feature = equipmentById
      .get(use.equipmentId)
      ?.features?.find((candidate) => candidate.id === use.featureId)
    return feature && !feature.attributes?.includes(FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET)
      ? [feature.id]
      : []
  })
  const selectedFeatureOptionIds = getSelectedFeatureOptionIds(character)
  const mechanicsQuery = await getCharacterSheetMechanicsQuery(params.db, {
    spellIds: [...displayedSpellIds],
    featureIds: [
      ...new Set([
        ...sheetReferenceFeatures.map((feature) => feature.id),
        ...equipmentActionFeatureIds
      ])
    ],
    featureOptionIds: [...selectedFeatureOptionIds],
    featIds: (resolution.registry.feats ?? []).map((feat) => feat.id),
    equipmentIds: [...new Set(character.state.equipment.inventory.map((item) => item.equipmentId))]
  })
  const attunedEquipmentDefinitionIds = new Set(
    character.state.equipment.inventory.flatMap((item) =>
      character.state.equipment.attuned.includes(item.id) ? [item.equipmentId] : []
    )
  )
  const projectedMechanics = projectCharacterSheetMechanics({
    queryResult: mechanicsQuery,
    engine: engineOutput,
    totalCharacterLevel: totalLevel,
    classLevels: new Map(
      character.intent.classes.map((classIntent) => [classIntent.classId, classIntent.classLevel])
    ),
    attunedEquipmentIds: attunedEquipmentDefinitionIds
  })
  const mechanicOwnersByKey = new Map(
    mechanicsQuery.owners.map((owner) => [`${owner.ownerKind}:${owner.ownerId}`, owner])
  )
  const featureSourceLabels = new Map<string, string[]>()
  for (const feature of sheetReferenceFeatures) {
    const labels = featureSourceLabels.get(feature.id) ?? []
    if (!labels.includes(feature.sourceLabel)) labels.push(feature.sourceLabel)
    featureSourceLabels.set(feature.id, labels)
  }
  const optionParentFeatureIds = new Map<string, string>()
  for (const acquisition of character.intent.featureAcquisitions) {
    for (const selection of acquisition.selections ?? []) {
      if (selection.selectionKey !== 'options') continue
      for (const value of selection.values) {
        const optionIds = value.kind === 'ID' ? [value.id] : value.kind === 'IDS' ? value.ids : []
        for (const optionId of optionIds)
          optionParentFeatureIds.set(optionId, acquisition.featureId)
      }
    }
  }
  const equipmentFeatureChargeUsesByFeatureId = new Map<
    string,
    (typeof engineOutput.equipmentFeatureChargeUses)[number][]
  >()
  for (const use of engineOutput.equipmentFeatureChargeUses ?? []) {
    const uses = equipmentFeatureChargeUsesByFeatureId.get(use.featureId) ?? []
    uses.push(use)
    equipmentFeatureChargeUsesByFeatureId.set(use.featureId, uses)
  }
  const inventoryStateById = new Map(
    character.state.equipment.inventory.map((item) => [item.id, item] as const)
  )
  const chargeBearingItemsByEquipmentId = new Map<
    string,
    (typeof character.state.equipment.inventory)[number][]
  >()
  for (const item of character.state.equipment.inventory) {
    if (!equipmentById.get(item.equipmentId)?.charges) continue
    const copies = chargeBearingItemsByEquipmentId.get(item.equipmentId) ?? []
    copies.push(item)
    chargeBearingItemsByEquipmentId.set(item.equipmentId, copies)
  }
  const equipmentChargeSourceLabelsByItemId = new Map<string, string>()
  for (const copies of chargeBearingItemsByEquipmentId.values()) {
    const copyCountsByLabel = new Map<string, number>()
    for (const item of copies) {
      const label = item.customName ?? equipmentById.get(item.equipmentId)?.label ?? 'Item'
      copyCountsByLabel.set(label, (copyCountsByLabel.get(label) ?? 0) + 1)
    }
    const copyIndexesByLabel = new Map<string, number>()
    copies.forEach((item) => {
      const baseLabel = item.customName ?? equipmentById.get(item.equipmentId)?.label ?? 'Item'
      const labelIndex = (copyIndexesByLabel.get(baseLabel) ?? 0) + 1
      copyIndexesByLabel.set(baseLabel, labelIndex)
      equipmentChargeSourceLabelsByItemId.set(
        item.id,
        (copyCountsByLabel.get(baseLabel) ?? 0) > 1 ? `${baseLabel} #${labelIndex}` : baseLabel
      )
    })
  }
  const equipmentReferenceFeatures = engineOutput.equipmentFeatureChargeUses.flatMap((use) => {
    const feature = equipmentById
      .get(use.equipmentId)
      ?.features?.find((candidate) => candidate.id === use.featureId)
    if (!feature || feature.attributes?.includes(FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET)) return []

    return [
      {
        id: `${feature.id}:${use.itemInstanceId}`,
        label: feature.label,
        ...(feature.description ? { description: feature.description } : {}),
        ...(feature.attributes ? { attributes: feature.attributes } : {}),
        sourceLabel: equipmentChargeSourceLabelsByItemId.get(use.itemInstanceId) ?? feature.label,
        source: {
          kind: 'EQUIPMENT_INSTANCE' as const,
          equipmentId: use.equipmentId,
          itemInstanceId: use.itemInstanceId
        },
        resourceCost: use.cost,
        resourceGrantId: createCharacterResourceOwnerKey({
          kind: 'ITEM_INSTANCE',
          chargeId: use.chargeId,
          itemInstanceId: use.itemInstanceId
        })
      }
    ]
  })
  const actionItems: CharacterSheetResponseDto['actions']['items'] = []
  const actionSourceFeatureIds = new Map<string, string>()
  for (const ownerKind of ['FEATURE', 'FEATURE_OPTION', 'FEAT', 'EQUIPMENT'] as const) {
    for (const [ownerId, mechanics] of projectedMechanics[ownerKind]) {
      const owner = mechanicOwnersByKey.get(`${ownerKind}:${ownerId}`)
      if (!owner) continue
      const sourceFeatureId =
        ownerKind === 'FEATURE_OPTION' ? optionParentFeatureIds.get(ownerId) : ownerId
      const sourceLabel =
        ownerKind === 'EQUIPMENT'
          ? 'Equipment'
          : ownerKind === 'FEAT'
            ? 'Feat'
            : sourceFeatureId
              ? featureSourceLabels.get(sourceFeatureId)?.join(', ')
              : undefined
      for (const mechanic of mechanics) {
        const equipmentChargeUses =
          ownerKind === 'FEATURE' ? equipmentFeatureChargeUsesByFeatureId.get(ownerId) : undefined
        const actionChargeUses = equipmentChargeUses?.length ? equipmentChargeUses : [undefined]
        for (const chargeUse of actionChargeUses) {
          const actionId = [
            ownerKind,
            ownerId,
            ...(chargeUse ? [chargeUse.itemInstanceId] : []),
            mechanic.effectId
          ].join(':')
          const itemState = chargeUse ? inventoryStateById.get(chargeUse.itemInstanceId) : undefined
          const itemLabel = chargeUse
            ? (equipmentChargeSourceLabelsByItemId.get(chargeUse.itemInstanceId) ??
              itemState?.customName ??
              equipmentById.get(chargeUse.equipmentId)?.label ??
              sourceLabel)
            : sourceLabel
          const resourceGrantId = chargeUse
            ? createCharacterResourceOwnerKey({
                kind: 'ITEM_INSTANCE',
                chargeId: chargeUse.chargeId,
                itemInstanceId: chargeUse.itemInstanceId
              })
            : undefined
          actionItems.push({
            id: actionId,
            label: owner.label,
            kind: toSheetActionKind(mechanic),
            sourceLabel: itemLabel,
            description: owner.description ?? undefined,
            rollable: isRollableSheetMechanic(mechanic),
            mechanic,
            ...(chargeUse && resourceGrantId
              ? { resourceGrantId, resourceCost: chargeUse.cost }
              : {})
          })
          if (sourceFeatureId) actionSourceFeatureIds.set(actionId, sourceFeatureId)
        }
      }
    }
  }
  const inventoryItems = character.state.equipment.inventory
    .map((item) => {
      const equipment = equipmentById.get(item.equipmentId)
      const mechanics = itemMechanicsByInstanceId.get(item.id)
      return {
        id: item.id,
        equipmentId: item.equipmentId,
        label: item.customName ?? equipment?.label ?? 'Unknown item',
        equipmentLabel: equipment?.label,
        description: equipment?.description,
        category: equipment?.category,
        properties: equipment?.properties.map((code) => ({
          code,
          label: EQUIPMENT_PROPERTY_REGISTRY[code].label
        })),
        rarityId: equipment?.rarityId,
        cost:
          equipment?.cost && mechanics?.cost !== undefined
            ? { ...equipment.cost, amount: mechanics.cost }
            : equipment?.cost,
        costLabel: equipment?.cost ? currencyLabels.get(equipment.cost.currencyId) : undefined,
        weight: mechanics?.weight ?? equipment?.weight,
        armorClass: equipment?.armorClass,
        customName: item.customName,
        quantity: item.quantity,
        equipped: character.state.equipment.equipped.includes(item.id),
        attuned: character.state.equipment.attuned.includes(item.id),
        requiresAttunement: equipment?.requiresAttunement ?? false,
        displayAsAttack: mechanics?.displayAsAttack,
        containerId: item.containerId,
        capacity: equipment?.capacity,
        notes: item.notes
      }
    })
    .sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id))
  const currencies = character.state.currency.flatMap((group) =>
    group.currencies.map((currency) => ({
      currencyId: currency.currencyId,
      label: currencyLabels.get(currency.currencyId) ?? 'Currency',
      amount: currency.amount,
      containerId: group.containerId
    }))
  )
  const noteGroups = getNoteGroups(character)
  const noteItems: NonNullable<CharacterSheetResponseDto['notes']['items']> = (
    character.state.notes ?? []
  ).map((note) => ({ ...note, pinned: note.pinned ?? false }))
  const authoredResourceItems: CharacterSheetResponseDto['resources']['items'] =
    resolution.grants.resources.flatMap((resource) => {
      const grantRecord = findResourceGrantRecord(character, resource)
      const resourceGrantId = grantRecord?.id ?? resource.id
      const config = getResourceSheetConfig({
        character,
        proficiencyBonus,
        resolution,
        resource,
        resourceDefinitionId: grantRecord?.resourceId,
        resolvedRecovery: resourceRecoveryByDefinitionId.get(
          grantRecord?.resourceId ?? resource.id
        ),
        totalLevel
      })
      if (!config) return []
      const owner: CharacterResourceOwnerRef = {
        kind: 'AUTHORED_GRANT',
        resourceGrantId,
        source: resourceGrantSourceRef(grantRecord?.source ?? resource.source, character.systemId)
      }
      const max = config.max
      const used = Math.min(
        resourceUsage.get(createCharacterResourceOwnerKey(toCharacterResourceOwnerKey(owner))) ?? 0,
        max
      )
      return [
        {
          id: createCharacterResourceOwnerKey(toCharacterResourceOwnerKey(owner)),
          owner,
          label: resource.label,
          description: resource.description,
          sourceLabel: resource.sourceLabel,
          sourceFeatureId: resourceFeatureByDefinitionId.get(
            grantRecord?.resourceId ?? resource.id
          ),
          used,
          max,
          remaining: Math.max(max - used, 0),
          recoveries: config.recoveries
        }
      ]
    })
  const itemResourceItems: CharacterSheetResponseDto['resources']['items'] = inventoryItems.flatMap(
    (item) => {
      const charge = equipmentById.get(item.equipmentId)?.charges
      if (!charge) return []
      const owner: CharacterResourceOwnerRef = {
        kind: 'ITEM_INSTANCE',
        chargeId: charge.id,
        itemInstanceId: item.id
      }
      const max = resolveCompiledChargeMaximum(charge, {
        abilities: resolution.summary.abilities,
        classLevels: Object.fromEntries(
          character.intent.classes.map((entry) => [entry.classId, entry.classLevel])
        ),
        proficiencyBonus,
        sourceClassLevel: totalLevel,
        totalLevel
      })
      const used = Math.min(
        resourceUsage.get(createCharacterResourceOwnerKey(toCharacterResourceOwnerKey(owner))) ?? 0,
        max
      )
      return [
        {
          id: createCharacterResourceOwnerKey(toCharacterResourceOwnerKey(owner)),
          owner,
          label: `${equipmentChargeSourceLabelsByItemId.get(item.id) ?? item.label} charges`,
          description: item.description ?? undefined,
          sourceLabel: equipmentChargeSourceLabelsByItemId.get(item.id) ?? item.label,
          used,
          max,
          remaining: Math.max(max - used, 0),
          recoveries: [getResourceRecovery(charge.resetKind)]
        }
      ]
    }
  )
  const companionResourceItems: CharacterSheetResponseDto['resources']['items'] = (
    character.state.creatures ?? []
  ).flatMap((instance) => {
    const creature = creaturesById.get(instance.creatureId)
    if (!creature) return []
    return (creature.features ?? []).flatMap((feature) => {
      if (!feature.charges || feature.charges.limitKind === 'SOURCE_CHARGES') return []
      const charge = compileCharge(feature.charges)
      const owner: CharacterResourceOwnerRef = {
        kind: 'COMPANION_FEATURE',
        companionInstanceId: instance.id,
        featureId: feature.id,
        chargeId: charge.id
      }
      const max = resolveCompiledChargeMaximum(charge, {
        abilities: resolution.summary.abilities,
        classLevels: Object.fromEntries(
          character.intent.classes.map((entry) => [entry.classId, entry.classLevel])
        ),
        proficiencyBonus,
        sourceClassLevel: totalLevel,
        totalLevel
      })
      const used = Math.min(
        resourceUsage.get(createCharacterResourceOwnerKey(toCharacterResourceOwnerKey(owner))) ?? 0,
        max
      )
      return [
        {
          id: createCharacterResourceOwnerKey(toCharacterResourceOwnerKey(owner)),
          owner,
          label: feature.label,
          description: feature.description || undefined,
          sourceLabel: creature.label,
          used,
          max,
          remaining: Math.max(max - used, 0),
          recoveries: [getResourceRecovery(charge.resetKind)]
        }
      ]
    })
  })
  const spellResourceItems: CharacterSheetResponseDto['resources']['items'] =
    engineOutput.spellAccess.flatMap((access) => {
      if (!access.charges || access.charges.limitKind === 'SOURCE_CHARGES') return []
      const source = {
        spellId: access.spellId,
        sourceKind: 'FEATURE' as const,
        sourceInstanceId: access.sourceInstanceId
      }
      const owner: CharacterResourceOwnerRef = {
        kind: 'SPELL_SOURCE',
        resourceGrantId: access.id,
        source
      }
      const max = resolveCompiledChargeMaximum(access.charges, {
        abilities: resolution.summary.abilities,
        classLevels: Object.fromEntries(
          character.intent.classes.map((entry) => [entry.classId, entry.classLevel])
        ),
        proficiencyBonus,
        sourceClassLevel:
          access.timing.kind === 'CLASS_LEVEL' ? access.timing.classLevel : access.timing.level,
        totalLevel
      })
      const used = Math.min(
        resourceUsage.get(createCharacterResourceOwnerKey(toCharacterResourceOwnerKey(owner))) ?? 0,
        max
      )
      const spell = resolution.catalog.spells.find((candidate) => candidate.id === access.spellId)
      return [
        {
          id: createCharacterResourceOwnerKey(toCharacterResourceOwnerKey(owner)),
          owner,
          label: `${spell?.label ?? 'Spell'} uses`,
          sourceLabel: featureLabels.get(access.sourceFeatureId) ?? 'Feature',
          sourceFeatureId: access.sourceFeatureId,
          used,
          max,
          remaining: Math.max(max - used, 0),
          recoveries: [getResourceRecovery(access.charges.resetKind)]
        }
      ]
    })
  const sheetSpells: CharacterSheetResponseDto['spells']['spells'] = resolution.catalog.spells
    .filter((spell) => displayedSpellIds.has(spell.id))
    .map((spell) => {
      const sources = (spellSourcesBySpellId.get(spell.id) ?? []).map((source) => {
        const sourceKey = createCharacterSpellSourceKey(source.source)
        const customization = spellCustomizationsBySourceKey.get(sourceKey)
        return {
          ...source,
          ...(source.resourceGrantId
            ? {
                resourceOwner: {
                  kind: 'SPELL_SOURCE' as const,
                  resourceGrantId: source.resourceGrantId,
                  source: source.source
                }
              }
            : {}),
          ...(customization?.customName ? { customName: customization.customName } : {}),
          ...(customization?.notes ? { notes: customization.notes } : {}),
          ...(customization?.displayAsAttack ? { displayAsAttack: true } : {})
        }
      })
      return {
        id: spell.id,
        label: spell.label,
        description: spell.description,
        level: spell.level,
        school: spell.magicSchoolId,
        castingTime: spell.castingTime,
        components: spell.components,
        attributes: spell.attributes,
        materialDescription: spell.materialDescription,
        prepared: prepared.has(spell.id),
        known: learned.has(spell.id),
        sourceLabel: sources.length ? sources.map((source) => source.label).join(', ') : undefined,
        sources: sources.length ? sources : undefined,
        mechanics: projectedMechanics.SPELL.has(spell.id)
          ? [...(projectedMechanics.SPELL.get(spell.id) ?? [])]
          : undefined
      }
    })
  const sheetSpellSlots: CharacterSheetResponseDto['spells']['slots'] = spellSlots.map((slot) => ({
    ...slot,
    level: slot.level ?? parseSlotLevel(slot.slotKey)
  }))
  const sheetResources = [
    ...authoredResourceItems,
    ...itemResourceItems,
    ...companionResourceItems,
    ...spellResourceItems
  ]
  const actionIdsByFeatureId = new Map<string, string[]>()
  for (const [actionId, featureId] of actionSourceFeatureIds) {
    const actionIds = actionIdsByFeatureId.get(featureId) ?? []
    actionIds.push(actionId)
    actionIdsByFeatureId.set(featureId, actionIds)
  }
  const resourceIdsByFeatureId = new Map<string, string[]>()
  for (const resource of authoredResourceItems) {
    if (!resource.sourceFeatureId) continue
    const resourceIds = resourceIdsByFeatureId.get(resource.sourceFeatureId) ?? []
    resourceIds.push(resource.id)
    resourceIdsByFeatureId.set(resource.sourceFeatureId, resourceIds)
  }
  const visibleActionItems = actionItems.map((action) => {
    const sourceFeatureId = actionSourceFeatureIds.get(action.id)
    const featureActionIds = sourceFeatureId ? actionIdsByFeatureId.get(sourceFeatureId) : undefined
    const featureResourceIds = sourceFeatureId
      ? resourceIdsByFeatureId.get(sourceFeatureId)
      : undefined
    const resourceGrantId =
      featureActionIds?.length === 1 && featureResourceIds?.length === 1
        ? featureResourceIds[0]
        : undefined

    return resourceGrantId ? { ...action, resourceGrantId } : action
  })
  const activeSpellGroups = buildActiveSpellGroups({
    spells: sheetSpells,
    slots: sheetSpellSlots,
    resources: sheetResources,
    spellMechanics: engineOutput.spellMechanics
  })
  const displayedProficiencyKeys = new Set<string>()

  return {
    meta: {
      characterId: character.id,
      viewer: 'CHARACTER_OWNER',
      capabilities: {
        managePlayState: true,
        managePrivateNotes: true,
        manageInventory: true,
        openBuilder: true
      },
      systemId: character.systemId,
      status: character.status ?? AUTHORED_RECORD_STATUS.ACTIVE,
      streamVersion: params.streamVersion,
      hasBuilderDraft: params.hasBuilderDraft
    },
    identity: {
      label: character.label || 'Untitled Character',
      description: character.description,
      concept: character.profile.backstory,
      classSummary: formatClassSummary(resolution),
      raceLabel:
        resolution.summary.selectedRace?.subraceLabel ?? resolution.summary.selectedRace?.raceLabel,
      backgroundLabel: resolution.summary.selectedBackground?.label,
      totalLevel
    },
    overview: {
      abilities: Object.keys(resolution.summary.abilities).map((ability) => {
        const abilityCode = ability as keyof typeof resolution.summary.abilities
        return {
          ability: abilityCode,
          score: getAbilityDerivedTotal(engineOutput.derivedStats.abilityScores, abilityCode),
          modifier: getAbilityDerivedTotal(engineOutput.derivedStats.abilityModifiers, abilityCode),
          rollMode: engineOutput.rollModes.abilityChecks[abilityCode]
        }
      }),
      savingThrows: Object.keys(ABILITIES)
        .filter((ability): ability is keyof typeof ABILITIES => isAbilityCode(ability))
        .map((ability) => ({
          ability,
          label: ABILITIES[ability].label,
          total: getAbilityDerivedTotal(engineOutput.derivedStats.savingThrows, ability),
          rollMode: engineOutput.rollModes.savingThrows[ability],
          proficiency:
            engineOutput.calculations.savingThrowProficiencyLevels[ability]?.effective ??
            engineOutput.calculations.savingThrowProficiencyLevels[
              ENGINE_ABILITY_ALIASES[ability] ?? ''
            ]?.effective ??
            'NONE'
        })),
      skills: overviewSkills,
      facts: [
        { label: 'Initiative', value: formatModifier(engineOutput.derivedStats.initiative) },
        { label: 'Proficiency', value: formatModifier(proficiencyBonus) },
        {
          label: 'Hit Dice',
          value:
            character.state.hitpoints.hitDice
              .map((die) => `${die.total - die.used}/${die.total}d${die.die}`)
              .join(', ') || 'None'
        },
        ...passiveFacts
      ],
      armorClass: engineOutput.derivedStats.armorClass,
      initiative: engineOutput.derivedStats.initiative,
      initiativeRollMode: engineOutput.rollModes.initiative,
      proficiencyBonus,
      inspiration: character.state.inspiration ?? false,
      currentHitPoints: clampCharacterCurrentHitPoints(
        character.state.hitpoints.current,
        maxHitPoints
      ),
      maxHitPoints,
      tempHitPoints: character.state.hitpoints.temp ?? 0,
      maxHitPointsOverride: getHitPointAdjustment(adjustments, 'MAXIMUM_OVERRIDE') ?? null,
      maxHitPointsModifier: getHitPointAdjustment(adjustments, 'MAXIMUM_MODIFIER') ?? 0,
      maxHitPointsModifierAdjustmentId:
        adjustments.find(
          (adjustment) =>
            adjustment.family === 'HIT_POINTS' && adjustment.field === 'MAXIMUM_MODIFIER'
        )?.id ?? null,
      exhaustion: {
        label: rulesSystem.exhaustion.label,
        description: rulesSystem.exhaustion.description,
        level: character.state.exhaustion?.level ?? rulesSystem.exhaustion.minimumLevel,
        minimumLevel: rulesSystem.exhaustion.minimumLevel,
        maximumLevel: rulesSystem.exhaustion.maximumLevel,
        ...(character.state.exhaustion?.notes ? { notes: character.state.exhaustion.notes } : {})
      },
      conditions: [
        ...(character.state.conditions ?? []),
        ...(params.additionalConditions ?? [])
      ].map((condition) => ({
        conditionTypeId: condition.conditionTypeId,
        label: conditionsById.get(condition.conditionTypeId)?.label ?? 'Unknown condition',
        description: conditionsById.get(condition.conditionTypeId)?.description,
        notes: condition.notes
      })),
      hitDice: character.state.hitpoints.hitDice.map((die) => ({
        die: die.die,
        total: die.total,
        used: die.used,
        remaining: Math.max(die.total - die.used, 0)
      }))
    },
    actions: {
      items: visibleActionItems
    },
    extras: sheetExtras,
    resources: {
      items: sheetResources,
      hitDice: character.state.hitpoints.hitDice.map((die) => ({
        die: die.die,
        total: die.total,
        used: die.used,
        remaining: Math.max(die.total - die.used, 0)
      }))
    },
    spells: {
      saveDc: engineOutput.derivedStats.spellSaveDC ?? null,
      attackBonus: engineOutput.derivedStats.spellAttackBonus ?? null,
      attackRollMode: engineOutput.rollModes.attacks.SPELL,
      slots: sheetSpellSlots,
      activeGroups: activeSpellGroups,
      spells: sheetSpells,
      preparationSources: spellPreparationSources.length ? spellPreparationSources : undefined
    },
    inventory: {
      items: inventoryItems,
      currencies,
      containers: inventoryItems
        .filter((item) => item.capacity)
        .map((container) => ({
          id: container.id,
          label: container.label,
          capacity: container.capacity,
          itemIds: inventoryItems
            .filter((item) => item.containerId === container.id)
            .map((item) => item.id),
          currencies: currencies.filter((currency) => currency.containerId === container.id)
        }))
    },
    reference: {
      features: [...sheetReferenceFeatures, ...equipmentReferenceFeatures],
      proficiencies: engineOutput.proficiencies.reduce<
        CharacterSheetResponseDto['reference']['proficiencies']
      >((proficiencies, proficiency) => {
        const kind = getProficiencyTargetKind(proficiency, resolution)
        const label = formatProficiencyLabel({
          equipmentLabels,
          languageLabels,
          proficiency,
          skillLabels
        })
        if (!kind) return proficiencies
        const key = `${kind}:${proficiency.subjectId}`
        if (displayedProficiencyKeys.has(key)) return proficiencies
        displayedProficiencyKeys.add(key)
        proficiencies.push({
          kind,
          label,
          value: `${formatProficiencyKind(proficiency.kind)} · ${formatProficiencyScaling(proficiency.scaling)}`
        })
        return proficiencies
      }, []),
      defenses: engineOutput.defenses.map((defense) => ({
        kind: defense.kind,
        damageTypeId: defense.damageTypeId,
        label: damageTypeLabels.get(defense.damageTypeId) ?? formatCodeLabel(defense.damageTypeId),
        value: formatCodeLabel(defense.kind)
      })),
      senses: engineOutput.senses.map((sense) => ({
        senseId: sense.senseCode,
        label: senseLabels.get(sense.senseCode) ?? 'Unknown sense',
        value: formatSenseRange(sense),
        range: sense.range
      })),
      conditionOptions,
      equipmentOptions: resolution.catalog.equipment.map((equipment) => ({
        id: equipment.id,
        label: equipment.label,
        isContainer: equipment.isContainer,
        ...(equipment.maxStack ? { maxStack: equipment.maxStack } : {}),
        requiresAttunement: equipment.requiresAttunement
      })),
      currencyOptions
    },
    notes: {
      alignment: character.profile.alignmentId,
      lifestyle: character.profile.lifestyleId,
      faith: character.profile.faith,
      gender: character.profile.gender,
      age: character.profile.age,
      appearance:
        [
          character.profile.height,
          character.profile.weight,
          character.profile.eyes,
          character.profile.hair,
          character.profile.skin,
          character.profile.physicalCharacteristics
        ]
          .filter(Boolean)
          .join(', ') || undefined,
      personalityTraits: character.profile.personalityTraits,
      ideals: character.profile.ideals,
      bonds: character.profile.bonds,
      flaws: character.profile.flaws,
      organizations: character.profile.organizations,
      allies: character.profile.allies,
      enemies: character.profile.enemies,
      backstory: character.profile.backstory,
      notes: character.profile.notes,
      groups: noteGroups,
      items: noteItems
    }
  }
}
