import {
  CLASS_CATEGORY,
  CHARACTER_ABILITY_GENERATION_METHOD,
  RACE_CATEGORY_CODE,
  type AbilityCode
} from '@artificer-toolkit/shared/core'
import type {
  BackgroundAuthored,
  CharacterAbilityScoresIntent,
  CharacterAuthored,
  CharacterClassIntent,
  CharacterProvenance,
  ClassAuthored,
  ParentClassAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import type { ResolvedRace } from '@artificer-toolkit/shared/subjects/compilers'

import type { CharacterBuilderRegistry } from './builderService.js'

export type ResolvedClassSelection = {
  row: CharacterClassIntent
  baseClass?: ParentClassAuthored
  subclass?: Extract<ClassAuthored, { category: typeof CLASS_CATEGORY.SUBCLASS }>
  features: FeatureAuthored[]
  resources: NonNullable<ClassAuthored['resources']>[]
  spellcasting: NonNullable<ClassAuthored['spellcasting']>[]
}

export type GrantedFeatureRecord = {
  feature: FeatureAuthored
  source: CharacterProvenance
  sourceLabel: string
  level: number
}

export function deriveAbilityScores(
  abilities: CharacterAbilityScoresIntent
): Partial<Record<AbilityCode, number>> {
  switch (abilities.method) {
    case CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY:
    case CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY:
      return Object.fromEntries(
        abilities.assignments.map((assignment) => [assignment.ability, Number(assignment.option)])
      ) as Partial<Record<AbilityCode, number>>
    case CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED:
      return Object.fromEntries(
        abilities.state.assignments.map((assignment) => [assignment.ability, assignment.score])
      ) as Partial<Record<AbilityCode, number>>
    default:
      return {}
  }
}

function loadClassSelection(
  row: CharacterClassIntent,
  registry: CharacterBuilderRegistry
): ResolvedClassSelection {
  const baseClass = registry.classes.find(
    (record): record is ParentClassAuthored =>
      record.category === CLASS_CATEGORY.BASE && record.id === row.classId
  )
  const subclass = row.subclassId
    ? registry.classes.find(
        (record): record is Extract<ClassAuthored, { category: typeof CLASS_CATEGORY.SUBCLASS }> =>
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
  registry: CharacterBuilderRegistry
): {
  baseRace?: ResolvedRace
  selectedRace?: ResolvedRace
  ancestryRace?: ResolvedRace
  selectedAncestry?: NonNullable<CharacterAuthored['intent']['ancestrySelections']>[number]
  selectedAncestryOption?: NonNullable<ResolvedRace['ancestry']>['options'][number]
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
  registry: CharacterBuilderRegistry
): {
  classSelections: ResolvedClassSelection[]
  totalLevel: number
  baseRace?: ResolvedRace
  selectedRace?: ResolvedRace
  ancestryRace?: ResolvedRace
  selectedBackground?: BackgroundAuthored
  selectedAncestry?: NonNullable<CharacterAuthored['intent']['ancestrySelections']>[number]
  selectedAncestryOption?: NonNullable<ResolvedRace['ancestry']>['options'][number]
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
        ? (selectedRace.subrace.inherited.features ?? []).map((feature) => feature.id)
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
