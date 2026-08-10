import type {
  CharacterAssemblyRegistry,
  CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'
import {
  ABILITIES,
  resolveRulesSystem,
  runEngine,
  type EngineCharacterOutput
} from '@artificer-toolkit/shared/core'
import {
  compileBackground,
  compileClass,
  compileFeat,
  compileFeature,
  compileRace,
  compileResolvedEquipment
} from '@artificer-toolkit/shared/compilers'
import { isSameCharacterProvenanceIdentity } from '@artificer-toolkit/shared/subjects/authored'

import {
  createCharacterDefinitionSourceInstanceId,
  createCharacterSpellSourceKey,
  toCharacterMechanicalAdjustment,
  type CharacterMovementDisplayPreference,
  type CharacterSheetAdjustment
} from '@artificer-toolkit/shared/character'
import { SKILL_ABILITY_MAP } from '@artificer-toolkit/shared/engine/resolution'
import type {
  CharacterAuthored,
  CharacterProvenance,
  CharacterAcquisitionTiming
} from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterBuilderRegistry, CharacterBuilderResolution } from './builderService.js'

type EngineFeatureSource = CharacterBuildSnapshot['features'][number]['source']
type EngineFeatureTiming = CharacterBuildSnapshot['features'][number]['timing']

function collectRegistryFeatures(registry: CharacterBuilderRegistry) {
  return [
    ...registry.features,
    ...registry.races.flatMap((race) => [
      ...(race.features ?? []),
      ...(race.ancestry?.options.flatMap((option) => option.features ?? []) ?? [])
    ]),
    ...registry.classes.flatMap((classRecord) => classRecord.features ?? []),
    ...registry.backgrounds.flatMap((background) => background.features ?? []),
    ...(registry.feats ?? []).flatMap((feat) => feat.features ?? [])
  ]
}

export function createCharacterAssemblyRegistry(
  registry: CharacterBuilderRegistry
): CharacterAssemblyRegistry {
  const features = collectRegistryFeatures(registry)

  return {
    backgrounds: Object.fromEntries(
      registry.backgrounds.map((record) => [record.id, compileBackground(record)])
    ),
    classes: Object.fromEntries(
      registry.classes.map((record) => [record.id, compileClass(record)])
    ),
    equipment: Object.fromEntries(
      registry.equipment.map((record) => [record.id, compileResolvedEquipment(record)])
    ),
    feats: Object.fromEntries(
      (registry.feats ?? []).map((record) => [record.id, compileFeat(record)])
    ),
    features: Object.fromEntries(features.map((record) => [record.id, compileFeature(record)])),
    races: Object.fromEntries(registry.races.map((record) => [record.id, compileRace(record)])),
    // Spell card mechanics are loaded through the Sheet projection. The current
    // engine resolves granted spell IDs from compiled grant owners and does not
    // hydrate or inspect the spell aggregates themselves.
    spells: {},
    system: registry.system
      ? {
          skills: registry.system.skills ?? [],
          speeds: registry.system.speeds ?? []
        }
      : undefined
  }
}

function createCharacterEngineFeatures(
  character: CharacterAuthored,
  resolution: CharacterBuilderResolution
): CharacterBuildSnapshot['features'] {
  const registryFeatures = collectRegistryFeatures(resolution.registry)
  const automaticFeatures = resolution.grants.features.map((grant) => {
    const feature = registryFeatures.find((candidate) => candidate.id === grant.id)
    const acquisition = character.intent.featureAcquisitions.find(
      (candidate) =>
        candidate.featureId === grant.id &&
        isSameCharacterProvenanceIdentity(candidate.source, grant.source)
    )
    const timing =
      acquisition?.timing ??
      inferAutomaticFeatureTiming(character, grant.source, feature?.availableAtLevel ?? 1)

    return {
      ...(acquisition ? { acquisitionId: acquisition.id } : {}),
      featureId: grant.id,
      source: toCharacterEngineFeatureSource(grant.source),
      timing: toCharacterEngineFeatureTiming(timing),
      ...(acquisition?.selections ? { selections: acquisition.selections } : {})
    }
  })
  const explicitFeatures = character.intent.featureAcquisitions
    .filter(
      (acquisition) =>
        !resolution.grants.features.some(
          (grant) =>
            acquisition.featureId === grant.id &&
            isSameCharacterProvenanceIdentity(acquisition.source, grant.source)
        )
    )
    .map((acquisition) => ({
      acquisitionId: acquisition.id,
      featureId: acquisition.featureId,
      source: toCharacterEngineFeatureSource(acquisition.source),
      timing: toCharacterEngineFeatureTiming(acquisition.timing),
      ...(acquisition.selections ? { selections: acquisition.selections } : {})
    }))

  return [...automaticFeatures, ...explicitFeatures]
}

