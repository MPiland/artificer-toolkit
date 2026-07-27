import {
  ConcurrencyError,
  createCharacterEventRepository,
  createCharacterRepository,
  createCharacterSheetAdjustmentRepository,
  createCharacterSheetPlayStateRepository,
  createEquipmentRepository,
  getCharacterSheetMechanicsQuery,
  type CharacterSheetStatePatch,
  type CharacterSpellCustomization,
  type DBLike
} from '@artificer-toolkit/db'
import {
  ABILITIES,
  AUTHORED_RECORD_STATUS,
  CLASS_CATEGORY,
  EQUIPMENT_PROPERTY_REGISTRY,
  FEATURE_ATTRIBUTE,
  PREPARE_LIMIT_METHOD_KIND,
  ROUNDING_CODE,
  SCALING_AMOUNT_KIND,
  SPELLCASTING_ATTRIBUTE,
  resolveRulesSystem,
  runEngine,
  type CharacterBuildSnapshot,
  type EngineCharacterOutput,
  type CharacterMechanicSourceRef,
  type EngineProficiency,
  type EngineResource,
  type EngineSense,
  type EngineSpellSlots,
  type CharacterEvent
} from '@artificer-toolkit/shared/core'
import {
  createCharacterDefinitionSourceInstanceId,
  createCharacterResourceOwnerKey,
  createCharacterSpellSourceKey,
  toCharacterMechanicalAdjustment,
  toCharacterResourceOwnerKey,
  type CharacterMovementDisplayPreference,
  type CharacterResourceOwnerRef,
  type CharacterResourceUsage,
  type CharacterSheetAdjustment
} from '@artificer-toolkit/shared/character'
import { createHash } from 'node:crypto'

import { compileCharge, resolveCompiledChargeMaximum } from '@artificer-toolkit/shared/compilers'
import { SKILL_ABILITY_MAP } from '@artificer-toolkit/shared/engine/resolution'
import type {
  CharacterAuthored,
  CharacterProvenance
} from '@artificer-toolkit/shared/subjects/authored'
import { getCharacterProvenanceIdentityKey } from '@artificer-toolkit/shared/subjects/authored'
import type {
  CharacterHistoryEntryDto,
  CharacterSheetCommandInputDto,
  CharacterSheetCommandResponseDto,
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characters'
import type {
  CharacterSheetCoreAdjustmentCommandDto,
  CharacterSheetItemAdjustmentCommandDto
} from '@artificer-toolkit/schema/api/characterSheet'
import type { CharacterSheetPanelTargetDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import { resolveCharacterBuilder, type CharacterBuilderResolution } from './builderService.js'
import {
  createCharacterAssemblyRegistry,
  createCharacterEngineFeatures
} from './characterEngine.js'
import {
  projectCharacterSheetMechanics,
  type CharacterSheetProjectedMechanic
} from './sheetMechanicsProjector.js'
import {
  characterSheetAdjustmentMatchesPanelTarget,
  getCharacterSheetPanelAdjustmentIds
} from './sheetPanelTarget.js'
import { getProficiencyTargetKind } from './sheetProficiency.js'

type CharacterSheetStateCommand = CharacterSheetCommandInputDto extends infer Command
  ? Command extends CharacterSheetCommandInputDto
    ? Omit<Command, 'commandId'>
    : never
  : never

export class CharacterSheetCommandError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CharacterSheetCommandError'
  }
}

function createNamedError(name: string, message: string): Error {
  const error = new Error(message)
  error.name = name
  return error
}

function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : String(value)
}

