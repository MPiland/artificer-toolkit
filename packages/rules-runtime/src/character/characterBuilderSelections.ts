import {
  CLASS_CATEGORY,
  CHARACTER_ABILITY_GENERATION_METHOD,
  RACE_CATEGORY_CODE
} from '@artificer-toolkit/shared/core'
import type {
  CharacterAcquisitionTiming,
  CharacterAbilityScoresIntent,
  CharacterAuthored,
  CharacterClassIntent,
  CharacterFeatureAcquisitionRecord,
  CharacterProvenance
} from '@artificer-toolkit/shared/subjects/authored'
import type { CompiledFeature } from '@artificer-toolkit/shared/compilers'
import type {
  CompiledBackground,
  CompiledClass,
  CompiledClassResource,
  CompiledRace,
  CompiledSpellcasting
} from '@artificer-toolkit/shared/subjects/compilers'

import type { CharacterRuleRegistry } from './characterRuleContext.js'
import { isSameCharacterProvenanceIdentity } from '@artificer-toolkit/shared/subjects/authored'

type CompiledBaseClass = Extract<CompiledClass, { category: typeof CLASS_CATEGORY.BASE }>
type CompiledSubclass = Extract<CompiledClass, { category: typeof CLASS_CATEGORY.SUBCLASS }>

export type ResolvedClassSelection = {
  row: CharacterClassIntent
  baseClass?: CompiledBaseClass
  subclass?: CompiledSubclass
  features: CompiledFeature[]
  resources: CompiledClassResource[]
  spellcasting: CompiledSpellcasting[]
}

export type GrantedFeatureRecord = {
  feature: CompiledFeature
  source: CharacterProvenance
  sourceLabel: string
  level: number
}

export function isCharacterAcquisitionTimingAvailable(
  character: CharacterAuthored,
  timing: CharacterAcquisitionTiming
): boolean {
  if (timing.kind === 'IMMEDIATE') return true
  if (timing.kind === 'CLASS_LEVEL') {
    return (
      (character.intent.classes.find((row) => row.classId === timing.classId)?.classLevel ?? 0) >=
      timing.classLevel
    )
  }
  return (
    Math.max(
      character.intent.classes.reduce((sum, row) => sum + row.classLevel, 0),
      1
    ) >= timing.level
  )
}

export function findCurrentCharacterFeatureAcquisition(
  character: CharacterAuthored,
  featureId: string,
  source: CharacterProvenance
): CharacterFeatureAcquisitionRecord | undefined {
  return character.intent.featureAcquisitions.find(
    (record) =>
      record.featureId === featureId &&
      isSameCharacterProvenanceIdentity(record.source, source) &&
      isCharacterAcquisitionTimingAvailable(character, record.timing)
  )
}

export function isCharacterFeatAcquisitionValid(
  acquisition: CharacterFeatureAcquisitionRecord,
  registry: CharacterRuleRegistry
): boolean {
  const source = acquisition.source
  if (source.kind !== 'FEAT') return true
  const feat = registry.feats?.find((record) => record.id === source.featId)
  return Boolean(
    feat &&
    (acquisition.featureId === feat.id ||
      feat.features?.some((feature) => feature.id === acquisition.featureId))
  )
}

/** Shared current feature set for Builder choices, mechanics and Sheet references. */
export function collectCharacterBuilderFeatures(
  character: CharacterAuthored,
  registry: CharacterRuleRegistry,
  structural: readonly GrantedFeatureRecord[]
): GrantedFeatureRecord[] {
  const result = [...structural]
  const totalLevel = Math.max(
    character.intent.classes.reduce((sum, row) => sum + row.classLevel, 0),
    1
  )
  for (const acquisition of character.intent.featureAcquisitions) {
    if (!isCharacterFeatAcquisitionValid(acquisition, registry)) continue
    const timing = acquisition.timing
    if (!isCharacterAcquisitionTimingAvailable(character, timing)) continue
    const source = acquisition.source
    const level =
      source.kind !== 'FEAT' && timing.kind === 'CLASS_LEVEL'
        ? (character.intent.classes.find((row) => row.classId === timing.classId)?.classLevel ?? 0)
        : totalLevel
    const feat =
      source.kind === 'FEAT' ? registry.feats?.find((row) => row.id === source.featId) : undefined
    const feature = (feat?.features ?? registry.features).find(
      (row) => row.id === acquisition.featureId
    )
    if (
      !feature ||
      (feature.availableAtLevel ?? 1) > level ||
      result.some(
        (row) =>
          row.feature.id === feature.id && isSameCharacterProvenanceIdentity(row.source, source)
      )
    )
      continue
    result.push({ feature, source, sourceLabel: feat?.label ?? feature.label, level })
  }
  return result
}