function inferAutomaticFeatureTiming(
  character: CharacterAuthored,
  source: CharacterProvenance,
  availableAtLevel: number
): CharacterAcquisitionTiming {
  if (source.kind === 'CLASS') {
    return {
      kind: 'CLASS_LEVEL',
      classId: source.classId,
      classLevel: availableAtLevel
    }
  }

  if (source.kind === 'SUBCLASS') {
    const owningClass = character.intent.classes.find(
      (entry) => entry.subclassId === source.subclassId
    )
    if (owningClass) {
      return {
        kind: 'CLASS_LEVEL',
        classId: owningClass.classId,
        classLevel: availableAtLevel
      }
    }
  }

  return { kind: 'IMMEDIATE' }
}

export function toCharacterEngineFeatureSource(source: CharacterProvenance): EngineFeatureSource {
  return source
}

export function toCharacterEngineFeatureTiming(
  timing: CharacterAcquisitionTiming
): EngineFeatureTiming {
  return timing
}

export function isAbilityCode(value: string): value is keyof typeof ABILITIES {
  return value in ABILITIES
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

function toSkillCanonicalCode(value: string | undefined): string {
  if (!value) return ''
  return value.toLowerCase().trim().replace(/_/g, '-').replace(/\s+/g, '-')
}

export function toSkillFallbackCode(slug: string): string {
  return slug.toUpperCase().replace(/-/g, '_')
}

export function toSkillFallbackLabel(slug: string): string {
  return slug
    .split('-')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

export function resolveAbilityCode(subjectId: string): keyof typeof ABILITIES | undefined {
  const direct = ABILITY_CANONICAL_BY_ALIAS.get(subjectId)
  if (direct && isAbilityCode(direct)) return direct

  const upper = ABILITY_CANONICAL_BY_ALIAS.get(subjectId.toUpperCase())
  return upper && isAbilityCode(upper) ? upper : undefined
}

export function createSkillReference(
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
        skillId: skill.id,
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

export const ENGINE_ABILITY_ALIASES: Readonly<Record<string, string>> = {
  STRENGTH: 'STR',
  DEXTERITY: 'DEX',
  CONSTITUTION: 'CON',
  INTELLIGENCE: 'INT',
  WISDOM: 'WIS',
  CHARISMA: 'CHA'
}

export function getAbilityDerivedTotal(
  values: Readonly<Record<string, number>>,
  ability: keyof typeof ABILITIES
): number {
  const alias = ENGINE_ABILITY_ALIASES[ability]
  return values[ability] ?? (alias ? values[alias] : undefined) ?? 0
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

export function classSpellSelectionKey(classId: string, spellId: string): string {
  return `${classId}:${spellId}`
}

export function getClassSpellSelectionSources(
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
  movementDisplayPreference: CharacterMovementDisplayPreference = { mode: 'AUTO' },
  companions: CharacterBuildSnapshot['companions'] = []
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
      companions,
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
  companions?: CharacterBuildSnapshot['companions']
}): EngineCharacterOutput {
  const engineInput = createCharacterEngineInput(
    params.character,
    params.resolution,
    params.adjustments,
    params.movementDisplayPreference,
    params.companions
  )
  const rulesSystem = resolveRulesSystem({
    code: params.resolution.registry.system?.rulesetCode ?? '',
    version: params.resolution.registry.system?.rulesetVersion ?? ''
  })
  return runEngine(engineInput.snapshot, engineInput.registry, rulesSystem)
}
