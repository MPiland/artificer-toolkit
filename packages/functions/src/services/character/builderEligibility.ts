import {
  ABILITY_CODE,
  applyGrants,
  CLASS_CATEGORY,
  CHARACTER_ABILITY_GENERATION_METHOD,
  createCharacterEligibilityContext,
  evaluateCharacterFacet,
  POINT_BUY_SCORE_REGISTRY,
  POINT_BUY_TOTAL_POINTS,
  RACE_CATEGORY_CODE,
  resolveRulesSystem,
  resolveSpellGrantState,
  runEngine,
  type AbilityCode,
  type CharacterBuildSnapshot,
  type CharacterEligibilityContext
} from '@artificer-toolkit/shared/core'
import { evaluateMulticlassRequirements } from '@artificer-toolkit/shared/character'
import {
  getSelectedFeatureOptionIds,
  type CharacterChosenGrantOwner
} from './chosenGrantChoiceResolver.js'
import {
  createCharacterAssemblyRegistry,
  toCharacterEngineFeatureSource,
  toCharacterEngineFeatureTiming
} from './characterEngine.js'
import type {
  BackgroundAuthored,
  CharacterAbilityScoresIntent,
  CharacterAcquisitionTiming,
  CharacterAuthored,
  CharacterClassIntent,
  CharacterProvenance,
  CharacterResourceGrantRecord,
  ClassAuthored,
  ParentClassAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import { isSameCharacterProvenanceIdentity } from '@artificer-toolkit/shared/subjects/authored'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import type { ResolvedRace } from '@artificer-toolkit/shared/subjects/compilers'
import type {
  CharacterBuilderClassCatalogRecord,
  CharacterBuilderCatalog
} from './builderCatalog.js'
import type { CharacterBuilderRegistry, CharacterBuilderValidation } from './builderService.js'

export const abilityOrder: AbilityCode[] = [
  ABILITY_CODE.STRENGTH,
  ABILITY_CODE.DEXTERITY,
  ABILITY_CODE.CONSTITUTION,
  ABILITY_CODE.INTELLIGENCE,
  ABILITY_CODE.WISDOM,
  ABILITY_CODE.CHARISMA
]

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

type CharacterBuilderGrantedFeatureLookup = readonly {
  feature: Pick<FeatureAuthored, 'id'>
}[]

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

export function appendAbilityIntentValidationIssues(
  character: CharacterAuthored,
  validations: CharacterBuilderValidation[]
): void {
  const abilities = character.intent.abilities
  const assignments =
    abilities.method === CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED
      ? abilities.state.assignments
      : abilities.assignments
  const assignedAbilities = assignments.map((assignment) => assignment.ability)

  if (
    assignments.length > abilityOrder.length ||
    new Set(assignedAbilities).size !== assignedAbilities.length
  ) {
    validations.push({
      code: 'MALFORMED_ABILITY_ASSIGNMENTS',
      severity: 'blocking',
      message: 'Each ability can be assigned only once.'
    })
  }

  if (abilities.method === CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY) {
    const options = abilities.assignments.map((assignment) => assignment.option)
    if (new Set(options).size !== options.length) {
      validations.push({
        code: 'STANDARD_ARRAY_SCORE_REUSE',
        severity: 'blocking',
        message: 'Each Standard Array score can be used only once.'
      })
    }
  }

  if (abilities.method === CHARACTER_ABILITY_GENERATION_METHOD.POINT_BUY) {
    const spent = abilities.assignments.reduce(
      (total, assignment) => total + POINT_BUY_SCORE_REGISTRY[assignment.option].cost,
      0
    )
    if (spent > POINT_BUY_TOTAL_POINTS) {
      validations.push({
        code: 'POINT_BUY_OVERSPEND',
        severity: 'blocking',
        message: `Point Buy assignments exceed the ${POINT_BUY_TOTAL_POINTS}-point maximum.`
      })
    }
  }
}

export function getAvailableSubclassesForClass(params: {
  classId: string
  classLevel: number
  catalog: CharacterBuilderCatalog
  registry: CharacterBuilderRegistry
}): CharacterBuilderClassCatalogRecord[] {
  const baseClass = params.registry.classes.find(
    (record): record is ParentClassAuthored =>
      record.category === CLASS_CATEGORY.BASE && record.id === params.classId
  )

  if (
    baseClass?.subclassSelectionLevel === undefined ||
    params.classLevel < baseClass.subclassSelectionLevel
  ) {
    return []
  }

  return params.catalog.classes.filter(
    (record) =>
      record.category === CLASS_CATEGORY.SUBCLASS && record.parentClassId === params.classId
  )
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

export function validateMulticlass(
  classSelections: ResolvedClassSelection[],
  abilityScores: Partial<Record<AbilityCode, number>>
): CharacterBuilderValidation[] {
  if (classSelections.length <= 1) return []

  const validations: CharacterBuilderValidation[] = []
  for (const selection of classSelections) {
    const baseClass = selection.baseClass
    if (!baseClass) continue

    if (
      !evaluateMulticlassRequirements(baseClass.multiclass.requirementGroups, abilityScores).passes
    ) {
      validations.push({
        code: 'MULTICLASS_PREREQUISITE_UNMET',
        severity: 'blocking',
        message: `Multiclass prerequisites are not met for ${baseClass.label}.`
      })
    }
  }

  return validations
}

export function isValidAncestrySource(
  character: CharacterAuthored,
  source: Extract<CharacterProvenance, { kind: 'RACE' | 'SUBRACE' }>
): boolean {
  if (source.kind === 'RACE') return character.intent.race.raceId === source.raceId
  return character.intent.race.subraceId === source.subraceId
}

function isClassSourceLevelStillAvailable(
  source: Extract<CharacterProvenance, { kind: 'CLASS' | 'SUBCLASS' }>,
  row: CharacterClassIntent
): boolean {
  return source.classLevel == null || source.classLevel <= row.classLevel
}

function getCharacterRaceSelection(
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

export function isCharacterBuilderProvenanceStillValid({
  source,
  character,
  registry,
  grantedFeatures = []
}: {
  source: CharacterProvenance
  character: CharacterAuthored
  registry: CharacterBuilderRegistry
  grantedFeatures?: CharacterBuilderGrantedFeatureLookup
}): boolean {
  switch (source.kind) {
    case 'CLASS':
      return character.intent.classes.some(
        (row) => row.classId === source.classId && isClassSourceLevelStillAvailable(source, row)
      )
    case 'SUBCLASS':
      return character.intent.classes.some(
        (row) =>
          row.subclassId === source.subclassId && isClassSourceLevelStillAvailable(source, row)
      )
    case 'RACE':
      return character.intent.race.raceId === source.raceId
    case 'SUBRACE':
      return character.intent.race.subraceId === source.subraceId
    case 'ANCESTRY': {
      const { ancestryRace, selectedAncestry, selectedAncestryOption } = getCharacterRaceSelection(
        character,
        registry
      )
      return Boolean(
        ancestryRace?.ancestry &&
        selectedAncestry &&
        selectedAncestryOption &&
        selectedAncestry.ancestryId === source.ancestryId &&
        selectedAncestry.optionId === source.optionId
      )
    }
    case 'BACKGROUND':
      return character.intent.background.backgroundId === source.backgroundId
    case 'FEAT':
      return true
    case 'FEATURE':
      return grantedFeatures.some((record) => record.feature.id === source.featureId)
    case 'OPTION':
      return character.intent.featureAcquisitions.some(
        (record) => record.id === source.acquiredParentId
      )
    case 'MANUAL':
      return true
    default:
      return false
  }
}

export function isProvenanceStillValid(
  source: CharacterProvenance,
  character: CharacterAuthored,
  registry: CharacterBuilderRegistry,
  grantedFeatures: GrantedFeatureRecord[]
): boolean {
  return isCharacterBuilderProvenanceStillValid({
    source,
    character,
    registry,
    grantedFeatures
  })
}

export function getRequiredClassResourceGrants(
  classSelections: ResolvedClassSelection[]
): CharacterResourceGrantRecord[] {
  return classSelections.flatMap((selection) => {
    const grants: CharacterResourceGrantRecord[] = []

    if (
      selection.baseClass?.resources &&
      selection.baseClass.resources.availableAtLevel <= selection.row.classLevel
    ) {
      grants.push({
        id: `resource:${selection.baseClass.id}:${selection.baseClass.resources.id}`,
        resourceId: selection.baseClass.resources.id,
        source: {
          kind: 'CLASS',
          classId: selection.baseClass.id,
          classLevel: selection.baseClass.resources.availableAtLevel
        },
        timing: {
          kind: 'CLASS_LEVEL',
          classId: selection.baseClass.id,
          classLevel: selection.baseClass.resources.availableAtLevel
        }
      })
    }

    if (
      selection.subclass?.resources &&
      selection.subclass.resources.availableAtLevel <= selection.row.classLevel
    ) {
      grants.push({
        id: `resource:${selection.subclass.id}:${selection.subclass.resources.id}`,
        resourceId: selection.subclass.resources.id,
        source: {
          kind: 'SUBCLASS',
          subclassId: selection.subclass.id,
          classLevel: selection.subclass.resources.availableAtLevel
        },
        timing: {
          kind: 'CLASS_LEVEL',
          classId: selection.row.classId,
          classLevel: selection.subclass.resources.availableAtLevel
        }
      })
    }

    return grants
  })
}

export function mergeRequiredResourceGrants(
  currentGrants: CharacterResourceGrantRecord[],
  requiredGrants: CharacterResourceGrantRecord[]
): CharacterResourceGrantRecord[] {
  const grants = [...currentGrants]

  for (const requiredGrant of requiredGrants) {
    const hasGrant = grants.some((grant) => isSameRequiredResourceGrant(grant, requiredGrant))
    if (!hasGrant) {
      grants.push(requiredGrant)
    }
  }

  return grants
}

export function isSameRequiredResourceGrant(
  left: CharacterResourceGrantRecord,
  right: CharacterResourceGrantRecord
): boolean {
  return (
    left.resourceId === right.resourceId &&
    isSameRequiredResourceGrantSource(left.source, right.source)
  )
}

function isSameRequiredResourceGrantSource(
  left: CharacterProvenance,
  right: CharacterProvenance
): boolean {
  if (left.kind !== right.kind) return false

  if (left.kind === 'CLASS' && right.kind === 'CLASS') {
    return left.classId === right.classId
  }

  if (left.kind === 'SUBCLASS' && right.kind === 'SUBCLASS') {
    return left.subclassId === right.subclassId
  }

  return isSameCharacterProvenanceIdentity(left, right)
}

type SpellGrantFeature = {
  id: string
  grants?: { spells?: readonly unknown[] }
  options?: ReadonlyArray<{
    id: string
    grants?: { spells?: readonly unknown[] }
  }>
}

export function featureContributesSpellGrant(
  feature: SpellGrantFeature,
  character: CharacterAuthored,
  source?: CharacterProvenance
): boolean {
  if (feature.grants?.spells?.length) return true
  if (!feature.options?.length) return false
  if (!source) {
    return feature.options.some((option) => Boolean(option.grants?.spells?.length))
  }

  const acquisition = character.intent.featureAcquisitions.find(
    (record) =>
      record.featureId === feature.id && isSameCharacterProvenanceIdentity(record.source, source)
  )
  const selectedOptionIds = new Set(
    acquisition?.selections
      ?.filter((selection) => selection.selectionKey === 'options')
      .flatMap((selection) =>
        selection.values.flatMap((value) => {
          if (value.kind === 'ID') return [value.id]
          if (value.kind === 'IDS') return value.ids
          return []
        })
      ) ?? []
  )
  return feature.options.some(
    (option) => selectedOptionIds.has(option.id) && Boolean(option.grants?.spells?.length)
  )
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

export function getCharacterChosenGrantOwners(
  character: CharacterAuthored,
  classSelections: ResolvedClassSelection[],
  selectedBackground: BackgroundAuthored | undefined,
  grantedFeatures: GrantedFeatureRecord[]
): CharacterChosenGrantOwner[] {
  const owners: CharacterChosenGrantOwner[] = []

  classSelections.forEach((selection, index) => {
    const classProficiencies =
      index === 0
        ? selection.baseClass?.proficiencies
        : selection.baseClass?.multiclass.proficiencies

    if (classProficiencies?.length && selection.baseClass) {
      const source = {
        kind: 'CLASS',
        classId: selection.baseClass.id,
        classLevel: 1
      } as const
      owners.push({
        label: selection.baseClass.label,
        sourceLabel: selection.baseClass.label,
        source,
        timing: {
          kind: 'CLASS_LEVEL',
          classId: selection.baseClass.id,
          classLevel: 1
        },
        activeLevel: selection.row.classLevel,
        grants: { proficiencies: classProficiencies }
      })
    }

    if (selection.subclass?.proficiencies?.length) {
      const subclassSelectionLevel = selection.baseClass?.subclassSelectionLevel ?? 1
      const source = {
        kind: 'SUBCLASS',
        subclassId: selection.subclass.id,
        classLevel: subclassSelectionLevel
      } as const
      owners.push({
        label: selection.subclass.label,
        sourceLabel: selection.subclass.label,
        source,
        timing: {
          kind: 'CLASS_LEVEL',
          classId: selection.row.classId,
          classLevel: subclassSelectionLevel
        },
        activeLevel: selection.row.classLevel,
        grants: { proficiencies: selection.subclass.proficiencies }
      })
    }
  })

  if (selectedBackground?.proficiencies?.length) {
    owners.push({
      label: selectedBackground.label,
      sourceLabel: selectedBackground.label,
      source: { kind: 'BACKGROUND', backgroundId: selectedBackground.id },
      timing: { kind: 'IMMEDIATE' },
      activeLevel: Math.max(
        character.intent.classes.reduce((total, row) => total + row.classLevel, 0),
        1
      ),
      grants: { proficiencies: selectedBackground.proficiencies }
    })
  }

  for (const granted of grantedFeatures) {
    const timing = getChosenGrantOwnerTiming(character, granted)
    if (granted.feature.grants) {
      owners.push({
        label: granted.feature.label,
        ownerFeatureId: granted.feature.id,
        sourceLabel: granted.sourceLabel,
        source: granted.source,
        timing,
        activeLevel: granted.level,
        grants: granted.feature.grants
      })
    }

    const acquisition = character.intent.featureAcquisitions.find(
      (record) =>
        record.featureId === granted.feature.id &&
        isSameCharacterProvenanceIdentity(record.source, granted.source)
    )
    const selectedOptionIds = new Set(
      getSelectedFeatureOptionIds(granted.feature, character, granted.source)
    )
    for (const option of granted.feature.options ?? []) {
      if (!acquisition || !selectedOptionIds.has(option.id) || !option.grants) continue
      owners.push({
        label: option.label,
        ownerFeatureId: granted.feature.id,
        sourceLabel: granted.sourceLabel,
        source: {
          kind: 'OPTION',
          acquiredParentId: acquisition.id,
          optionId: option.id
        },
        timing,
        activeLevel: granted.level,
        grants: option.grants
      })
    }
  }

  return owners
}

function getChosenGrantOwnerTiming(
  character: CharacterAuthored,
  granted: GrantedFeatureRecord
): CharacterAcquisitionTiming {
  const availableAtLevel = granted.feature.availableAtLevel ?? 1
  if (granted.source.kind === 'CLASS') {
    return {
      kind: 'CLASS_LEVEL',
      classId: granted.source.classId,
      classLevel: availableAtLevel
    }
  }

  if (granted.source.kind === 'SUBCLASS') {
    const subclassId = granted.source.subclassId
    const owningClass = character.intent.classes.find((record) => record.subclassId === subclassId)
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

function createCharacterBuilderEvaluationSnapshot(
  character: CharacterAuthored,
  grantedFeatures: readonly GrantedFeatureRecord[],
  abilityScores: Partial<Record<AbilityCode, number>>
): CharacterBuildSnapshot {
  const abilities: Record<string, number> = {}
  for (const [ability, score] of Object.entries(abilityScores)) {
    if (typeof score === 'number') abilities[ability] = score
  }

  const automaticFeatures = grantedFeatures.map((granted) => {
    const acquisition = character.intent.featureAcquisitions.find(
      (candidate) =>
        candidate.featureId === granted.feature.id &&
        isSameCharacterProvenanceIdentity(candidate.source, granted.source)
    )
    const timing = acquisition?.timing ?? getChosenGrantOwnerTiming(character, granted)

    return {
      ...(acquisition ? { acquisitionId: acquisition.id } : {}),
      featureId: granted.feature.id,
      source: toCharacterEngineFeatureSource(granted.source),
      timing: toCharacterEngineFeatureTiming(timing),
      ...(acquisition?.selections ? { selections: acquisition.selections } : {})
    }
  })
  const explicitFeatures = character.intent.featureAcquisitions
    .filter(
      (acquisition) =>
        !grantedFeatures.some(
          (granted) =>
            acquisition.featureId === granted.feature.id &&
            isSameCharacterProvenanceIdentity(acquisition.source, granted.source)
        )
    )
    .map((acquisition) => ({
      acquisitionId: acquisition.id,
      featureId: acquisition.featureId,
      source: toCharacterEngineFeatureSource(acquisition.source),
      timing: toCharacterEngineFeatureTiming(acquisition.timing),
      ...(acquisition.selections ? { selections: acquisition.selections } : {})
    }))

  return {
    characterId: character.id,
    systemId: character.systemId,
    totalLevel: character.intent.classes.reduce((sum, entry) => sum + entry.classLevel, 0),
    raceId: character.intent.race.raceId,
    subraceId: character.intent.race.subraceId,
    backgroundId: character.intent.background.backgroundId,
    chosenGrantSelections: character.intent.chosenGrantSelections ?? [],
    classes: character.intent.classes.map((entry) => ({
      classId: entry.classId,
      level: entry.classLevel,
      subclassId: entry.subclassId,
      specializationId: entry.specializationId
    })),
    abilities,
    hitpoints: [],
    features: [...automaticFeatures, ...explicitFeatures],
    equipmentItems: []
  }
}

export function resolveCharacterBuilderEffectiveAbilityScores(
  character: CharacterAuthored,
  registry: CharacterBuilderRegistry,
  grantedFeatures: readonly GrantedFeatureRecord[]
): Partial<Record<AbilityCode, number>> {
  const assignedAbilityScores = deriveAbilityScores(character.intent.abilities)
  if (!registry.system) return assignedAbilityScores

  const engineOutput = runEngine(
    createCharacterBuilderEvaluationSnapshot(character, grantedFeatures, assignedAbilityScores),
    createCharacterAssemblyRegistry(registry),
    resolveRulesSystem({
      code: registry.system.rulesetCode,
      version: registry.system.rulesetVersion
    })
  )
  const effectiveAbilityScores: Partial<Record<AbilityCode, number>> = {}
  for (const ability of abilityOrder) {
    const score = engineOutput.derivedStats.abilityScores[ability]
    if (typeof score === 'number') effectiveAbilityScores[ability] = score
  }

  return effectiveAbilityScores
}

export function createCharacterBuilderEligibilityContext(params: {
  character: CharacterAuthored
  registry: CharacterBuilderRegistry
  grantedFeatures: readonly GrantedFeatureRecord[]
  abilityScores: Partial<Record<AbilityCode, number>>
}): {
  context: CharacterEligibilityContext
  registry: ReturnType<typeof createCharacterAssemblyRegistry>
} {
  const registry = createCharacterAssemblyRegistry(params.registry)
  const snapshot = createCharacterBuilderEvaluationSnapshot(
    params.character,
    params.grantedFeatures,
    params.abilityScores
  )
  const rulesSystem = resolveRulesSystem({
    code: params.registry.system?.rulesetCode ?? '',
    version: params.registry.system?.rulesetVersion ?? ''
  })
  const { spellAccess } = resolveSpellGrantState(snapshot, registry)
  const accumulatedState = applyGrants(snapshot, registry, rulesSystem, spellAccess)

  return {
    context: createCharacterEligibilityContext(snapshot, spellAccess, accumulatedState),
    registry
  }
}

type FeatureOptionEligibility = {
  character: CharacterAuthored
  optionsByFeatureId: ReadonlyMap<string, NonNullable<FeatureAuthored['options']>>
}

function getFeatureOptionsById(
  grantedFeatures: readonly GrantedFeatureRecord[],
  context?: CharacterEligibilityContext,
  registry?: ReturnType<typeof createCharacterAssemblyRegistry>
): Map<string, NonNullable<FeatureAuthored['options']>> {
  return new Map(
    grantedFeatures.map(({ feature }) => [
      feature.id,
      (feature.options ?? []).filter(
        (option) =>
          !context ||
          !registry ||
          evaluateCharacterFacet(option.restrictions, context, registry).passed
      )
    ])
  )
}

function filterFeatureOptionSelections(
  character: CharacterAuthored,
  grantedFeatures: readonly GrantedFeatureRecord[],
  optionsByFeatureId: ReadonlyMap<string, NonNullable<FeatureAuthored['options']>>
): { character: CharacterAuthored; changed: boolean } {
  let changed = false
  const featureAcquisitions = character.intent.featureAcquisitions.map((acquisition) => {
    let acquisitionChanged = false
    const granted = grantedFeatures.find(
      (candidate) =>
        candidate.feature.id === acquisition.featureId &&
        isSameCharacterProvenanceIdentity(candidate.source, acquisition.source)
    )
    if (!granted || !acquisition.selections?.length) return acquisition

    const eligibleOptionIds = new Set(
      (optionsByFeatureId.get(granted.feature.id) ?? []).map((option) => option.id)
    )
    const selections: NonNullable<typeof acquisition.selections> = []
    for (const selection of acquisition.selections) {
      if (selection.selectionKey !== 'options') {
        selections.push(selection)
        continue
      }

      const values: typeof selection.values = []
      for (const value of selection.values) {
        if (value.kind === 'ID') {
          if (eligibleOptionIds.has(value.id)) values.push(value)
          else acquisitionChanged = true
          continue
        }
        if (value.kind === 'IDS') {
          const ids = value.ids.filter((id) => eligibleOptionIds.has(id))
          if (ids.length === value.ids.length) values.push(value)
          else {
            acquisitionChanged = true
            if (ids.length > 0) values.push({ ...value, ids })
          }
          continue
        }

        values.push(value)
      }

      if (values.length > 0) selections.push({ ...selection, values })
    }
    if (!acquisitionChanged) return acquisition

    changed = true
    const nextAcquisition = { ...acquisition }
    if (selections.length > 0) nextAcquisition.selections = selections
    else delete nextAcquisition.selections
    return nextAcquisition
  })

  if (!changed) return { character, changed: false }
  return {
    character: {
      ...character,
      intent: {
        ...character.intent,
        featureAcquisitions
      }
    },
    changed: true
  }
}

export function resolveFeatureOptionEligibility(params: {
  character: CharacterAuthored
  registry: CharacterBuilderRegistry
  grantedFeatures: readonly GrantedFeatureRecord[]
  abilityScores: Partial<Record<AbilityCode, number>>
}): FeatureOptionEligibility {
  const hasRestrictions = params.grantedFeatures.some((granted) =>
    granted.feature.options?.some((option) => Boolean(option.restrictions))
  )
  if (!hasRestrictions) {
    return {
      character: params.character,
      optionsByFeatureId: getFeatureOptionsById(params.grantedFeatures)
    }
  }

  let candidate = params.character
  while (true) {
    const { context, registry } = createCharacterBuilderEligibilityContext({
      ...params,
      character: candidate
    })
    const optionsByFeatureId = getFeatureOptionsById(params.grantedFeatures, context, registry)
    const filtered = filterFeatureOptionSelections(
      candidate,
      params.grantedFeatures,
      optionsByFeatureId
    )
    if (!filtered.changed) return { character: candidate, optionsByFeatureId }
    candidate = filtered.character
  }
}

function filterFeatureOptions(
  feature: FeatureAuthored,
  optionsByFeatureId: ReadonlyMap<string, NonNullable<FeatureAuthored['options']>>
): FeatureAuthored {
  const options = optionsByFeatureId.get(feature.id)
  return options ? { ...feature, options: [...options] } : feature
}

export function filterRegistryFeatureOptions(
  registry: CharacterBuilderRegistry,
  optionsByFeatureId: ReadonlyMap<string, NonNullable<FeatureAuthored['options']>>
): CharacterBuilderRegistry {
  const mapFeatures = (features: FeatureAuthored[] | undefined) =>
    features?.map((feature) => filterFeatureOptions(feature, optionsByFeatureId))

  return {
    ...registry,
    features: mapFeatures(registry.features) ?? [],
    races: registry.races.map((race) => ({
      ...race,
      features: mapFeatures(race.features),
      ancestry: race.ancestry
        ? {
            ...race.ancestry,
            options: race.ancestry.options.map((option) => ({
              ...option,
              features: mapFeatures(option.features)
            }))
          }
        : undefined
    })),
    classes: registry.classes.map((record) => ({
      ...record,
      features: mapFeatures(record.features)
    })),
    backgrounds: registry.backgrounds.map((background) => ({
      ...background,
      features: mapFeatures(background.features)
    }))
  }
}