function formatCodeLabel(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

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

function isAbilityCode(value: string): value is keyof typeof ABILITIES {
  return value in ABILITIES
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

const ABILITY_CANONICAL_BY_ALIAS = (() => {
  const map = new Map<string, string>()
  for (const abilityCode of Object.keys(ABILITIES)) {
    map.set(abilityCode, abilityCode)
    const short = ABILITIES[abilityCode as keyof typeof ABILITIES].short
    if (short) map.set(short, abilityCode)
  }
  return map
})()

type SkillReference = {
  canonicalBySubject: Map<string, string>
  metadataByCanonical: Map<
    string,
    {
      skillId: string
      code: string
      label: string
      ability: keyof typeof ABILITIES
    }
  >
}

type OverviewSkillRow = CharacterSheetResponseDto['overview']['skills'][number]
type CharacterBuilderGrantFeature = CharacterBuilderResolution['grants']['features'][number]

const STANDARD_PASSIVE_SKILLS = [
  { code: 'PASSIVE_PERCEPTION', label: 'Passive Perception', skillCode: 'PERCEPTION' },
  { code: 'PASSIVE_INVESTIGATION', label: 'Passive Investigation', skillCode: 'INVESTIGATION' },
  { code: 'PASSIVE_INSIGHT', label: 'Passive Insight', skillCode: 'INSIGHT' }
] as const

function toSkillCanonicalCode(value: string | undefined): string {
  if (!value) return ''
  return value.toLowerCase().trim().replace(/_/g, '-').replace(/\s+/g, '-')
}

function toSkillFallbackCode(slug: string): string {
  return slug.toUpperCase().replace(/-/g, '_')
}

function toSkillFallbackLabel(slug: string): string {
  return slug
    .split('-')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function resolveAbilityCode(subjectId: string): keyof typeof ABILITIES | undefined {
  const direct = ABILITY_CANONICAL_BY_ALIAS.get(subjectId)
  if (direct && isAbilityCode(direct)) return direct

  const upper = ABILITY_CANONICAL_BY_ALIAS.get(subjectId.toUpperCase())
  return upper && isAbilityCode(upper) ? upper : undefined
}

function createSkillReference(
  systemSkills: ReadonlyArray<{ id: string; code?: string; label: string }> | undefined
): SkillReference {
  const canonicalBySubject = new Map<string, string>()
  const metadataByCanonical = new Map<
    string,
    {
      skillId: string
      code: string
      label: string
      ability: keyof typeof ABILITIES
    }
  >()

  for (const [skillId, ability] of Object.entries(SKILL_ABILITY_MAP)) {
    const abilityCode = resolveAbilityCode(ability)
    if (!abilityCode) continue
    metadataByCanonical.set(skillId, {
      skillId,
      code: toSkillFallbackCode(skillId),
      label: toSkillFallbackLabel(skillId),
      ability: abilityCode
    })
    canonicalBySubject.set(skillId, skillId)
    canonicalBySubject.set(skillId.toUpperCase(), skillId)
  }

  for (const skill of systemSkills ?? []) {
    const canonicalFromCode = SKILL_ABILITY_MAP[toSkillCanonicalCode(skill.code)]
      ? toSkillCanonicalCode(skill.code)
      : undefined
    const canonicalFromId = SKILL_ABILITY_MAP[toSkillCanonicalCode(skill.id)]
      ? toSkillCanonicalCode(skill.id)
      : undefined
    const canonical = canonicalFromCode ?? canonicalFromId
    if (!canonical) continue

    canonicalBySubject.set(skill.id, canonical)
    if (skill.code) canonicalBySubject.set(skill.code, canonical)
    if (skill.code) canonicalBySubject.set(skill.code.toUpperCase(), canonical)
    if (skill.code) canonicalBySubject.set(toSkillCanonicalCode(skill.code), canonical)

    const existing = metadataByCanonical.get(canonical)
    const ability = resolveAbilityCode(
      SKILL_ABILITY_MAP[canonical] ??
        SKILL_ABILITY_MAP[toSkillCanonicalCode(skill.id)] ??
        'DEXTERITY'
    )
    if (existing) {
      metadataByCanonical.set(canonical, {
        ...existing,
        code: skill.code ?? existing.code,
        label: skill.label,
        ability: ability ?? existing.ability
      })
    } else {
      metadataByCanonical.set(canonical, {
        skillId: skill.id,
        code: skill.code ?? toSkillFallbackCode(canonical),
        label: skill.label,
        ability: ability ?? 'DEXTERITY'
      })
    }
  }

  return { canonicalBySubject, metadataByCanonical }
}

export function resolveCharacterSheetSkillKey(
  systemSkills: ReadonlyArray<{ id: string; code?: string; label: string }> | undefined,
  skillId: string
): string {
  return createSkillReference(systemSkills).canonicalBySubject.get(skillId) ?? skillId
}

const ENGINE_ABILITY_ALIASES: Readonly<Record<string, string>> = {
  STRENGTH: 'STR',
  DEXTERITY: 'DEX',
  CONSTITUTION: 'CON',
  INTELLIGENCE: 'INT',
  WISDOM: 'WIS',
  CHARISMA: 'CHA'
}

function getAbilityDerivedTotal(
  values: Readonly<Record<string, number>>,
  ability: keyof typeof ABILITIES
): number {
  const alias = ENGINE_ABILITY_ALIASES[ability]
  return values[ability] ?? (alias ? values[alias] : undefined) ?? 0
}

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

function getCalculatedMaxHitPoints(character: CharacterAuthored): number {
  return character.intent.hitpoints.levels.reduce((total, level) => total + level.value, 0)
}

function getHitPointAdjustment(
  adjustments: readonly CharacterSheetAdjustment[],
  field: 'MAXIMUM_MODIFIER' | 'MAXIMUM_OVERRIDE'
): number | undefined {
  const adjustment = adjustments.find(
    (candidate) => candidate.family === 'HIT_POINTS' && candidate.field === field
  )
  return adjustment?.family === 'HIT_POINTS' ? adjustment.value : undefined
}

function getMaxHitPoints(
  character: CharacterAuthored,
  adjustments: readonly CharacterSheetAdjustment[] = []
): number {
  const calculated = getCalculatedMaxHitPoints(character)
  const base = calculated > 0 ? calculated : character.state.hitpoints.current
  const adjusted = Math.max(base + (getHitPointAdjustment(adjustments, 'MAXIMUM_MODIFIER') ?? 0), 0)
  return getHitPointAdjustment(adjustments, 'MAXIMUM_OVERRIDE') ?? adjusted
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

function getSpellSlotKey(level: number): string {
  return `STANDARD:${level}`
}

function parseSlotLevel(slotKey: string): number | null {
  const [, level] = slotKey.split(':')
  return level ? Number(level) : null
}

type EngineEquipmentItem = CharacterBuildSnapshot['equipmentItems'][number]
type EngineCompiledEquipment = EngineEquipmentItem['compiledItem']
type EngineEquippedState = NonNullable<EngineEquipmentItem['equippedState']>

function addEngineAbilityScore(
  abilities: Record<string, number>,
  ability: string,
  score: number
): void {
  abilities[ability] = score
  const alias = ENGINE_ABILITY_ALIASES[ability]
  if (alias) abilities[alias] = score
}

function getEngineEquippedState(compiledItem: EngineCompiledEquipment): EngineEquippedState {
  if (compiledItem.category === 'VARIANT') return { slot: 'GENERIC' }

  switch (compiledItem.category) {
    case 'ARMOR':
      return { slot: 'ARMOR' }
    case 'SHIELD':
      return { slot: 'SHIELD' }
    default:
      return { slot: 'GENERIC' }
  }
}

function createEngineHitpointEntries(
  character: CharacterAuthored
): CharacterBuildSnapshot['hitpoints'] {
  return [...character.intent.hitpoints.levels]
    .sort((left, right) => left.level - right.level)
    .map((entry) => ({
      classId: entry.classId,
      classLevel: entry.classLevel,
      value: entry.value
    }))
}

type ClassSpellSelectionSource = {
  sourceKind: 'CLASS' | 'SUBCLASS'
  sourceRecordId: string
}

function classSpellSelectionKey(classId: string, spellId: string): string {
  return `${classId}:${spellId}`
}

function getClassSpellSelectionSources(
  character: CharacterAuthored
): ReadonlyMap<string, ClassSpellSelectionSource> {
  const sources = new Map<string, ClassSpellSelectionSource>()

  for (const selection of character.intent.spellSelections ?? []) {
    if (selection.source.kind !== 'CLASS' && selection.source.kind !== 'SUBCLASS') continue
    const source = selection.source
    const classId =
      source.kind === 'CLASS'
        ? source.classId
        : character.intent.classes.find((entry) => entry.subclassId === source.subclassId)?.classId
    if (!classId) continue

    for (const spellId of selection.spells) {
      const key = classSpellSelectionKey(classId, spellId)
      if (sources.has(key)) continue
      sources.set(key, {
        sourceKind: source.kind,
        sourceRecordId: selection.id
      })
    }
  }

  return sources
}

function createEngineSpellSources(
  character: CharacterAuthored
): NonNullable<CharacterBuildSnapshot['spellSources']> {
  const sources = new Map<string, NonNullable<CharacterBuildSnapshot['spellSources']>[number]>()
  const classSelectionSources = getClassSpellSelectionSources(character)
  const add = (
    spellId: string,
    sourceKind:
      | 'BACKGROUND'
      | 'CLASS'
      | 'FEAT'
      | 'FEATURE'
      | 'ITEM'
      | 'OPTION'
      | 'RACE'
      | 'SUBCLASS',
    sourceRecordId: string
  ) => {
    const source = {
      spellId,
      sourceKind,
      sourceInstanceId: createCharacterDefinitionSourceInstanceId(sourceKind, sourceRecordId)
    }
    sources.set(createCharacterSpellSourceKey(source), source)
  }

  for (const selection of character.intent.spellSelections ?? []) {
    for (const spellId of selection.spells) add(spellId, selection.source.kind, selection.id)
  }
  for (const classState of character.state.classes ?? []) {
    for (const spellId of [
      ...(classState.spells?.learned ?? []),
      ...(classState.spells?.prepared ?? [])
    ]) {
      const selected = classSelectionSources.get(
        classSpellSelectionKey(classState.classId, spellId)
      )
      add(spellId, selected?.sourceKind ?? 'CLASS', selected?.sourceRecordId ?? classState.classId)
    }
  }
  return [...sources.values()]
}

function createCharacterEngineInput(
  character: CharacterAuthored,
  resolution: CharacterBuilderResolution,
  adjustments: readonly CharacterSheetAdjustment[] = [],
  movementDisplayPreference: CharacterMovementDisplayPreference = { mode: 'AUTO' }
): {
  registry: ReturnType<typeof createCharacterAssemblyRegistry>
  snapshot: CharacterBuildSnapshot
} {
  const registry = createCharacterAssemblyRegistry(resolution.registry)
  const abilities: Record<string, number> = {}
  for (const [ability, score] of Object.entries(resolution.summary.abilities)) {
    if (typeof score === 'number') addEngineAbilityScore(abilities, ability, score)
  }

  const equippedIds = new Set(character.state.equipment.equipped)
  const attunedIds = new Set(character.state.equipment.attuned)
  const equipmentItems: CharacterBuildSnapshot['equipmentItems'] = []
  for (const item of character.state.equipment.inventory) {
    const compiledItem = registry.equipment[item.equipmentId]
    if (!compiledItem) continue

    const equippedState = equippedIds.has(item.id)
      ? getEngineEquippedState(compiledItem)
      : undefined
    equipmentItems.push({
      instanceId: item.id,
      contentRef: {
        definitionId: item.equipmentId,
        binding: { kind: 'ACTIVE' },
        systemId: character.systemId
      },
      ...(equippedState ? { equippedState } : {}),
      attuned: attunedIds.has(item.id),
      compiledItem
    })
  }

  return {
    registry,
    snapshot: {
      characterId: character.id,
      systemId: character.systemId,
      totalLevel: resolution.summary.totalLevel,
      raceId: character.intent.race.raceId,
      subraceId: character.intent.race.subraceId,
      backgroundId: character.intent.background.backgroundId,
      chosenGrantSelections: character.intent.chosenGrantSelections ?? [],
      classes: character.intent.classes.map((classIntent) => ({
        classId: classIntent.classId,
        level: classIntent.classLevel,
        subclassId: classIntent.subclassId,
        specializationId: classIntent.specializationId
      })),
      abilities,
      hitpoints: createEngineHitpointEntries(character),
      features: createCharacterEngineFeatures(character, resolution),
      equipmentItems,
      spellSources: createEngineSpellSources(character),
      adjustments: adjustments.map(toCharacterMechanicalAdjustment),
      movementDisplayPreference
    }
  }
}

export function resolveCharacterSheetEngine(params: {
  character: CharacterAuthored
  resolution: CharacterBuilderResolution
  adjustments?: readonly CharacterSheetAdjustment[]
  movementDisplayPreference?: CharacterMovementDisplayPreference
}): EngineCharacterOutput {
  const engineInput = createCharacterEngineInput(
    params.character,
    params.resolution,
    params.adjustments,
    params.movementDisplayPreference
  )
  const rulesSystem = resolveRulesSystem({
    code: params.resolution.registry.system?.rulesetCode ?? '',
    version: params.resolution.registry.system?.rulesetVersion ?? ''
  })
  return runEngine(engineInput.snapshot, engineInput.registry, rulesSystem)
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
    for (const spellId of classState.spells?.learned ?? []) learned.add(spellId)
    for (const spellId of classState.spells?.prepared ?? []) prepared.add(spellId)
  }

  for (const selection of character.intent.spellSelections ?? []) {
    for (const spellId of selection.spells) learned.add(spellId)
  }

  return { learned, prepared }
}

function getKnownSpellIdsForClassIntent(
  character: CharacterAuthored,
  classId: string
): Set<string> {
  const known = new Set<string>()
  const classIntent = character.intent.classes.find((row) => row.classId === classId)
  const classState = character.state.classes?.find((row) => row.classId === classId)
  for (const spellId of classState?.spells?.learned ?? []) known.add(spellId)

  for (const selection of character.intent.spellSelections ?? []) {
    if (selection.source.kind === 'CLASS' && selection.source.classId === classId) {
      for (const spellId of selection.spells) known.add(spellId)
    }

    if (
      selection.source.kind === 'SUBCLASS' &&
      classIntent?.subclassId === selection.source.subclassId
    ) {
      for (const spellId of selection.spells) known.add(spellId)
    }
  }

  return known
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
  castMode?: 'SPELL_SLOT' | 'AT_WILL' | 'FIXED_LEVEL' | 'LIMITED_USE'
  fixedLevel?: number
  resourceGrantId?: string
  resourceOwner?: CharacterResourceOwnerRef
}

const DEFAULT_NOTE_GROUPS = [
  { id: 'session-notes', label: 'Session Notes', sortOrder: 0, kind: 'SESSION' as const },
  { id: 'loot', label: 'Loot', sortOrder: 1, kind: 'LOOT' as const },
  { id: 'characters', label: 'Characters', sortOrder: 2, kind: 'CHARACTERS' as const },
  { id: 'places', label: 'Places', sortOrder: 3, kind: 'PLACES' as const }
]

function getNoteGroups(character: CharacterAuthored) {
  const persistedGroups = character.state.noteGroups ?? []
  const builtInByKind = new Map(
    persistedGroups
      .filter(
        (group) =>
          group.kind !== 'CUSTOM' && !DEFAULT_NOTE_GROUPS.some((builtIn) => builtIn.id === group.id)
      )
      .map((group) => [group.kind, group])
  )

  return DEFAULT_NOTE_GROUPS.map((group) => builtInByKind.get(group.kind) ?? group)
    .concat(persistedGroups.filter((group) => group.kind === 'CUSTOM'))
    .sort(
      (left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label)
    )
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
    const classSpellIds = getKnownSpellIdsForClassIntent(character, classIntent.classId)
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

type SheetSpell = CharacterSheetResponseDto['spells']['spells'][number]
type SheetSpellSource = NonNullable<SheetSpell['sources']>[number]
type SheetSpellSlot = CharacterSheetResponseDto['spells']['slots'][number]
type SheetResource = CharacterSheetResponseDto['resources']['items'][number]

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
  if (params.spell.level === 0 || castMode === 'AT_WILL') return { available: true }

  if (castMode === 'LIMITED_USE' || castMode === 'FIXED_LEVEL') {
    if (!params.source.resourceGrantId) {
      return castMode === 'FIXED_LEVEL'
        ? { available: true }
        : { available: false, unavailableReason: 'No linked uses are available.' }
    }
    const resource = params.resources.find(
      (candidate) =>
        candidate.owner.kind === 'SPELL_SOURCE' &&
        candidate.owner.resourceGrantId === params.source.resourceGrantId &&
        createCharacterSpellSourceKey(candidate.owner.source) ===
          createCharacterSpellSourceKey(params.source.source)
    )
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

function getSheetPreparationAvailableSpellIds(
  sheet: CharacterSheetResponseDto,
  classId: string
): Set<string> {
  const availableSpellIds = new Set<string>()
  const preparationSource = sheet.spells.preparationSources?.find(
    (source) => source.classId === classId
  )
  for (const spellId of preparationSource?.preparedSpellIds ?? []) availableSpellIds.add(spellId)

  for (const spell of sheet.spells.spells) {
    if (spell.sources?.some((source) => source.classId === classId && source.canPrepare)) {
      availableSpellIds.add(spell.id)
    }
  }

  return availableSpellIds
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
      totalLevel: params.totalLevel
    }),
    recoveries: [getResourceRecovery(params.resolvedRecovery ?? definition.charges.resetKind)]
  }
}

async function getConditionOptions(
  db: DBLike,
  systemId: string
): Promise<Array<{ id: string; label: string; description?: string }>> {
  const rows = await db
    .selectFrom('condition_types')
    .select(['id', 'label', 'description'])
    .where('system_id', '=', systemId)
    .orderBy('label', 'asc')
    .execute()

  return rows.map((row) => ({
    id: String(row.id),
    label: String(row.label),
    description: row.description ? String(row.description) : undefined
  }))
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
}): Promise<CharacterSheetResponseDto> {
  const { character, resolution } = params
  const adjustments = params.adjustments ?? []
  const spellCustomizations = params.spellCustomizations ?? []
  const totalLevel = Math.max(resolution.summary.totalLevel, 1)
  const engineOutput = resolveCharacterSheetEngine({
    character,
    resolution,
    adjustments,
    movementDisplayPreference: params.movementDisplayPreference
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
  const maxHitPoints = engineOutput.derivedStats.maxHitPoints
  const conditionOptions = await getConditionOptions(params.db, character.systemId)
  const conditionsById = new Map(conditionOptions.map((condition) => [condition.id, condition]))
  const equipmentById = new Map(
    resolution.registry.equipment.map((equipment) => [equipment.id, equipment])
  )
  const equipmentLabels = new Map(
    resolution.registry.equipment.map((equipment) => [equipment.id, equipment.label])
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
        proficiency: engineOutput.calculations.skillProficiencyLevels[skill]?.effective ?? 'NONE'
      }
    })
    .filter((row): row is OverviewSkillRow => row.ability !== undefined)
  const passiveFacts = buildPassiveOverviewFacts({
    passives: resolution.registry.system?.passives,
    passiveChecks: engineOutput.derivedStats.passiveChecks
  })
  const sheetReferenceFeatures = resolution.grants.features.filter(isSheetVisibleFeature)
  const selectedFeatureOptionIds = getSelectedFeatureOptionIds(character)
  const mechanicsQuery = await getCharacterSheetMechanicsQuery(params.db, {
    spellIds: [...displayedSpellIds],
    featureIds: sheetReferenceFeatures.map((feature) => feature.id),
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
        const actionId = `${ownerKind}:${ownerId}:${mechanic.effectId}`
        actionItems.push({
          id: actionId,
          label: owner.label,
          kind: toSheetActionKind(mechanic),
          sourceLabel,
          description: owner.description ?? undefined,
          rollable: isRollableSheetMechanic(mechanic),
          mechanic
        })
        if (sourceFeatureId) actionSourceFeatureIds.set(actionId, sourceFeatureId)
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
          label: `${item.label} charges`,
          description: item.description ?? undefined,
          sourceLabel: item.label,
          used,
          max,
          remaining: Math.max(max - used, 0),
          recoveries: [getResourceRecovery(charge.resetKind)]
        }
      ]
    }
  )
  const spellResourceItems: CharacterSheetResponseDto['resources']['items'] =
    engineOutput.spellAccess.flatMap((access) => {
      if (!access.charges) return []
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
        sourceClassLevel: access.timing.classLevel,
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
  const sheetResources = [...authoredResourceItems, ...itemResourceItems, ...spellResourceItems]
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
          modifier: getAbilityDerivedTotal(engineOutput.derivedStats.abilityModifiers, abilityCode)
        }
      }),
      savingThrows: Object.keys(ABILITIES)
        .filter((ability): ability is keyof typeof ABILITIES => isAbilityCode(ability))
        .map((ability) => ({
          ability,
          label: ABILITIES[ability].label,
          total: getAbilityDerivedTotal(engineOutput.derivedStats.savingThrows, ability),
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
      proficiencyBonus,
      inspiration: character.state.inspiration ?? false,
      currentHitPoints: character.state.hitpoints.current,
      maxHitPoints,
      tempHitPoints: character.state.hitpoints.temp ?? 0,
      maxHitPointsOverride: getHitPointAdjustment(adjustments, 'MAXIMUM_OVERRIDE') ?? null,
      exhaustionLevel: character.state.exhaustion?.level ?? 0,
      exhaustionNotes: character.state.exhaustion?.notes,
      conditions: (character.state.conditions ?? []).map((condition) => ({
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
      features: sheetReferenceFeatures,
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function restoreHitDiceForLongRest(
  hitDice: CharacterAuthored['state']['hitpoints']['hitDice']
): CharacterAuthored['state']['hitpoints']['hitDice'] {
  const totalHitDice = hitDice.reduce((total, die) => total + die.total, 0)
  let remainingRecovery = Math.max(Math.floor(totalHitDice / 2), 1)

  return hitDice.map((die) => {
    const recovered = Math.min(die.used, remainingRecovery)
    remainingRecovery -= recovered

    return {
      ...die,
      used: die.used - recovered
    }
  })
}

function clearEmptyStateArrays(character: CharacterAuthored): CharacterAuthored {
  return {
    ...character,
    state: {
      ...character.state,
      currency: character.state.currency.filter((group) => group.currencies.length > 0),
      conditions: character.state.conditions?.length ? character.state.conditions : undefined,
      resources: character.state.resources?.length ? character.state.resources : undefined,
      spellSlots: character.state.spellSlots?.length ? character.state.spellSlots : undefined,
      classes: character.state.classes?.length ? character.state.classes : undefined
    }
  }
}

function ensureResource(sheet: CharacterSheetResponseDto, resourceGrantId: string) {
  const resource = sheet.resources.items.find((item) => item.id === resourceGrantId)
  if (!resource)
    throw new CharacterSheetCommandError(
      `Resource "${resourceGrantId}" is not available on this character.`
    )
  return resource
}

function ensureSpellSlot(sheet: CharacterSheetResponseDto, slotKey: string) {
  const slot = sheet.spells.slots.find((item) => item.slotKey === slotKey)
  if (!slot)
    throw new CharacterSheetCommandError(
      `Spell slot "${slotKey}" is not available on this character.`
    )
  return slot
}

function ensureInventoryItem(character: CharacterAuthored, itemId: string) {
  const item = character.state.equipment.inventory.find((candidate) => candidate.id === itemId)
  if (!item)
    throw new CharacterSheetCommandError(`Inventory item "${itemId}" is not on this character.`)
  return item
}

function updateResourceUsage(
  character: CharacterAuthored,
  resourceGrantId: string,
  max: number,
  updater: (used: number) => number
): CharacterAuthored {
  const existing = character.state.resources ?? []
  const next = new Map(existing.map((resource) => [resource.resourceGrantId, resource.used]))
  const used = clamp(updater(next.get(resourceGrantId) ?? 0), 0, max)
  next.set(resourceGrantId, used)

  return clearEmptyStateArrays({
    ...character,
    state: {
      ...character.state,
      resources: [...next.entries()]
        .filter(([, amount]) => amount > 0)
        .map(([id, amount]) => ({ resourceGrantId: id, used: amount }))
    }
  })
}

function updateSpellSlotUsage(
  character: CharacterAuthored,
  slotKey: string,
  max: number,
  updater: (used: number) => number
): CharacterAuthored {
  const existing = character.state.spellSlots ?? []
  const next = new Map(existing.map((slot) => [slot.slotKey, slot.used]))
  const used = clamp(updater(next.get(slotKey) ?? 0), 0, max)
  next.set(slotKey, used)

  return clearEmptyStateArrays({
    ...character,
    state: {
      ...character.state,
      spellSlots: [...next.entries()]
        .filter(([, amount]) => amount > 0)
        .map(([key, amount]) => ({ slotKey: key, used: amount }))
    }
  })
}

type CharacterSheetResourceRecoveryTrigger =
  CharacterSheetResponseDto['resources']['items'][number]['recoveries'][number]['trigger']

function restoreResourcesForRecoveries(
  character: CharacterAuthored,
  sheet: CharacterSheetResponseDto,
  triggers: readonly CharacterSheetResourceRecoveryTrigger[]
): CharacterAuthored {
  const recoverySet = new Set(triggers)
  const restorableResourceIds = new Set(
    sheet.resources.items
      .filter((resource) =>
        resource.recoveries.some((recovery) => recoverySet.has(recovery.trigger))
      )
      .map((resource) => resource.id)
  )
  if (restorableResourceIds.size === 0) return character

  return {
    ...character,
    state: {
      ...character.state,
      resources: character.state.resources?.filter(
        (resource) => !restorableResourceIds.has(resource.resourceGrantId)
      )
    }
  }
}

function restoreResourcesForRest(
  character: CharacterAuthored,
  sheet: CharacterSheetResponseDto,
  recovery: CharacterSheetResourceRecoveryTrigger
): CharacterAuthored {
  return restoreResourcesForRecoveries(character, sheet, [recovery])
}

function restorePactSpellSlotsForShortRest(
  character: CharacterAuthored,
  sheet: CharacterSheetResponseDto
): CharacterAuthored {
  const pactSlotKeys = new Set(
    sheet.spells.slots.filter((slot) => slot.slotKey === 'PACT').map((slot) => slot.slotKey)
  )
  if (pactSlotKeys.size === 0) return character

  return {
    ...character,
    state: {
      ...character.state,
      spellSlots: character.state.spellSlots?.filter((slot) => !pactSlotKeys.has(slot.slotKey))
    }
  }
}

function applyShortRestRecovery(
  character: CharacterAuthored,
  sheet: CharacterSheetResponseDto
): CharacterAuthored {
  const withResources = restoreResourcesForRest(character, sheet, 'SHORT_REST')
  return restorePactSpellSlotsForShortRest(withResources, sheet)
}

function setOptionalText(value: string | null | undefined): string | undefined {
  return value == null || value.trim().length === 0 ? undefined : value
}

export function applyCharacterSheetCommand(
  character: CharacterAuthored,
  command: CharacterSheetStateCommand,
  sheet: CharacterSheetResponseDto,
  context: {
    adjustments?: readonly CharacterSheetAdjustment[]
    createId?: () => string
    now?: () => string
  } = {}
): CharacterAuthored {
  const next = structuredClone(character)
  const createId = context.createId ?? (() => crypto.randomUUID())
  const now = context.now ?? (() => new Date().toISOString())

  const ensureContainer = (containerId: string | undefined, movingItemId?: string) => {
    if (!containerId) return
    if (containerId === movingItemId)
      throw new CharacterSheetCommandError('An item cannot contain itself.')
    const container = sheet.inventory.containers?.find((candidate) => candidate.id === containerId)
    if (!container)
      throw new CharacterSheetCommandError(
        `Container "${containerId}" is not available on this character.`
      )
    const containerItem = next.state.equipment.inventory.find((item) => item.id === containerId)
    if (containerItem?.containerId)
      throw new CharacterSheetCommandError('Nested containers are not supported.')
  }

  const ensureEmptyContainer = (itemId: string) => {
    const containsItems = next.state.equipment.inventory.some((item) => item.containerId === itemId)
    const containsCurrency = next.state.currency.some((group) => group.containerId === itemId)
    const assignedToCreature = Object.values(next.state.creatureEquipment ?? {}).some(
      (assignments) => assignments.some((assignment) => assignment.equipmentItemId === itemId)
    )
    const assignedToVehicle = Object.values(next.state.vehicleEquipment ?? {}).some((assignments) =>
      assignments.some((assignment) => assignment.equipmentItemId === itemId)
    )
    if (containsItems || containsCurrency) {
      throw new CharacterSheetCommandError(
        'Move all items and currency out of this container before removing it.'
      )
    }
    if (assignedToCreature || assignedToVehicle) {
      throw new CharacterSheetCommandError('Unassign this item before removing it from inventory.')
    }
  }

  const ensureNoteGroup = (groupId: string) => {
    const persistedGroup = next.state.noteGroups?.find((candidate) => candidate.id === groupId)
    if (
      persistedGroup &&
      !DEFAULT_NOTE_GROUPS.some((builtIn) => builtIn.id === persistedGroup.id)
    ) {
      return persistedGroup
    }

    const builtIn = DEFAULT_NOTE_GROUPS.find((candidate) => candidate.id === groupId)
    if (!builtIn) throw new CharacterSheetCommandError(`Note group "${groupId}" was not found.`)

    const existingBuiltIn = next.state.noteGroups?.find(
      (candidate) =>
        candidate.kind === builtIn.kind &&
        !DEFAULT_NOTE_GROUPS.some((definition) => definition.id === candidate.id)
    )
    if (existingBuiltIn) return existingBuiltIn

    const materialized = { ...builtIn, id: createId() }
    const replacedPseudoIds = new Set(
      (next.state.noteGroups ?? [])
        .filter((candidate) => candidate.kind === builtIn.kind)
        .map((candidate) => candidate.id)
    )
    next.state.noteGroups = [
      ...(next.state.noteGroups ?? []).filter((candidate) => candidate.kind !== builtIn.kind),
      materialized
    ]
    if (replacedPseudoIds.size > 0) {
      next.state.notes = next.state.notes?.map((note) =>
        replacedPseudoIds.has(note.groupId) ? { ...note, groupId: materialized.id } : note
      )
    }
    return materialized
  }

  switch (command.type) {
    case 'UPSERT_SHEET_ADJUSTMENT':
    case 'REMOVE_SHEET_ADJUSTMENT':
    case 'RESET_SHEET_PANEL_ADJUSTMENTS':
    case 'SET_MOVEMENT_DISPLAY_PREFERENCE':
    case 'UPDATE_SPELL_SOURCE_CUSTOMIZATION':
    case 'SET_SPELL_MECHANIC_CUSTOMIZATION':
    case 'REMOVE_SPELL_MECHANIC_CUSTOMIZATION':
    case 'USE_SHEET_RESOURCE':
    case 'RECOVER_SHEET_RESOURCE':
      return clearEmptyStateArrays(next)

    case 'SET_INSPIRATION':
      next.state.inspiration = command.inspired || undefined
      return clearEmptyStateArrays(next)

    case 'SET_HIT_POINTS': {
      next.state.hitpoints.temp = command.temp == null ? next.state.hitpoints.temp : command.temp
      const maxHitPoints =
        command.maxOverride === undefined
          ? sheet.overview.maxHitPoints
          : command.maxOverride === null
            ? getMaxHitPoints(
                next,
                (context.adjustments ?? []).filter(
                  (adjustment) =>
                    adjustment.family !== 'HIT_POINTS' || adjustment.field !== 'MAXIMUM_OVERRIDE'
                )
              )
            : command.maxOverride
      next.state.hitpoints.current = clamp(
        command.current ?? next.state.hitpoints.current,
        0,
        maxHitPoints
      )
      return clearEmptyStateArrays(next)
    }

    case 'ADJUST_HIT_POINTS': {
      const maxHitPoints = sheet.overview.maxHitPoints
      if (command.mode === 'HEAL') {
        next.state.hitpoints.current = clamp(
          next.state.hitpoints.current + command.amount,
          0,
          maxHitPoints
        )
        return clearEmptyStateArrays(next)
      }

      const currentTemp = next.state.hitpoints.temp ?? 0
      const absorbed = Math.min(currentTemp, command.amount)
      const remainingDamage = command.amount - absorbed
      next.state.hitpoints.temp = Math.max(currentTemp - absorbed, 0)
      next.state.hitpoints.current = clamp(
        next.state.hitpoints.current - remainingDamage,
        0,
        maxHitPoints
      )
      return clearEmptyStateArrays(next)
    }

    case 'USE_HIT_DIE': {
      const hitDie = next.state.hitpoints.hitDice.find((die) => die.die === command.die)
      if (!hitDie)
        throw new CharacterSheetCommandError(
          `No d${command.die} hit dice are available on this character.`
        )
      if (hitDie.used >= hitDie.total)
        throw new CharacterSheetCommandError(`All d${command.die} hit dice are already used.`)
      next.state.hitpoints.hitDice = next.state.hitpoints.hitDice.map((die) =>
        die.die === command.die ? { ...die, used: clamp(die.used + 1, 0, die.total) } : die
      )
      return clearEmptyStateArrays(next)
    }

    case 'APPLY_REST':
      if (command.restKind === 'LONG') {
        const maxHitPoints = sheet.overview.maxHitPoints
        next.state.hitpoints.current = maxHitPoints
        next.state.hitpoints.temp = 0
        next.state.hitpoints.hitDice = restoreHitDiceForLongRest(next.state.hitpoints.hitDice)
        next.state.resources = restoreResourcesForRecoveries(next, sheet, [
          'SHORT_REST',
          'LONG_REST'
        ]).state.resources
        next.state.spellSlots = undefined
        next.state.exhaustion =
          next.state.exhaustion && next.state.exhaustion.level > 1
            ? { ...next.state.exhaustion, level: next.state.exhaustion.level - 1 }
            : undefined
      } else {
        return clearEmptyStateArrays(applyShortRestRecovery(next, sheet))
      }
      return clearEmptyStateArrays(next)

    case 'SET_EXHAUSTION': {
      const notes = command.notes === undefined ? next.state.exhaustion?.notes : command.notes
      next.state.exhaustion =
        command.level > 0 ? { level: command.level, notes: notes || undefined } : undefined
      return clearEmptyStateArrays(next)
    }

    case 'ADD_CONDITION': {
      const conditionKnown = sheet.reference.conditionOptions.some(
        (condition) => condition.id === command.conditionTypeId
      )
      if (!conditionKnown)
        throw new CharacterSheetCommandError(
          `Condition "${command.conditionTypeId}" is not available for this system.`
        )
      const existing =
        next.state.conditions?.filter(
          (condition) => condition.conditionTypeId !== command.conditionTypeId
        ) ?? []
      next.state.conditions = [
        ...existing,
        {
          conditionTypeId: command.conditionTypeId,
          notes: command.notes
        }
      ]
      return clearEmptyStateArrays(next)
    }

    case 'REMOVE_CONDITION':
      next.state.conditions = next.state.conditions?.filter(
        (condition) => condition.conditionTypeId !== command.conditionTypeId
      )
      return clearEmptyStateArrays(next)

    case 'USE_RESOURCE': {
      const resource = ensureResource(sheet, command.resourceGrantId)
      return updateResourceUsage(
        next,
        command.resourceGrantId,
        resource.max,
        (used) => used + (command.amount ?? 1)
      )
    }

    case 'RESTORE_RESOURCE': {
      const resource = ensureResource(sheet, command.resourceGrantId)
      return updateResourceUsage(next, command.resourceGrantId, resource.max, (used) =>
        command.all ? 0 : used - (command.amount ?? 1)
      )
    }

    case 'USE_SPELL_SLOT': {
      const slot = ensureSpellSlot(sheet, command.slotKey)
      return updateSpellSlotUsage(next, command.slotKey, slot.max, (used) => used + 1)
    }

    case 'RESTORE_SPELL_SLOT': {
      const slot = ensureSpellSlot(sheet, command.slotKey)
      return updateSpellSlotUsage(next, command.slotKey, slot.max, (used) =>
        command.all ? 0 : used - 1
      )
    }

    case 'CAST_SPELL': {
      const spell = sheet.spells.spells.find((candidate) => candidate.id === command.spellId)
      if (!spell)
        throw new CharacterSheetCommandError(
          `Spell "${command.spellId}" is not available on this character.`
        )
      const sources = spell.sources ?? []
      if (sources.length > 1 && !command.sourceId)
        throw new CharacterSheetCommandError('Choose a spell source before casting.')
      const source = command.sourceId
        ? sources.find((candidate) => candidate.id === command.sourceId)
        : sources[0]
      if (command.sourceId && !source)
        throw new CharacterSheetCommandError(
          `Spell source "${command.sourceId}" is not available for this spell.`
        )
      if (
        source?.canPrepare &&
        source.acquisition !== 'ALWAYS_PREPARED' &&
        source.acquisition !== 'GRANTED' &&
        !source.prepared
      ) {
        throw new CharacterSheetCommandError(
          `Spell "${spell.label}" is not prepared for this source.`
        )
      }
      const castMode = source?.castMode ?? 'SPELL_SLOT'
      if (castMode === 'AT_WILL' || spell.level === 0) return clearEmptyStateArrays(next)
      if (castMode === 'LIMITED_USE') {
        if (!source?.resourceGrantId)
          throw new CharacterSheetCommandError('This limited-use spell has no linked resource.')
        const resource = ensureResource(sheet, source.resourceGrantId)
        if (resource.used >= resource.max)
          throw new CharacterSheetCommandError(
            `Resource "${resource.label}" has no uses remaining.`
          )
        return updateResourceUsage(next, source.resourceGrantId, resource.max, (used) => used + 1)
      }
      if (castMode === 'FIXED_LEVEL') {
        if (!source?.resourceGrantId) return clearEmptyStateArrays(next)
        const resource = ensureResource(sheet, source.resourceGrantId)
        if (resource.used >= resource.max)
          throw new CharacterSheetCommandError(
            `Resource "${resource.label}" has no uses remaining.`
          )
        return updateResourceUsage(next, source.resourceGrantId, resource.max, (used) => used + 1)
      }
      if (!command.slotKey)
        throw new CharacterSheetCommandError('Choose a spell slot before casting.')
      const slot = ensureSpellSlot(sheet, command.slotKey)
      const castLevel = slot.level ?? parseSlotLevel(slot.slotKey)
      const minimumLevel = source?.fixedLevel ?? spell.level
      if (castLevel === null || castLevel < minimumLevel) {
        throw new CharacterSheetCommandError(
          `This spell requires a level ${minimumLevel} or higher spell slot.`
        )
      }
      if (slot.used >= slot.max)
        throw new CharacterSheetCommandError(`Spell slot "${slot.label}" has no uses remaining.`)
      return updateSpellSlotUsage(next, command.slotKey, slot.max, (used) => used + 1)
    }

    case 'SET_PREPARED_SPELLS': {
      if (!next.intent.classes.some((classIntent) => classIntent.classId === command.classId)) {
        throw new CharacterSheetCommandError(`Class "${command.classId}" is not on this character.`)
      }
      const preparedSpellIds = [...new Set(command.spellIds)]
      const preparationSource = sheet.spells.preparationSources?.find(
        (source) => source.classId === command.classId
      )
      if (!preparationSource && preparedSpellIds.length > 0) {
        throw new CharacterSheetCommandError(`Class "${command.classId}" does not prepare spells.`)
      }
      if (
        preparationSource?.preparedSpellLimit !== undefined &&
        preparedSpellIds.length > preparationSource.preparedSpellLimit
      ) {
        throw new CharacterSheetCommandError(
          `Class "${command.classId}" can prepare up to ${preparationSource.preparedSpellLimit} spells.`
        )
      }
      const availableSpellIds = getSheetPreparationAvailableSpellIds(sheet, command.classId)
      const unavailableSpell = preparedSpellIds.find((spellId) => !availableSpellIds.has(spellId))
      if (unavailableSpell)
        throw new CharacterSheetCommandError(
          `Spell "${unavailableSpell}" is not available for class "${command.classId}".`
        )
      const existing = next.state.classes ?? []
      const currentClassState = existing.find(
        (classState) => classState.classId === command.classId
      )
      const learned = [...new Set(currentClassState?.spells?.learned ?? [])]
      const spells = {
        learned: learned.length ? learned : undefined,
        prepared: preparedSpellIds.length ? preparedSpellIds : undefined
      }
      const nextClassState =
        spells.learned || spells.prepared
          ? currentClassState
            ? { ...currentClassState, spells }
            : { classId: command.classId, spells }
          : null
      next.state.classes = currentClassState
        ? existing.flatMap((classState) =>
            classState.classId === command.classId
              ? nextClassState
                ? [nextClassState]
                : []
              : [classState]
          )
        : nextClassState
          ? [...existing, nextClassState]
          : existing
      return clearEmptyStateArrays(next)
    }

    case 'ADD_INVENTORY_ITEM': {
      const equipment = sheet.reference.equipmentOptions.find(
        (candidate) => candidate.id === command.equipmentId
      )
      if (!equipment)
        throw new CharacterSheetCommandError(
          `Equipment "${command.equipmentId}" is not available for this character.`
        )
      if (command.containerId && equipment.isContainer) {
        throw new CharacterSheetCommandError('Nested containers are not supported.')
      }
      ensureContainer(command.containerId)
      next.state.equipment.inventory = [
        ...next.state.equipment.inventory,
        {
          id: createId(),
          equipmentId: command.equipmentId,
          quantity: command.quantity,
          containerId: command.containerId,
          customName: command.customName,
          notes: command.notes
        }
      ]
      return clearEmptyStateArrays(next)
    }

    case 'REMOVE_INVENTORY_ITEM': {
      const existingItem = ensureInventoryItem(next, command.itemId)
      const quantityToRemove = command.quantity ?? existingItem.quantity
      const removesEntireStack = quantityToRemove >= existingItem.quantity
      if (removesEntireStack) ensureEmptyContainer(command.itemId)
      next.state.equipment.inventory = removesEntireStack
        ? next.state.equipment.inventory.filter((item) => item.id !== command.itemId)
        : next.state.equipment.inventory.map((item) =>
            item.id === command.itemId
              ? { ...item, quantity: item.quantity - quantityToRemove }
              : item
          )
      if (removesEntireStack) {
        next.state.equipment.equipped = next.state.equipment.equipped.filter(
          (itemId) => itemId !== command.itemId
        )
        next.state.equipment.attuned = next.state.equipment.attuned.filter(
          (itemId) => itemId !== command.itemId
        )
      }
      return clearEmptyStateArrays(next)
    }

    case 'UPDATE_INVENTORY_ITEM': {
      ensureInventoryItem(next, command.itemId)
      if (command.quantity === 0) {
        ensureEmptyContainer(command.itemId)
        next.state.equipment.inventory = next.state.equipment.inventory.filter(
          (item) => item.id !== command.itemId
        )
        next.state.equipment.equipped = next.state.equipment.equipped.filter(
          (itemId) => itemId !== command.itemId
        )
        next.state.equipment.attuned = next.state.equipment.attuned.filter(
          (itemId) => itemId !== command.itemId
        )
        return clearEmptyStateArrays(next)
      }

      if (command.containerId !== undefined && command.containerId !== null) {
        const movingItem = sheet.inventory.items.find((item) => item.id === command.itemId)
        if (movingItem?.capacity) {
          throw new CharacterSheetCommandError('Nested containers are not supported.')
        }
        ensureContainer(command.containerId, command.itemId)
      }

      next.state.equipment.inventory = next.state.equipment.inventory.map((item) =>
        item.id === command.itemId
          ? {
              ...item,
              quantity: command.quantity ?? item.quantity,
              containerId:
                command.containerId === null
                  ? undefined
                  : (command.containerId ?? item.containerId),
              customName:
                command.customName === null ? undefined : (command.customName ?? item.customName),
              notes: command.notes === null ? undefined : (command.notes ?? item.notes)
            }
          : item
      )
      return clearEmptyStateArrays(next)
    }

    case 'EQUIP_ITEM':
      ensureInventoryItem(next, command.itemId)
      next.state.equipment.equipped = [
        ...new Set([...next.state.equipment.equipped, command.itemId])
      ]
      return clearEmptyStateArrays(next)

    case 'UNEQUIP_ITEM':
      ensureInventoryItem(next, command.itemId)
      next.state.equipment.equipped = next.state.equipment.equipped.filter(
        (itemId) => itemId !== command.itemId
      )
      return clearEmptyStateArrays(next)

    case 'ATTUNE_ITEM': {
      ensureInventoryItem(next, command.itemId)
      const sheetItem = sheet.inventory.items.find((item) => item.id === command.itemId)
      if (!sheetItem?.requiresAttunement) {
        throw new CharacterSheetCommandError(
          `Item "${command.itemId}" does not require attunement.`
        )
      }
      if (
        !next.state.equipment.attuned.includes(command.itemId) &&
        next.state.equipment.attuned.length >= 3
      ) {
        throw new CharacterSheetCommandError('A character cannot attune to more than three items.')
      }
      next.state.equipment.attuned = [...new Set([...next.state.equipment.attuned, command.itemId])]
      return clearEmptyStateArrays(next)
    }

    case 'UNATTUNE_ITEM':
      ensureInventoryItem(next, command.itemId)
      next.state.equipment.attuned = next.state.equipment.attuned.filter(
        (itemId) => itemId !== command.itemId
      )
      return clearEmptyStateArrays(next)

    case 'ADJUST_CURRENCY': {
      const currencyKnown = sheet.reference.currencyOptions.some(
        (currency) => currency.id === command.currencyId
      )
      if (!currencyKnown)
        throw new CharacterSheetCommandError(
          `Currency "${command.currencyId}" is not available for this system.`
        )
      ensureContainer(command.containerId)
      const groupIndex = next.state.currency.findIndex(
        (group) => group.containerId === command.containerId
      )
      if (groupIndex < 0 && command.amount <= 0) return clearEmptyStateArrays(next)
      const groups =
        groupIndex >= 0
          ? next.state.currency
          : [
              ...next.state.currency,
              { id: createId(), containerId: command.containerId, currencies: [] }
            ]
      const targetIndex = groupIndex >= 0 ? groupIndex : groups.length - 1
      const group = groups[targetIndex]
      if (!group) return next

      const currencyIndex = group.currencies.findIndex(
        (currency) => currency.currencyId === command.currencyId
      )
      const currencies =
        currencyIndex >= 0
          ? group.currencies.map((currency) =>
              currency.currencyId === command.currencyId
                ? { ...currency, amount: Math.max(currency.amount + command.amount, 0) }
                : currency
            )
          : command.amount > 0
            ? [...group.currencies, { currencyId: command.currencyId, amount: command.amount }]
            : group.currencies
      groups[targetIndex] = { ...group, currencies }
      next.state.currency = groups
      return clearEmptyStateArrays(next)
    }

    case 'MOVE_CURRENCY': {
      ensureContainer(command.fromContainerId)
      ensureContainer(command.toContainerId)
      if (command.fromContainerId === command.toContainerId) return clearEmptyStateArrays(next)
      const sourceGroup = next.state.currency.find(
        (group) => group.containerId === command.fromContainerId
      )
      const available =
        sourceGroup?.currencies.find((currency) => currency.currencyId === command.currencyId)
          ?.amount ?? 0
      if (available < command.amount)
        throw new CharacterSheetCommandError(
          'There is not enough currency in the source container.'
        )
      const move = (containerId: string | undefined, amount: number) => {
        const groupIndex = next.state.currency.findIndex(
          (group) => group.containerId === containerId
        )
        if (groupIndex < 0) {
          if (amount > 0)
            next.state.currency.push({
              id: createId(),
              containerId,
              currencies: [{ currencyId: command.currencyId, amount }]
            })
          return
        }
        const group = next.state.currency[groupIndex]
        if (!group) return
        const existing = group.currencies.find(
          (currency) => currency.currencyId === command.currencyId
        )
        group.currencies = existing
          ? group.currencies
              .map((currency) =>
                currency.currencyId === command.currencyId
                  ? { ...currency, amount: currency.amount + amount }
                  : currency
              )
              .filter((currency) => currency.amount > 0)
          : [...group.currencies, { currencyId: command.currencyId, amount }]
      }
      move(command.fromContainerId, -command.amount)
      move(command.toContainerId, command.amount)
      return clearEmptyStateArrays(next)
    }

    case 'CREATE_NOTE': {
      const group = ensureNoteGroup(command.groupId)
      const timestamp = now()
      next.state.notes = [
        ...(next.state.notes ?? []),
        {
          id: createId(),
          title: command.title.trim(),
          body: setOptionalText(command.body),
          groupId: group.id,
          pinned: command.pinned || undefined,
          createdAt: timestamp,
          updatedAt: timestamp
        }
      ]
      return clearEmptyStateArrays(next)
    }

    case 'UPDATE_NOTE': {
      const existing = next.state.notes?.find((note) => note.id === command.noteId)
      if (!existing) throw new CharacterSheetCommandError('Note was not found.')
      const group = ensureNoteGroup(command.groupId ?? existing.groupId)
      next.state.notes = next.state.notes?.map((note) =>
        note.id === command.noteId
          ? {
              ...note,
              title: command.title?.trim() ?? note.title,
              body: command.body === null ? undefined : (command.body ?? note.body),
              groupId: group.id,
              pinned: command.pinned ?? note.pinned,
              updatedAt: now()
            }
          : note
      )
      return clearEmptyStateArrays(next)
    }

    case 'DELETE_NOTE':
      if (!next.state.notes?.some((note) => note.id === command.noteId))
        throw new CharacterSheetCommandError('Note was not found.')
      next.state.notes = next.state.notes.filter((note) => note.id !== command.noteId)
      return clearEmptyStateArrays(next)

    case 'CREATE_NOTE_GROUP':
      next.state.noteGroups = [
        ...(next.state.noteGroups ?? []),
        {
          id: createId(),
          label: command.label.trim(),
          sortOrder: Math.max(-1, ...getNoteGroups(next).map((group) => group.sortOrder)) + 1,
          kind: 'CUSTOM'
        }
      ]
      return clearEmptyStateArrays(next)

    case 'UPDATE_NOTE_GROUP': {
      const group = ensureNoteGroup(command.groupId)
      const updated = {
        ...group,
        label: command.label?.trim() ?? group.label,
        sortOrder: command.sortOrder ?? group.sortOrder
      }
      next.state.noteGroups = [
        ...(next.state.noteGroups ?? []).filter((candidate) => candidate.id !== group.id),
        updated
      ]
      return clearEmptyStateArrays(next)
    }

    case 'DELETE_NOTE_GROUP': {
      const group = ensureNoteGroup(command.groupId)
      if (group.kind !== 'CUSTOM')
        throw new CharacterSheetCommandError('Built-in note groups cannot be deleted.')
      if (next.state.notes?.some((note) => note.groupId === group.id))
        throw new CharacterSheetCommandError('Move or delete the notes in this group first.')
      next.state.noteGroups = next.state.noteGroups?.filter(
        (candidate) => candidate.id !== group.id
      )
      return clearEmptyStateArrays(next)
    }

    default:
      return command satisfies never
  }
}

function findConditionLabel(
  sheet: CharacterSheetResponseDto | undefined,
  conditionTypeId: string
): string | undefined {
  return (
    sheet?.overview.conditions.find((condition) => condition.conditionTypeId === conditionTypeId)
      ?.label ??
    sheet?.reference.conditionOptions.find((condition) => condition.id === conditionTypeId)?.label
  )
}

function findResourceLabel(
  sheet: CharacterSheetResponseDto | undefined,
  resourceGrantId: string
): string | undefined {
  return sheet?.resources.items.find((resource) => resource.id === resourceGrantId)?.label
}

function findSpellSlotLabel(
  sheet: CharacterSheetResponseDto | undefined,
  slotKey: string
): string | undefined {
  return sheet?.spells.slots.find((slot) => slot.slotKey === slotKey)?.label
}

function findInventoryItem(
  sheet: CharacterSheetResponseDto | undefined,
  itemId: string
): CharacterSheetResponseDto['inventory']['items'][number] | undefined {
  return sheet?.inventory.items.find((item) => item.id === itemId)
}

function findInventoryItemLabel(
  sheet: CharacterSheetResponseDto | undefined,
  itemId: string
): string | undefined {
  return findInventoryItem(sheet, itemId)?.label
}

function findEquipmentOptionLabel(
  sheet: CharacterSheetResponseDto | undefined,
  equipmentId: string
): string | undefined {
  return sheet?.reference.equipmentOptions.find((item) => item.id === equipmentId)?.label
}

function findCurrencyLabel(
  sheet: CharacterSheetResponseDto | undefined,
  currencyId: string
): string | undefined {
  return sheet?.reference.currencyOptions.find((currency) => currency.id === currencyId)?.label
}

export function summarizeCharacterSheetCommand(
  command: CharacterSheetStateCommand,
  sheet?: CharacterSheetResponseDto
): string {
  switch (command.type) {
    case 'UPSERT_SHEET_ADJUSTMENT':
      return 'Character sheet adjustment updated'
    case 'REMOVE_SHEET_ADJUSTMENT':
      return 'Character sheet adjustment cleared'
    case 'RESET_SHEET_PANEL_ADJUSTMENTS':
      return 'Character sheet panel customizations reset'
    case 'SET_MOVEMENT_DISPLAY_PREFERENCE':
      return 'Primary movement display updated'
    case 'SET_SPELL_MECHANIC_CUSTOMIZATION':
      return 'Spell mechanic customization updated'
    case 'REMOVE_SPELL_MECHANIC_CUSTOMIZATION':
      return 'Spell mechanic customization cleared'
    case 'UPDATE_SPELL_SOURCE_CUSTOMIZATION':
      return 'Spell source customization updated'

    case 'SET_INSPIRATION':
      return command.inspired ? 'Inspiration granted' : 'Inspiration cleared'

    case 'SET_HIT_POINTS':
      return 'Hit points updated'
    case 'ADJUST_HIT_POINTS':
      return command.mode === 'DAMAGE'
        ? `${command.amount} damage applied`
        : `${command.amount} HP restored`
    case 'USE_HIT_DIE':
      return `Used one d${command.die} hit die`
    case 'APPLY_REST':
      return command.restKind === 'LONG' ? 'Long rest applied' : 'Short rest applied'
    case 'SET_EXHAUSTION':
      return command.level > 0 ? `Exhaustion set to level ${command.level}` : 'Exhaustion cleared'
    case 'ADD_CONDITION':
      return `${findConditionLabel(sheet, command.conditionTypeId) ?? 'Condition'} added`
    case 'REMOVE_CONDITION':
      return `${findConditionLabel(sheet, command.conditionTypeId) ?? 'Condition'} removed`
    case 'USE_RESOURCE':
      return `${findResourceLabel(sheet, command.resourceGrantId) ?? 'Resource'} used`
    case 'RESTORE_RESOURCE':
      return `${findResourceLabel(sheet, command.resourceGrantId) ?? 'Resource'} restored`
    case 'USE_SHEET_RESOURCE':
      return 'Sheet resource used'
    case 'RECOVER_SHEET_RESOURCE':
      return 'Sheet resource recovered'
    case 'USE_SPELL_SLOT': {
      const slotLabel = findSpellSlotLabel(sheet, command.slotKey)
      return slotLabel ? `${slotLabel} spell slot used` : 'Spell slot used'
    }
    case 'RESTORE_SPELL_SLOT': {
      const slotLabel = findSpellSlotLabel(sheet, command.slotKey)
      return slotLabel ? `${slotLabel} spell slot restored` : 'Spell slot restored'
    }
    case 'CAST_SPELL':
      return `${sheet?.spells.spells.find((spell) => spell.id === command.spellId)?.label ?? 'Spell'} cast`
    case 'SET_PREPARED_SPELLS':
      return 'Prepared spells updated'
    case 'ADD_INVENTORY_ITEM':
      return `${findEquipmentOptionLabel(sheet, command.equipmentId) ?? 'Inventory item'} added`
    case 'REMOVE_INVENTORY_ITEM': {
      const item = findInventoryItem(sheet, command.itemId)
      const label = item?.label ?? 'Inventory item'
      if (command.quantity !== undefined && (!item || command.quantity < item.quantity)) {
        return `${label} quantity reduced by ${command.quantity}`
      }
      return `${label} removed`
    }
    case 'UPDATE_INVENTORY_ITEM':
      return `${findInventoryItemLabel(sheet, command.itemId) ?? 'Inventory item'} updated`
    case 'EQUIP_ITEM':
      return `${findInventoryItemLabel(sheet, command.itemId) ?? 'Item'} equipped`
    case 'UNEQUIP_ITEM':
      return `${findInventoryItemLabel(sheet, command.itemId) ?? 'Item'} unequipped`
    case 'ATTUNE_ITEM':
      return `${findInventoryItemLabel(sheet, command.itemId) ?? 'Item'} attuned`
    case 'UNATTUNE_ITEM':
      return `${findInventoryItemLabel(sheet, command.itemId) ?? 'Item'} unattuned`
    case 'ADJUST_CURRENCY':
      return `${findCurrencyLabel(sheet, command.currencyId) ?? 'Currency'} updated`
    case 'MOVE_CURRENCY':
      return `${findCurrencyLabel(sheet, command.currencyId) ?? 'Currency'} moved`
    case 'CREATE_NOTE':
      return `Note "${command.title}" created`
    case 'UPDATE_NOTE':
      return 'Note updated'
    case 'DELETE_NOTE':
      return 'Note deleted'
    case 'CREATE_NOTE_GROUP':
      return `Note group "${command.label}" created`
    case 'UPDATE_NOTE_GROUP':
      return 'Note group updated'
    case 'DELETE_NOTE_GROUP':
      return 'Note group deleted'
    default:
      return command satisfies never
  }
}

function stateValuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function createCharacterSheetStatePatches(
  current: CharacterAuthored,
  next: CharacterAuthored
): CharacterSheetStatePatch[] {
  const patches: CharacterSheetStatePatch[] = []

  if (!stateValuesEqual(current.state.inspiration, next.state.inspiration)) {
    patches.push({ kind: 'INSPIRATION', value: next.state.inspiration })
  }
  if (!stateValuesEqual(current.state.hitpoints, next.state.hitpoints)) {
    patches.push({ kind: 'HITPOINTS', value: next.state.hitpoints })
  }
  if (!stateValuesEqual(current.state.resources, next.state.resources)) {
    patches.push({ kind: 'RESOURCES', value: next.state.resources })
  }
  if (!stateValuesEqual(current.state.spellSlots, next.state.spellSlots)) {
    patches.push({ kind: 'SPELL_SLOTS', value: next.state.spellSlots })
  }
  if (!stateValuesEqual(current.state.classes, next.state.classes)) {
    patches.push({ kind: 'CLASS_SPELLS', value: next.state.classes })
  }
  if (!stateValuesEqual(current.state.conditions, next.state.conditions)) {
    patches.push({ kind: 'CONDITIONS', value: next.state.conditions })
  }
  if (!stateValuesEqual(current.state.exhaustion, next.state.exhaustion)) {
    patches.push({ kind: 'EXHAUSTION', value: next.state.exhaustion })
  }
  if (!stateValuesEqual(current.state.equipment, next.state.equipment)) {
    patches.push({
      kind: 'EQUIPMENT',
      value: next.state.equipment,
      creatureEquipment: next.state.creatureEquipment,
      vehicleEquipment: next.state.vehicleEquipment
    })
  }
  if (!stateValuesEqual(current.state.currency, next.state.currency)) {
    patches.push({ kind: 'CURRENCY', value: next.state.currency })
  }
  if (
    !stateValuesEqual(current.state.noteGroups, next.state.noteGroups) ||
    !stateValuesEqual(current.state.notes, next.state.notes)
  ) {
    patches.push({
      kind: 'NOTES',
      groups: next.state.noteGroups,
      notes: next.state.notes
    })
  }

  return patches
}

function sameAdjustmentSlot(
  adjustment: CharacterSheetAdjustment,
  input: CharacterSheetCoreAdjustmentCommandDto | CharacterSheetItemAdjustmentCommandDto
): boolean {
  if (adjustment.family !== input.family) return false
  switch (input.family) {
    case 'ABILITY':
      return (
        adjustment.family === 'ABILITY' &&
        adjustment.ability === input.ability &&
        adjustment.field === input.field
      )
    case 'SAVING_THROW':
      return (
        adjustment.family === 'SAVING_THROW' &&
        adjustment.ability === input.ability &&
        adjustment.field === input.field
      )
    case 'SKILL':
      return (
        adjustment.family === 'SKILL' &&
        adjustment.skillId === input.skillId &&
        adjustment.field === input.field
      )
    case 'PASSIVE':
      return adjustment.family === 'PASSIVE' && adjustment.skillId === input.skillId
    case 'SENSE':
      return adjustment.family === 'SENSE' && adjustment.senseId === input.senseId
    case 'MOVEMENT':
      return adjustment.family === 'MOVEMENT' && adjustment.speedId === input.speedId
    case 'DEFENSE':
      return (
        adjustment.family === 'DEFENSE' &&
        adjustment.defenseKind === input.defenseKind &&
        adjustment.damageTypeId === input.damageTypeId
      )
    case 'PROFICIENCY':
      return (
        adjustment.family === 'PROFICIENCY' &&
        adjustment.proficiencyKind === input.proficiencyKind &&
        adjustment.targetId === input.targetId
      )
    case 'ITEM':
      return (
        adjustment.family === 'ITEM' &&
        adjustment.itemInstanceId === input.itemInstanceId &&
        adjustment.field === input.field
      )
  }
}

function validateSheetAdjustmentTarget(
  input: CharacterSheetCoreAdjustmentCommandDto | CharacterSheetItemAdjustmentCommandDto,
  resolution: CharacterBuilderResolution,
  character: CharacterAuthored
): void {
  const system = resolution.registry.system
  const ensureVocabularyTarget = (
    records: ReadonlyArray<{ id: string }> | undefined,
    targetId: string,
    label: string
  ) => {
    if (!records?.some((record) => record.id === targetId)) {
      throw new CharacterSheetCommandError(
        `${label} "${targetId}" is not available in this rules system.`
      )
    }
  }

  switch (input.family) {
    case 'ABILITY':
    case 'SAVING_THROW':
      return
    case 'SKILL':
    case 'PASSIVE':
      ensureVocabularyTarget(system?.skills, input.skillId, 'Skill')
      return
    case 'SENSE':
      ensureVocabularyTarget(system?.senses, input.senseId, 'Sense')
      return
    case 'MOVEMENT':
      ensureVocabularyTarget(system?.speeds, input.speedId, 'Movement type')
      return
    case 'DEFENSE':
      ensureVocabularyTarget(system?.damageTypes, input.damageTypeId, 'Damage type')
      return
    case 'PROFICIENCY':
      if (input.proficiencyKind === 'LANGUAGE') {
        ensureVocabularyTarget(system?.languages, input.targetId, 'Language')
        return
      }
      const equipment = resolution.catalog.equipment.find(
        (candidate) => candidate.id === input.targetId
      )
      const validCategory =
        input.proficiencyKind === 'ARMOR'
          ? equipment?.category === 'ARMOR' || equipment?.category === 'SHIELD'
          : equipment?.category === input.proficiencyKind
      if (!equipment || !validCategory) {
        throw new CharacterSheetCommandError(
          `${formatCodeLabel(input.proficiencyKind)} proficiency target "${input.targetId}" is not available.`
        )
      }
      return
    case 'ITEM':
      if (!character.state.equipment.inventory.some((item) => item.id === input.itemInstanceId)) {
        throw new CharacterSheetCommandError(
          `Owned item "${input.itemInstanceId}" is not available on this character.`
        )
      }
      return
  }
}

function validatePanelTarget(
  target: CharacterSheetPanelTargetDto,
  resolution: CharacterBuilderResolution
): void {
  if (
    target.kind === 'SKILL' &&
    !resolution.registry.system?.skills.some((skill) => skill.id === target.skillId)
  ) {
    throw new CharacterSheetCommandError(
      `Skill "${target.skillId}" is not available in this rules system.`
    )
  }
}

type SpellMechanicCustomizationCommand = Extract<
  CharacterSheetCommandInputDto,
  {
    type: 'SET_SPELL_MECHANIC_CUSTOMIZATION' | 'REMOVE_SPELL_MECHANIC_CUSTOMIZATION'
  }
>

function getSpellCustomizationFields(
  category: SpellMechanicCustomizationCommand['category']
): readonly Extract<CharacterSheetAdjustment, { family: 'SPELL' }>['field'][] {
  switch (category) {
    case 'TO_HIT':
      return ['ATTACK_BONUS', 'ATTACK_OVERRIDE']
    case 'SAVE_DC':
      return ['DC_BONUS', 'DC_OVERRIDE']
    case 'DAMAGE':
      return ['DAMAGE_BONUS']
  }
}

function getSpellCustomizationField(
  command: Extract<SpellMechanicCustomizationCommand, { type: 'SET_SPELL_MECHANIC_CUSTOMIZATION' }>
): Extract<CharacterSheetAdjustment, { family: 'SPELL' }>['field'] {
  switch (command.category) {
    case 'TO_HIT':
      return command.mode === 'OVERRIDE' ? 'ATTACK_OVERRIDE' : 'ATTACK_BONUS'
    case 'SAVE_DC':
      return command.mode === 'OVERRIDE' ? 'DC_OVERRIDE' : 'DC_BONUS'
    case 'DAMAGE':
      if (command.mode !== 'BONUS') {
        throw new CharacterSheetCommandError('Damage customization supports a bonus only.')
      }
      return 'DAMAGE_BONUS'
  }
}

function sameSpellSource(
  left: Extract<CharacterSheetAdjustment, { family: 'SPELL' }>['source'],
  right: Extract<CharacterSheetAdjustment, { family: 'SPELL' }>['source']
): boolean {
  return createCharacterSpellSourceKey(left) === createCharacterSpellSourceKey(right)
}

function validateSpellMechanicCustomization(
  command: SpellMechanicCustomizationCommand,
  sheet: CharacterSheetResponseDto
): void {
  const sourceKey = createCharacterSpellSourceKey(command.source)
  const spell = sheet.spells.spells.find((candidate) => candidate.id === command.source.spellId)
  const source = spell?.sources?.find(
    (candidate) => createCharacterSpellSourceKey(candidate.source) === sourceKey
  )
  if (!spell || !source) {
    throw new CharacterSheetCommandError(
      `Spell source "${sourceKey}" is not available on this character.`
    )
  }

  const mechanics = spell.mechanics ?? []
  const valid =
    command.category === 'TO_HIT'
      ? mechanics.some((mechanic) => mechanic.attackBonus !== undefined)
      : command.category === 'SAVE_DC'
        ? mechanics.some((mechanic) => mechanic.save !== undefined)
        : mechanics.some((mechanic) =>
            mechanic.outcomes.some((outcome) => outcome.kind === 'DAMAGE')
          )
  if (!valid) {
    throw new CharacterSheetCommandError(
      `${formatCodeLabel(command.category)} customization is not available for this spell.`
    )
  }

  if (command.type === 'SET_SPELL_MECHANIC_CUSTOMIZATION') {
    getSpellCustomizationField(command)
  }
}

function validateSpellSource(
  source: Extract<
    CharacterSheetCommandInputDto,
    { type: 'UPDATE_SPELL_SOURCE_CUSTOMIZATION' }
  >['source'],
  sheet: CharacterSheetResponseDto
): void {
  const sourceKey = createCharacterSpellSourceKey(source)
  const available = sheet.spells.spells.some((spell) =>
    spell.sources?.some(
      (candidate) => createCharacterSpellSourceKey(candidate.source) === sourceKey
    )
  )
  if (!available) {
    throw new CharacterSheetCommandError(
      `Spell source "${sourceKey}" is not available on this character.`
    )
  }
}

export async function executeCharacterSheetCommand(params: {
  db: DBLike
  characterId: string
  command: CharacterSheetCommandInputDto
  userId: string
}): Promise<CharacterSheetCommandResponseDto> {
  const command = params.command
  const repository = createCharacterRepository(params.db)
  const [row, character] = await Promise.all([
    repository.findById(params.characterId),
    repository.findAuthoredById(params.characterId)
  ])
  if (!character || !row) {
    throw createNamedError('NotFoundError', `Character "${params.characterId}" was not found.`)
  }

  if (character.userId !== params.userId) {
    throw createNamedError(
      'AuthoredContentOwnershipError',
      `Character "${params.characterId}" cannot be updated by the current user.`
    )
  }

  if ((character.status ?? AUTHORED_RECORD_STATUS.ACTIVE) !== AUTHORED_RECORD_STATUS.ACTIVE) {
    throw new CharacterSheetCommandError(`Character "${params.characterId}" is not finalized yet.`)
  }

  const adjustmentRepository = createCharacterSheetAdjustmentRepository(params.db)
  const playStateRepository = createCharacterSheetPlayStateRepository(params.db)
  const [adjustments, movementDisplayPreference, resourceUsage, spellCustomizations] =
    await Promise.all([
      adjustmentRepository.listByCharacter(params.characterId),
      adjustmentRepository.getMovementPreference(params.characterId),
      playStateRepository.listResourceUsage(params.characterId),
      playStateRepository.listSpellCustomizations(params.characterId)
    ])
  const eventRepository = createCharacterEventRepository(params.db)
  const commandFingerprint = fingerprintCharacterSheetCommand(params.command)
  const priorEvent = await eventRepository.findByCommandId(
    params.characterId,
    params.command.commandId
  )
  if (priorEvent) {
    if (priorEvent.type !== 'CHARACTER_SHEET_COMMAND_APPLIED') {
      throw new CharacterSheetCommandError(
        `Command "${params.command.commandId}" was already used for a different operation.`
      )
    }
    if (priorEvent.commandType !== params.command.type) {
      throw new CharacterSheetCommandError(
        `Command "${params.command.commandId}" was already used for a different operation.`
      )
    }
    if (priorEvent.commandFingerprint !== commandFingerprint) {
      throw new CharacterSheetCommandError(
        `Command "${params.command.commandId}" was already used with different input.`
      )
    }
    const resolution = await resolveCharacterBuilder(params.db, character, 'edit')
    return {
      characterId: params.characterId,
      streamVersion: row.stream_version,
      sheet: await buildCharacterSheetResponse({
        db: params.db,
        character,
        resolution,
        streamVersion: row.stream_version,
        adjustments,
        movementDisplayPreference,
        resourceUsage,
        spellCustomizations
      }),
      historyEntry: {
        eventId: priorEvent.eventId,
        occurredAt: priorEvent.occurredAt,
        actorId: priorEvent.actorId,
        eventType: priorEvent.type,
        summary: priorEvent.summary
      }
    }
  }

  if (row.stream_version !== params.command.expectedVersion) {
    throw new ConcurrencyError(params.characterId, params.command.expectedVersion)
  }

  const resolution = await resolveCharacterBuilder(params.db, character, 'edit')
  if (command.type === 'UPSERT_SHEET_ADJUSTMENT') {
    validateSheetAdjustmentTarget(command.adjustment, resolution, character)
  }
  if (command.type === 'REMOVE_SHEET_ADJUSTMENT') {
    validatePanelTarget(command.target, resolution)
    const existing = adjustments.find(
      (adjustment) => adjustment.id === command.adjustmentId && adjustment.family === command.family
    )
    if (!existing || !characterSheetAdjustmentMatchesPanelTarget(existing, command.target)) {
      throw new CharacterSheetCommandError(
        `Adjustment "${command.adjustmentId}" is not available in this panel.`
      )
    }
  }
  if (command.type === 'RESET_SHEET_PANEL_ADJUSTMENTS') {
    validatePanelTarget(command.target, resolution)
  }
  if (
    command.type === 'SET_MOVEMENT_DISPLAY_PREFERENCE' &&
    command.preference.mode === 'EXPLICIT'
  ) {
    const speedId = command.preference.speedId
    if (!resolution.registry.system?.speeds.some((speed) => speed.id === speedId)) {
      throw new CharacterSheetCommandError(
        `Movement type "${speedId}" is not available in this rules system.`
      )
    }
  }
  if (params.command.type === 'ADD_INVENTORY_ITEM') {
    const equipmentId = params.command.equipmentId
    const equipmentAlreadyLoaded = resolution.registry.equipment.some(
      (equipment) => equipment.id === equipmentId
    )
    if (!equipmentAlreadyLoaded) {
      const equipment = await createEquipmentRepository(params.db).findResolvedById(equipmentId, {
        systemId: character.systemId,
        includeEffects: false
      })
      if (equipment) resolution.registry.equipment.push(equipment)
    }
  }
  const currentSheet = await buildCharacterSheetResponse({
    db: params.db,
    character,
    resolution,
    streamVersion: row.stream_version,
    adjustments,
    movementDisplayPreference,
    resourceUsage,
    spellCustomizations
  })
  if (
    command.type === 'SET_SPELL_MECHANIC_CUSTOMIZATION' ||
    command.type === 'REMOVE_SPELL_MECHANIC_CUSTOMIZATION'
  ) {
    validateSpellMechanicCustomization(command, currentSheet)
  }
  if (command.type === 'UPDATE_SPELL_SOURCE_CUSTOMIZATION') {
    validateSpellSource(command.source, currentSheet)
  }
  const nextCharacter = applyCharacterSheetCommand(character, params.command, currentSheet, {
    adjustments
  })
  const statePatches = createCharacterSheetStatePatches(character, nextCharacter)
  const summary = summarizeCharacterSheetCommand(params.command, currentSheet)
  const event = {
    type: 'CHARACTER_SHEET_COMMAND_APPLIED',
    eventId: crypto.randomUUID(),
    characterId: params.characterId,
    occurredAt: new Date().toISOString(),
    actorId: params.userId,
    commandId: params.command.commandId,
    schemaVersion: 1,
    commandType: params.command.type,
    commandFingerprint,
    summary
  } satisfies CharacterEvent
  const nextStreamVersion = await repository.patchSheetState(params.characterId, statePatches, {
    expectedStreamVersion: params.command.expectedVersion,
    afterPersist: async (trx) => {
      const typedAdjustmentRepository = createCharacterSheetAdjustmentRepository(trx)
      const typedPlayStateRepository = createCharacterSheetPlayStateRepository(trx)
      if (command.type === 'UPSERT_SHEET_ADJUSTMENT') {
        const existing = adjustments.find((adjustment) =>
          sameAdjustmentSlot(adjustment, command.adjustment)
        )
        await typedAdjustmentRepository.upsert({
          ...command.adjustment,
          id: existing?.id ?? command.adjustment.id ?? crypto.randomUUID(),
          characterId: params.characterId,
          actorId: params.userId
        })
      }
      if (command.type === 'REMOVE_SHEET_ADJUSTMENT') {
        await typedAdjustmentRepository.remove({
          characterId: params.characterId,
          adjustmentId: command.adjustmentId,
          family: command.family
        })
      }
      if (command.type === 'RESET_SHEET_PANEL_ADJUSTMENTS') {
        for (const adjustment of getCharacterSheetPanelAdjustmentIds(adjustments, command.target)) {
          await typedAdjustmentRepository.remove({
            characterId: params.characterId,
            adjustmentId: adjustment.id,
            family: adjustment.family
          })
        }
      }
      if (command.type === 'SET_MOVEMENT_DISPLAY_PREFERENCE') {
        await typedAdjustmentRepository.setMovementPreference({
          characterId: params.characterId,
          actorId: params.userId,
          preference: command.preference
        })
      }
      if (command.type === 'SET_SPELL_MECHANIC_CUSTOMIZATION') {
        const fields = getSpellCustomizationFields(command.category)
        for (const adjustment of adjustments) {
          if (
            adjustment.family === 'SPELL' &&
            sameSpellSource(adjustment.source, command.source) &&
            fields.includes(adjustment.field)
          ) {
            await typedAdjustmentRepository.remove({
              characterId: params.characterId,
              adjustmentId: adjustment.id,
              family: 'SPELL'
            })
          }
        }
        await typedAdjustmentRepository.upsert({
          id: crypto.randomUUID(),
          characterId: params.characterId,
          actorId: params.userId,
          family: 'SPELL',
          source: command.source,
          field: getSpellCustomizationField(command),
          value: command.value,
          ...(command.sourceNote ? { sourceNote: command.sourceNote } : {})
        })
      }
      if (command.type === 'REMOVE_SPELL_MECHANIC_CUSTOMIZATION') {
        const fields = getSpellCustomizationFields(command.category)
        for (const adjustment of adjustments) {
          if (
            adjustment.family === 'SPELL' &&
            sameSpellSource(adjustment.source, command.source) &&
            fields.includes(adjustment.field)
          ) {
            await typedAdjustmentRepository.remove({
              characterId: params.characterId,
              adjustmentId: adjustment.id,
              family: 'SPELL'
            })
          }
        }
      }
      if (command.type === 'UPDATE_SPELL_SOURCE_CUSTOMIZATION') {
        const existing = spellCustomizations.find(
          (customization) =>
            createCharacterSpellSourceKey(customization.source) ===
            createCharacterSpellSourceKey(command.source)
        )
        await typedPlayStateRepository.setSpellCustomization({
          id: existing?.id ?? crypto.randomUUID(),
          characterId: params.characterId,
          actorId: params.userId,
          source: command.source,
          customName:
            command.customName === undefined
              ? existing?.customName
              : (command.customName ?? undefined),
          notes: command.notes === undefined ? existing?.notes : (command.notes ?? undefined),
          displayAsAttack: command.displayAsAttack ?? existing?.displayAsAttack ?? false
        })
      }
      if (params.command.type === 'SET_HIT_POINTS' && params.command.maxOverride !== undefined) {
        const existing = adjustments.find(
          (adjustment) =>
            adjustment.family === 'HIT_POINTS' && adjustment.field === 'MAXIMUM_OVERRIDE'
        )
        if (params.command.maxOverride === null) {
          if (existing) {
            await typedAdjustmentRepository.remove({
              characterId: params.characterId,
              adjustmentId: existing.id,
              family: 'HIT_POINTS'
            })
          }
        } else {
          await typedAdjustmentRepository.upsert({
            id: existing?.id ?? crypto.randomUUID(),
            characterId: params.characterId,
            actorId: params.userId,
            family: 'HIT_POINTS',
            field: 'MAXIMUM_OVERRIDE',
            value: params.command.maxOverride,
            ...(existing?.sourceNote == null ? {} : { sourceNote: existing.sourceNote })
          })
        }
      }
      await createCharacterEventRepository(trx).append(event)
    }
  })

  const [
    persistedAdjustments,
    persistedMovementDisplayPreference,
    persistedResourceUsage,
    persistedSpellCustomizations
  ] = await Promise.all([
    adjustmentRepository.listByCharacter(params.characterId),
    adjustmentRepository.getMovementPreference(params.characterId),
    playStateRepository.listResourceUsage(params.characterId),
    playStateRepository.listSpellCustomizations(params.characterId)
  ])
  const sheet = await buildCharacterSheetResponse({
    db: params.db,
    character: nextCharacter,
    resolution,
    streamVersion: nextStreamVersion,
    adjustments: persistedAdjustments,
    movementDisplayPreference: persistedMovementDisplayPreference,
    resourceUsage: persistedResourceUsage,
    spellCustomizations: persistedSpellCustomizations
  })
  const historyEntry: CharacterHistoryEntryDto = {
    eventId: event.eventId,
    occurredAt: event.occurredAt,
    actorId: event.actorId,
    eventType: event.type,
    summary
  }

  return {
    characterId: params.characterId,
    streamVersion: nextStreamVersion,
    sheet,
    historyEntry
  }
}

function fingerprintCharacterSheetCommand(command: CharacterSheetCommandInputDto): string {
  return createHash('sha256')
    .update(JSON.stringify(sortFingerprintValue(command)))
    .digest('hex')
}

function sortFingerprintValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortFingerprintValue)
  if (typeof value !== 'object' || value === null) return value

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortFingerprintValue(entry)])
  )
}