export function deriveAbilityScores(
  abilities: CharacterAbilityScoresIntent
): Record<string, number> {
  switch (abilities.method) {
    case CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY:
    case CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY:
      return Object.fromEntries(
        abilities.assignments.map((assignment) => [assignment.ability, Number(assignment.option)])
      )
    case CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED:
      return Object.fromEntries(
        abilities.state.assignments.map((assignment) => [assignment.ability, assignment.score])
      )
    default:
      return {}
  }
}

function loadClassSelection(
  row: CharacterClassIntent,
  registry: CharacterRuleRegistry
): ResolvedClassSelection {
  const baseClass = registry.classes.find(
    (record): record is CompiledBaseClass =>
      record.category === CLASS_CATEGORY.BASE && record.id === row.classId
  )
  const subclass = row.subclassId
    ? registry.classes.find(
        (record): record is CompiledSubclass =>
          record.category === CLASS_CATEGORY.SUBCLASS && record.id === row.subclassId
      )
    : undefined
  const baseFeatures = (baseClass?.features ?? []).filter(
    (feature) => (feature.availableAtLevel ?? 0) <= row.classLevel
  )
  const subclassFeatures = (subclass?.features ?? []).filter(
    (feature) => (feature.availableAtLevel ?? 0) <= row.classLevel
  )
  const resources = [
    ...(baseClass?.resources && baseClass.resources.availableAtLevel <= row.classLevel
      ? [baseClass.resources]
      : []),
    ...(subclass?.resources && subclass.resources.availableAtLevel <= row.classLevel
      ? [subclass.resources]
      : [])
  ]
  const spellcasting = [
    ...(baseClass?.spellcasting && (baseClass.spellcasting.availableAtLevel ?? 1) <= row.classLevel
      ? [baseClass.spellcasting]
      : []),
    ...(subclass?.spellcasting && (subclass.spellcasting.availableAtLevel ?? 1) <= row.classLevel
      ? [subclass.spellcasting]
      : [])
  ]
  return {
    row,
    baseClass,
    subclass,
    features: [...baseFeatures, ...subclassFeatures],
    resources,
    spellcasting
  }
}

export function isValidAncestrySource(
  character: CharacterAuthored,
  source: Extract<CharacterProvenance, { kind: 'RACE' | 'SUBRACE' }>
): boolean {
  if (source.kind === 'RACE') return character.intent.race.raceId === source.raceId
  return character.intent.race.subraceId === source.subraceId
}

export function getCharacterRaceSelection(
  character: CharacterAuthored,
  registry: CharacterRuleRegistry
): {
  baseRace?: CompiledRace
  selectedRace?: CompiledRace
  ancestryRace?: CompiledRace
  selectedAncestry?: NonNullable<CharacterAuthored['intent']['ancestrySelections']>[number]
  selectedAncestryOption?: NonNullable<CompiledRace['ancestry']>['options'][number]
} {
  const baseRace = character.intent.race.raceId
    ? registry.races.find(
        (record) =>
          record.category === RACE_CATEGORY_CODE.BASE && record.id === character.intent.race.raceId
      )
    : undefined
  const selectedRace = character.intent.race.subraceId
    ? registry.races.find((record) => record.id === character.intent.race.subraceId)
    : baseRace
  const ancestryRace = selectedRace?.ancestry
    ? selectedRace
    : baseRace?.ancestry
      ? baseRace
      : undefined
  const selectedAncestry = ancestryRace?.ancestry
    ? character.intent.ancestrySelections?.find(
        (selection) => selection.ancestryId === ancestryRace.ancestry?.id
      )
    : undefined
  const selectedAncestryOption =
    selectedAncestry && isValidAncestrySource(character, selectedAncestry.source)
      ? ancestryRace?.ancestry?.options.find((option) => option.id === selectedAncestry.optionId)
      : undefined
  return {
    baseRace,
    selectedRace,
    ancestryRace,
    selectedAncestry,
    selectedAncestryOption
  }
}

export function collectGrantedFeaturesForCharacter(
  character: CharacterAuthored,
  registry: CharacterRuleRegistry
): {
  classSelections: ResolvedClassSelection[]
  totalLevel: number
  baseRace?: CompiledRace
  selectedRace?: CompiledRace
  ancestryRace?: CompiledRace
  selectedBackground?: CompiledBackground
  selectedAncestry?: NonNullable<CharacterAuthored['intent']['ancestrySelections']>[number]
  selectedAncestryOption?: NonNullable<CompiledRace['ancestry']>['options'][number]
  grantedFeatures: GrantedFeatureRecord[]
} {
  const classSelections = character.intent.classes.map((row) => loadClassSelection(row, registry))
  const totalLevel = character.intent.classes.reduce((sum, row) => sum + row.classLevel, 0)
  const { baseRace, selectedRace, ancestryRace, selectedAncestry, selectedAncestryOption } =
    getCharacterRaceSelection(character, registry)
  const selectedBackground = character.intent.background.backgroundId
    ? registry.backgrounds.find((record) => record.id === character.intent.background.backgroundId)
    : undefined
  const grantedFeatures: GrantedFeatureRecord[] = []

  if (baseRace?.features?.length) {
    for (const feature of baseRace.features) {
      grantedFeatures.push({
        feature,
        source: { kind: 'RACE', raceId: baseRace.id },
        sourceLabel: baseRace.label,
        level: totalLevel
      })
    }
  }
  if (selectedRace && selectedRace.id !== baseRace?.id && selectedRace.features?.length) {
    const inheritedFeatureIds = new Set(
      selectedRace.category === RACE_CATEGORY_CODE.SUBRACE
        ? (selectedRace.inheritedFeatureIds ?? [])
        : []
    )
    for (const feature of selectedRace.features) {
      if (inheritedFeatureIds.has(feature.id)) continue
      grantedFeatures.push({
        feature,
        source: { kind: 'SUBRACE', subraceId: selectedRace.id },
        sourceLabel: selectedRace.label,
        level: totalLevel
      })
    }
  }
  if (selectedAncestryOption?.features?.length && ancestryRace?.ancestry) {
    for (const feature of selectedAncestryOption.features) {
      grantedFeatures.push({
        feature,
        source: {
          kind: 'ANCESTRY',
          ancestryId: ancestryRace.ancestry.id,
          optionId: selectedAncestryOption.id
        },
        sourceLabel: selectedAncestryOption.label,
        level: totalLevel
      })
    }
  }
  if (selectedBackground?.features?.length) {
    for (const feature of selectedBackground.features) {
      grantedFeatures.push({
        feature,
        source: { kind: 'BACKGROUND', backgroundId: selectedBackground.id },
        sourceLabel: selectedBackground.label,
        level: totalLevel
      })
    }
  }
  for (const selection of classSelections) {
    for (const feature of selection.features) {
      const source =
        selection.subclass &&
        (selection.subclass.features ?? []).some((record) => record.id === feature.id)
          ? ({
              kind: 'SUBCLASS',
              subclassId: selection.subclass.id,
              classLevel: selection.row.classLevel
            } as const)
          : ({
              kind: 'CLASS',
              classId: selection.row.classId,
              classLevel: selection.row.classLevel
            } as const)
      grantedFeatures.push({
        feature,
        source,
        sourceLabel:
          source.kind === 'CLASS'
            ? (selection.baseClass?.label ?? 'Class')
            : (selection.subclass?.label ?? 'Subclass'),
        level: selection.row.classLevel
      })
    }
  }
  const selectedFeatIds = new Set<string>()
  for (const acquisition of character.intent.featureAcquisitions) {
    const source = acquisition.source
    if (
      source.kind !== 'FEAT' ||
      acquisition.featureId !== source.featId ||
      selectedFeatIds.has(source.featId)
    )
      continue
    if (!isCharacterAcquisitionTimingAvailable(character, acquisition.timing)) continue
    const feat = registry.feats?.find((record) => record.id === source.featId)
    if (!feat) continue
    selectedFeatIds.add(feat.id)
    for (const feature of feat.features ?? []) {
      if ((feature.availableAtLevel ?? 1) > Math.max(totalLevel, 1)) continue
      grantedFeatures.push({
        feature,
        source,
        sourceLabel: feat.label,
        level: Math.max(totalLevel, 1)
      })
    }
  }
  return {
    classSelections,
    totalLevel,
    baseRace,
    selectedRace,
    ancestryRace,
    selectedBackground,
    selectedAncestry,
    selectedAncestryOption,
    grantedFeatures
  }
}
