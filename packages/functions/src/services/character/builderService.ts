import type { DBLike } from '@artificer-toolkit/db'
import {
  createBackgroundRepository,
  createClassRepository,
  createEquipmentRepository,
  createFeatureRepository,
  createRaceRepository,
  createSpellRepository,
  createSystemRepository
} from '@artificer-toolkit/db'
import {
  ABILITY_CODE,
  ADVANCEMENT_METHOD_CODE,
  AUTHORED_RECORD_STATUS,
  CLASS_CATEGORY,
  CHARACTER_ABILITY_GENERATION_METHOD,
  CharacterStartingEquipmentSource,
  FEATURE_ATTRIBUTE,
  HITPOINT_CALCULATION_METHOD_CODE,
  RACE_CATEGORY_CODE,
  type AbilityCode,
  type AuthoredRecordStatus,
  type BackgroundAuthored,
  type CharacterAbilityScoresIntent,
  type CharacterAncestryAcquisition,
  type CharacterAuthored,
  type CharacterClassIntent,
  type CharacterFeatureAcquisitionRecord,
  type CharacterProvenance,
  type CharacterResourceGrantRecord,
  type CharacterSpellSelectionRecord,
  type ClassAuthored,
  type FeatureAuthored,
  type ParentClassAuthored,
  type ResolvedEquipment,
  type ResolvedRace,
  type SpellAuthored
} from '@artificer-toolkit/shared'
import type { SystemSeedRecord } from '@artificer-toolkit/db'

type BuilderMode = 'create' | 'edit'

export interface CharacterBuilderRegistry {
  system: SystemSeedRecord | null
  races: ResolvedRace[]
  classes: ClassAuthored[]
  backgrounds: BackgroundAuthored[]
  equipment: ResolvedEquipment[]
  spells: SpellAuthored[]
  features: FeatureAuthored[]
}

export interface CharacterBuilderClassSummary {
  classId: string
  classLabel: string
  classLevel: number
  subclassId?: string
  subclassLabel?: string
  specializationId?: string
  specializationLabel?: string
  featureLabels: string[]
  resourceLabels: string[]
  spellcastingLabels: string[]
}

export interface CharacterBuilderSummary {
  totalLevel: number
  abilities: Partial<Record<AbilityCode, number>>
  selectedRace?: {
    raceId: string
    raceLabel: string
    subraceId?: string
    subraceLabel?: string
    ancestryId?: string
    ancestryLabel?: string
    ancestryOptionId?: string
    ancestryOptionLabel?: string
  }
  selectedBackground?: {
    backgroundId: string
    label: string
  }
  classes: CharacterBuilderClassSummary[]
}

export interface CharacterBuilderGrantSummaryItem {
  id: string
  label: string
  sourceLabel: string
  source: CharacterProvenance
}

export interface CharacterBuilderGrantedContent {
  features: CharacterBuilderGrantSummaryItem[]
  resources: CharacterBuilderGrantSummaryItem[]
  spellcasting: CharacterBuilderGrantSummaryItem[]
}

export interface CharacterBuilderIssue {
  code: string
  message: string
  sourceLabel: string
  required: boolean
}

export interface CharacterBuilderValidation {
  code: string
  message: string
  severity: 'blocking' | 'warning'
}

export interface CharacterBuilderReadiness {
  ready: boolean
  blockingIssues: string[]
  outstandingRequiredChoices: string[]
}

export type CharacterBuilderSectionId
  = | 'BASICS'
    | 'RACE'
    | 'CLASSES'
    | 'BACKGROUND'
    | 'DETAILS'
    | 'NOTES'
    | 'ABILITIES'
    | 'EQUIPMENT'
    | 'REVIEW'

export interface CharacterBuilderPreviewEntry {
  id: string
  label: string
}

export interface CharacterBuilderChangePreview {
  predictedStatus: AuthoredRecordStatus
  downgradesStatus: boolean
  removedAncestrySelections: CharacterBuilderPreviewEntry[]
  removedFeatureAcquisitions: CharacterBuilderPreviewEntry[]
  removedSpellSelections: CharacterBuilderPreviewEntry[]
  removedResourceGrants: CharacterBuilderPreviewEntry[]
  clearedStartingEquipmentSources: CharacterStartingEquipmentSource[]
  summaryLines: string[]
  destructive: boolean
}

export interface CharacterBuilderResolution {
  mode: BuilderMode
  registry: CharacterBuilderRegistry
  summary: CharacterBuilderSummary
  grants: CharacterBuilderGrantedContent
  outstandingChoices: CharacterBuilderIssue[]
  validations: CharacterBuilderValidation[]
  readiness: CharacterBuilderReadiness
  recommendedSectionId: CharacterBuilderSectionId
}

type GrantedFeatureRecord = {
  feature: FeatureAuthored
  source: CharacterProvenance
  sourceLabel: string
  level: number
}

type ResolvedClassSelection = {
  row: CharacterClassIntent
  baseClass?: ParentClassAuthored
  subclass?: Extract<ClassAuthored, { category: typeof CLASS_CATEGORY.SUBCLASS }>
  features: FeatureAuthored[]
  resources: NonNullable<ClassAuthored['resources']>[]
  spellcasting: NonNullable<ClassAuthored['spellcasting']>[]
}

const abilityOrder: AbilityCode[] = [
  ABILITY_CODE.STRENGTH,
  ABILITY_CODE.DEXTERITY,
  ABILITY_CODE.CONSTITUTION,
  ABILITY_CODE.INTELLIGENCE,
  ABILITY_CODE.WISDOM,
  ABILITY_CODE.CHARISMA
]

function optionCount(values: NonNullable<CharacterFeatureAcquisitionRecord['selections']>): number {
  let count = 0
  for (const selection of values) {
    for (const value of selection.values) {
      if (value.kind === 'ID') count += 1
      if (value.kind === 'IDS') count += value.ids.length
    }
  }
  return count
}

function sameProvenance(left: CharacterProvenance, right: CharacterProvenance): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function sourceLabel(source: CharacterProvenance, registry: CharacterBuilderRegistry): string {
  switch (source.kind) {
    case 'CLASS':
      return registry.classes.find((record) => record.id === source.classId)?.label ?? 'Class'
    case 'SUBCLASS':
      return registry.classes.find((record) => record.id === source.subclassId)?.label ?? 'Subclass'
    case 'RACE':
      return registry.races.find((record) => record.id === source.raceId)?.label ?? 'Race'
    case 'SUBRACE':
      return registry.races.find((record) => record.id === source.subraceId)?.label ?? 'Subrace'
    case 'ANCESTRY': {
      const race = registry.races.find((record) => {
        if (!record.ancestry) return false
        return record.ancestry.id === source.ancestryId
      })
      const option = race?.ancestry?.options.find((record) => record.id === source.optionId)
      return option?.label ?? 'Ancestry Option'
    }
    case 'BACKGROUND':
      return registry.backgrounds.find((record) => record.id === source.backgroundId)?.label ?? 'Background'
    case 'FEAT':
      return 'Feat'
    case 'FEATURE':
      return registry.features.find((record) => record.id === source.featureId)?.label ?? 'Feature'
    case 'OPTION':
      return 'Feature Option'
    case 'MANUAL':
      return source.reason ?? 'Manual'
    default:
      return 'Source'
  }
}

function deriveAbilityScores(
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
  const baseClass = registry.classes.find((record): record is ParentClassAuthored =>
    record.category === CLASS_CATEGORY.BASE && record.id === row.classId
  )

  const subclass = row.subclassId
    ? registry.classes.find((record): record is Extract<ClassAuthored, { category: typeof CLASS_CATEGORY.SUBCLASS }> =>
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
    ...(baseClass?.resources && baseClass.resources.availableAtLevel <= row.classLevel ? [baseClass.resources] : []),
    ...(subclass?.resources && subclass.resources.availableAtLevel <= row.classLevel ? [subclass.resources] : [])
  ]

  const spellcasting = [
    ...(baseClass?.spellcasting ? [baseClass.spellcasting] : []),
    ...(subclass?.spellcasting ? [subclass.spellcasting] : [])
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

function validateMulticlass(
  classSelections: ResolvedClassSelection[],
  abilityScores: Partial<Record<AbilityCode, number>>
): CharacterBuilderValidation[] {
  if (classSelections.length <= 1) return []

  const validations: CharacterBuilderValidation[] = []
  for (const selection of classSelections) {
    const baseClass = selection.baseClass
    if (!baseClass) continue

    const passes = baseClass.multiclass.requirementGroups.groups.some((group) =>
      group.requirements.every((requirement) => (abilityScores[requirement.ability] ?? 0) >= requirement.min)
    )

    if (!passes) {
      validations.push({
        code: 'MULTICLASS_PREREQUISITE_UNMET',
        severity: 'blocking',
        message: `Multiclass prerequisites are not met for ${baseClass.label}.`
      })
    }
  }

  return validations
}

function isValidAncestrySource(
  character: CharacterAuthored,
  source: Extract<CharacterProvenance, { kind: 'RACE' | 'SUBRACE' }>
): boolean {
  if (source.kind === 'RACE') return character.intent.race.raceId === source.raceId
  return character.intent.race.subraceId === source.subraceId
}

function isProvenanceStillValid(
  source: CharacterProvenance,
  character: CharacterAuthored,
  registry: CharacterBuilderRegistry,
  grantedFeatures: GrantedFeatureRecord[]
): boolean {
  switch (source.kind) {
    case 'CLASS':
      return character.intent.classes.some((row) => row.classId === source.classId)
    case 'SUBCLASS':
      return character.intent.classes.some((row) => row.subclassId === source.subclassId)
    case 'RACE':
      return character.intent.race.raceId === source.raceId
    case 'SUBRACE':
      return character.intent.race.subraceId === source.subraceId
    case 'ANCESTRY':
      return registry.races.some((record) => record.ancestry?.options.some((option) => option.id === source.optionId))
    case 'BACKGROUND':
      return character.intent.background.backgroundId === source.backgroundId
    case 'FEAT':
      return true
    case 'FEATURE':
      return grantedFeatures.some((record) => record.feature.id === source.featureId)
    case 'OPTION':
      return character.intent.featureAcquisitions.some((record) => record.id === source.acquiredParentId)
    case 'MANUAL':
      return true
    default:
      return false
  }
}

function createReadiness(
  character: CharacterAuthored,
  summary: CharacterBuilderSummary,
  validations: CharacterBuilderValidation[],
  outstandingChoices: CharacterBuilderIssue[]
): CharacterBuilderReadiness {
  const blockingIssues = validations
    .filter((validation) => validation.severity === 'blocking')
    .map((validation) => validation.message)

  if (!character.label.trim()) blockingIssues.push('Character name is required.')
  if (!character.intent.race.raceId) blockingIssues.push('A race selection is required.')
  if (!character.intent.background.backgroundId) blockingIssues.push('A background selection is required.')
  if (summary.classes.length === 0) blockingIssues.push('At least one class is required.')
  if (Object.keys(summary.abilities).length < abilityOrder.length) {
    blockingIssues.push('All six ability scores must be assigned.')
  }
  if (character.intent.hitpoints.levels.length < Math.max(summary.totalLevel, 1)) {
    blockingIssues.push('Hit point entries are required for each character level.')
  }

  const outstandingRequiredChoices = outstandingChoices
    .filter((choice) => choice.required)
    .map((choice) => choice.message)

  return {
    ready: blockingIssues.length === 0 && outstandingRequiredChoices.length === 0,
    blockingIssues,
    outstandingRequiredChoices
  }
}

function hasValidationCode(
  validations: CharacterBuilderValidation[],
  codes: string[]
): boolean {
  return validations.some((validation) => codes.includes(validation.code))
}

function hasOutstandingCode(
  outstandingChoices: CharacterBuilderIssue[],
  codes: string[]
): boolean {
  return outstandingChoices.some((choice) => codes.includes(choice.code))
}

export function resolveRecommendedCharacterBuilderSection(
  character: CharacterAuthored,
  mode: BuilderMode,
  summary: CharacterBuilderSummary,
  validations: CharacterBuilderValidation[],
  outstandingChoices: CharacterBuilderIssue[]
): CharacterBuilderSectionId {
  if (mode === 'edit' && character.status === AUTHORED_RECORD_STATUS.ACTIVE) {
    return 'BASICS'
  }

  if (!character.label.trim()) return 'BASICS'

  if (
    !character.intent.race.raceId
    || hasValidationCode(validations, [
      'RACE_NOT_FOUND',
      'SUBRACE_NOT_FOUND',
      'STALE_ANCESTRY_SELECTION',
      'ANCESTRY_SOURCE_MISMATCH'
    ])
    || hasOutstandingCode(outstandingChoices, ['ANCESTRY_SELECTION_REQUIRED'])
  ) {
    return 'RACE'
  }

  if (
    summary.classes.length === 0
    || hasValidationCode(validations, [
      'CLASS_NOT_FOUND',
      'SUBCLASS_NOT_FOUND',
      'SUBCLASS_PARENT_MISMATCH',
      'MULTICLASS_PREREQUISITE_UNMET'
    ])
    || hasOutstandingCode(outstandingChoices, ['SPECIALIZATION_REQUIRED'])
  ) {
    return 'CLASSES'
  }

  if (
    !character.intent.background.backgroundId
    || hasValidationCode(validations, ['BACKGROUND_NOT_FOUND'])
  ) {
    return 'BACKGROUND'
  }

  if (
    Object.keys(summary.abilities).length < abilityOrder.length
    || character.intent.hitpoints.levels.length < Math.max(summary.totalLevel, 1)
  ) {
    return 'ABILITIES'
  }

  if (
    hasOutstandingCode(outstandingChoices, [
      'CLASS_STARTING_EQUIPMENT_REQUIRED',
      'BACKGROUND_STARTING_EQUIPMENT_REQUIRED'
    ])
  ) {
    return 'EQUIPMENT'
  }

  if (
    hasOutstandingCode(outstandingChoices, [
      'FEATURE_SELECTION_REQUIRED',
      'FEATURE_SELECTION_INCOMPLETE'
    ])
  ) {
    return 'REVIEW'
  }

  if (validations.length > 0 || outstandingChoices.length > 0) {
    return 'REVIEW'
  }

  return mode === 'edit' ? 'BASICS' : 'REVIEW'
}

function buildAncestrySelectionLabel(
  selection: CharacterAncestryAcquisition,
  registry: CharacterBuilderRegistry
): string {
  const race = registry.races.find((record) =>
    record.ancestry?.id === selection.ancestryId
    && record.ancestry.options.some((option) => option.id === selection.optionId)
  )
  const option = race?.ancestry?.options.find((candidate) => candidate.id === selection.optionId)
  if (race?.ancestry && option) {
    return `${race.ancestry.label}: ${option.label}`
  }
  return selection.optionId
}

function buildFeatureAcquisitionLabel(
  acquisition: CharacterFeatureAcquisitionRecord,
  registry: CharacterBuilderRegistry
): string {
  return registry.features.find((record) => record.id === acquisition.featureId)?.label ?? acquisition.featureId
}

function buildSpellSelectionLabel(
  selection: CharacterSpellSelectionRecord,
  registry: CharacterBuilderRegistry
): string {
  return selection.spells
    .map((spellId) => registry.spells.find((record) => record.id === spellId)?.label ?? spellId)
    .join(', ')
}

function buildResourceGrantLabel(
  grant: CharacterResourceGrantRecord
): string {
  return grant.resourceId
}

function summarizeRemoval(count: number, singular: string, plural = `${singular}s`): string | null {
  if (count <= 0) return null
  return count === 1
    ? `1 ${singular} will be removed.`
    : `${count} ${plural} will be removed.`
}

export function createCharacterBuilderChangePreview(params: {
  previousCharacter: CharacterAuthored | null
  nextCharacter: CharacterAuthored
  predictedStatus: AuthoredRecordStatus
  registry: CharacterBuilderRegistry
}): CharacterBuilderChangePreview {
  const previous = params.previousCharacter
  const next = params.nextCharacter
  const registry = params.registry

  const removedAncestrySelections = (previous?.intent.ancestrySelections ?? [])
    .filter((selection) => !(next.intent.ancestrySelections ?? []).some((candidate) => candidate.id === selection.id))
    .map((selection) => ({
      id: selection.id,
      label: buildAncestrySelectionLabel(selection, registry)
    }))

  const removedFeatureAcquisitions = (previous?.intent.featureAcquisitions ?? [])
    .filter((acquisition) => !next.intent.featureAcquisitions.some((candidate) => candidate.id === acquisition.id))
    .map((acquisition) => ({
      id: acquisition.id,
      label: buildFeatureAcquisitionLabel(acquisition, registry)
    }))

  const removedSpellSelections = (previous?.intent.spellSelections ?? [])
    .filter((selection) => !(next.intent.spellSelections ?? []).some((candidate) => candidate.id === selection.id))
    .map((selection) => ({
      id: selection.id,
      label: buildSpellSelectionLabel(selection, registry)
    }))

  const removedResourceGrants = (previous?.intent.resourceGrants ?? [])
    .filter((grant) => !(next.intent.resourceGrants ?? []).some((candidate) => candidate.id === grant.id))
    .map((grant) => ({
      id: grant.id,
      label: buildResourceGrantLabel(grant)
    }))

  const clearedStartingEquipmentSources: CharacterStartingEquipmentSource[] = []
  if (previous?.intent.startingEquipment?.class && !next.intent.startingEquipment?.class) {
    clearedStartingEquipmentSources.push(CharacterStartingEquipmentSource.CLASS)
  }
  if (previous?.intent.startingEquipment?.background && !next.intent.startingEquipment?.background) {
    clearedStartingEquipmentSources.push(CharacterStartingEquipmentSource.BACKGROUND)
  }

  const downgradesStatus = previous?.status === AUTHORED_RECORD_STATUS.ACTIVE
    && params.predictedStatus === AUTHORED_RECORD_STATUS.DRAFT

  const summaryLines = [
    downgradesStatus
      ? 'This save will move the character back to Draft until the build is complete again.'
      : null,
    summarizeRemoval(removedAncestrySelections.length, 'ancestry selection'),
    summarizeRemoval(removedFeatureAcquisitions.length, 'feature acquisition'),
    summarizeRemoval(removedSpellSelections.length, 'spell selection'),
    summarizeRemoval(removedResourceGrants.length, 'resource grant'),
    clearedStartingEquipmentSources.includes(CharacterStartingEquipmentSource.CLASS)
      ? 'Class starting equipment choices will be cleared.'
      : null,
    clearedStartingEquipmentSources.includes(CharacterStartingEquipmentSource.BACKGROUND)
      ? 'Background starting equipment choices will be cleared.'
      : null
  ].filter((line): line is string => Boolean(line))

  return {
    predictedStatus: params.predictedStatus,
    downgradesStatus,
    removedAncestrySelections,
    removedFeatureAcquisitions,
    removedSpellSelections,
    removedResourceGrants,
    clearedStartingEquipmentSources,
    summaryLines,
    destructive: summaryLines.length > 0
  }
}

export function createEmptyCharacterAuthored(params: {
  id: string
  systemId: string
  userId: string
}): CharacterAuthored {
  return {
    id: params.id,
    label: '',
    description: undefined,
    status: AUTHORED_RECORD_STATUS.DRAFT,
    profile: {},
    intent: {
      advancement: { method: ADVANCEMENT_METHOD_CODE.MILESTONE },
      race: { raceId: '' },
      background: { backgroundId: '' },
      classes: [],
      abilities: {
        method: CHARACTER_ABILITY_GENERATION_METHOD.STANDARD_ARRAY,
        assignments: []
      },
      hitpoints: {
        method: HITPOINT_CALCULATION_METHOD_CODE.FIXED,
        levels: []
      },
      featureAcquisitions: []
    },
    state: {
      equipment: {
        inventory: [],
        equipped: [],
        attuned: []
      },
      currency: [],
      hitpoints: {
        current: 1,
        hitDice: []
      }
    },
    systemId: params.systemId,
    userId: params.userId
  }
}

export async function loadCharacterBuilderRegistry(
  db: DBLike,
  systemId: string
): Promise<CharacterBuilderRegistry> {
  const [
    system,
    races,
    classes,
    backgrounds,
    equipment,
    spells,
    features
  ] = await Promise.all([
    createSystemRepository(db).findById(systemId),
    createRaceRepository(db).findResolvedAll({ systemId }),
    createClassRepository(db).findAll({ systemId }),
    createBackgroundRepository(db).findAll({ systemId }),
    createEquipmentRepository(db).findResolvedAll({ systemId }),
    createSpellRepository(db).findAll({ systemId }),
    createFeatureRepository(db, systemId).findAll()
  ])

  return {
    system,
    races,
    classes,
    backgrounds,
    equipment,
    spells,
    features
  }
}

function clearObsoleteStartingEquipmentSelections(
  character: CharacterAuthored,
  existingCharacter: CharacterAuthored | null
): CharacterAuthored {
  const nextCharacter = structuredClone(character)

  if (!existingCharacter) {
    if (!nextCharacter.intent.classes[0]?.classId) {
      delete nextCharacter.intent.startingEquipment?.class
    }
    if (!nextCharacter.intent.background.backgroundId) {
      delete nextCharacter.intent.startingEquipment?.background
    }
    if (
      nextCharacter.intent.startingEquipment
      && !nextCharacter.intent.startingEquipment.class
      && !nextCharacter.intent.startingEquipment.background
    ) {
      delete nextCharacter.intent.startingEquipment
    }
    return nextCharacter
  }

  const previousPrimaryClassId = existingCharacter.intent.classes[0]?.classId
  const nextPrimaryClassId = nextCharacter.intent.classes[0]?.classId

  if (previousPrimaryClassId !== nextPrimaryClassId) {
    delete nextCharacter.intent.startingEquipment?.class
  }

  if (
    existingCharacter.intent.background.backgroundId
    !== nextCharacter.intent.background.backgroundId
  ) {
    delete nextCharacter.intent.startingEquipment?.background
  }

  if (!nextPrimaryClassId) {
    delete nextCharacter.intent.startingEquipment?.class
  }

  if (!nextCharacter.intent.background.backgroundId) {
    delete nextCharacter.intent.startingEquipment?.background
  }

  if (
    nextCharacter.intent.startingEquipment
    && !nextCharacter.intent.startingEquipment.class
    && !nextCharacter.intent.startingEquipment.background
  ) {
    delete nextCharacter.intent.startingEquipment
  }

  return nextCharacter
}

function collectGrantedFeaturesForCharacter(
  character: CharacterAuthored,
  registry: CharacterBuilderRegistry
): {
  classSelections: ResolvedClassSelection[]
  totalLevel: number
  baseRace?: ResolvedRace
  selectedRace?: ResolvedRace
  selectedBackground?: BackgroundAuthored
  selectedAncestry?: NonNullable<CharacterAuthored['intent']['ancestrySelections']>[number]
  selectedAncestryOption?: NonNullable<ResolvedRace['ancestry']>['options'][number]
  grantedFeatures: GrantedFeatureRecord[]
} {
  const classSelections = character.intent.classes.map((row) => loadClassSelection(row, registry))
  const totalLevel = character.intent.classes.reduce((sum, row) => sum + row.classLevel, 0)

  const baseRace = character.intent.race.raceId
    ? registry.races.find((record) =>
      record.category === RACE_CATEGORY_CODE.BASE && record.id === character.intent.race.raceId
    )
    : undefined
  const selectedRace = character.intent.race.subraceId
    ? registry.races.find((record) => record.id === character.intent.race.subraceId)
    : baseRace
  const selectedBackground = character.intent.background.backgroundId
    ? registry.backgrounds.find((record) => record.id === character.intent.background.backgroundId)
    : undefined

  const selectedAncestry = selectedRace?.ancestry
    ? character.intent.ancestrySelections?.find(
        (selection) => selection.ancestryId === selectedRace.ancestry?.id
      )
    : undefined
  const selectedAncestryOption = selectedRace?.ancestry?.options.find(
    (option) => option.id === selectedAncestry?.optionId
  )

  const grantedFeatures: GrantedFeatureRecord[] = []

  if (selectedRace?.features?.length) {
    for (const feature of selectedRace.features) {
      grantedFeatures.push({
        feature,
        source: selectedRace.category === RACE_CATEGORY_CODE.SUBRACE
          ? { kind: 'SUBRACE', subraceId: selectedRace.id }
          : { kind: 'RACE', raceId: selectedRace.id },
        sourceLabel: selectedRace.label,
        level: totalLevel
      })
    }
  }

  if (selectedAncestryOption?.features?.length && selectedRace?.ancestry) {
    for (const feature of selectedAncestryOption.features) {
      grantedFeatures.push({
        feature,
        source: {
          kind: 'ANCESTRY',
          ancestryId: selectedRace.ancestry.id,
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
      const source = selection.subclass && (selection.subclass.features ?? []).some((record) => record.id === feature.id)
        ? { kind: 'SUBCLASS', subclassId: selection.subclass.id, classLevel: selection.row.classLevel } as const
        : { kind: 'CLASS', classId: selection.row.classId, classLevel: selection.row.classLevel } as const

      grantedFeatures.push({
        feature,
        source,
        sourceLabel: source.kind === 'CLASS'
          ? selection.baseClass?.label ?? 'Class'
          : selection.subclass?.label ?? 'Subclass',
        level: selection.row.classLevel
      })
    }
  }

  return {
    classSelections,
    totalLevel,
    baseRace,
    selectedRace,
    selectedBackground,
    selectedAncestry,
    selectedAncestryOption,
    grantedFeatures
  }
}

export async function reconcileCharacterBuilderCharacter(
  db: DBLike,
  character: CharacterAuthored,
  existingCharacter: CharacterAuthored | null = null
): Promise<CharacterAuthored> {
  const registry = await loadCharacterBuilderRegistry(db, character.systemId)
  const nextCharacter = clearObsoleteStartingEquipmentSelections(character, existingCharacter)

  const ancestrySelections = (nextCharacter.intent.ancestrySelections ?? []).filter((selection) => {
    const race = nextCharacter.intent.race.subraceId
      ? registry.races.find((record) => record.id === nextCharacter.intent.race.subraceId)
      : registry.races.find(
          (record) =>
            record.category === RACE_CATEGORY_CODE.BASE
            && record.id === nextCharacter.intent.race.raceId
        )

    if (!race?.ancestry) return false
    if (selection.ancestryId !== race.ancestry.id) return false
    if (!race.ancestry.options.some((option) => option.id === selection.optionId)) return false
    return isValidAncestrySource(nextCharacter, selection.source)
  })

  nextCharacter.intent.ancestrySelections = ancestrySelections.length > 0 ? ancestrySelections : undefined

  const { grantedFeatures } = collectGrantedFeaturesForCharacter(nextCharacter, registry)

  let featureAcquisitions = [...nextCharacter.intent.featureAcquisitions]
  while (true) {
    const previousCount = featureAcquisitions.length
    const candidateCharacter = {
      ...nextCharacter,
      intent: {
        ...nextCharacter.intent,
        featureAcquisitions
      }
    }

    featureAcquisitions = featureAcquisitions.filter((acquisition) =>
      isProvenanceStillValid(acquisition.source, candidateCharacter, registry, grantedFeatures)
    )

    if (featureAcquisitions.length === previousCount) {
      break
    }
  }

  nextCharacter.intent.featureAcquisitions = featureAcquisitions

  const filteredCharacter = {
    ...nextCharacter,
    intent: {
      ...nextCharacter.intent,
      featureAcquisitions
    }
  }

  const spellSelections = (nextCharacter.intent.spellSelections ?? []).filter((selection) =>
    isProvenanceStillValid(selection.source, filteredCharacter, registry, grantedFeatures)
  )
  nextCharacter.intent.spellSelections = spellSelections.length > 0 ? spellSelections : undefined

  const resourceGrants = (nextCharacter.intent.resourceGrants ?? []).filter((grant) =>
    isProvenanceStillValid(grant.source, filteredCharacter, registry, grantedFeatures)
  )
  nextCharacter.intent.resourceGrants = resourceGrants.length > 0 ? resourceGrants : undefined

  return nextCharacter
}

export async function resolveCharacterBuilder(
  db: DBLike,
  character: CharacterAuthored,
  mode: BuilderMode
): Promise<CharacterBuilderResolution> {
  const registry = await loadCharacterBuilderRegistry(db, character.systemId)
  const abilityScores = deriveAbilityScores(character.intent.abilities)
  const {
    classSelections,
    totalLevel,
    baseRace,
    selectedRace,
    selectedBackground,
    selectedAncestry,
    selectedAncestryOption,
    grantedFeatures
  } = collectGrantedFeaturesForCharacter(character, registry)

  const grants: CharacterBuilderGrantedContent = {
    features: grantedFeatures.map((record) => ({
      id: record.feature.id,
      label: record.feature.label,
      sourceLabel: record.sourceLabel,
      source: record.source
    })),
    resources: classSelections.flatMap((selection) => {
      const items: CharacterBuilderGrantSummaryItem[] = []
      if (selection.baseClass?.resources && selection.baseClass.resources.availableAtLevel <= selection.row.classLevel) {
        items.push({
          id: selection.baseClass.resources.id,
          label: selection.baseClass.resources.label,
          sourceLabel: selection.baseClass.label,
          source: { kind: 'CLASS', classId: selection.baseClass.id, classLevel: selection.row.classLevel }
        })
      }
      if (selection.subclass?.resources && selection.subclass.resources.availableAtLevel <= selection.row.classLevel) {
        items.push({
          id: selection.subclass.resources.id,
          label: selection.subclass.resources.label,
          sourceLabel: selection.subclass.label,
          source: { kind: 'SUBCLASS', subclassId: selection.subclass.id, classLevel: selection.row.classLevel }
        })
      }
      return items
    }),
    spellcasting: classSelections.flatMap((selection) => {
      const items: CharacterBuilderGrantSummaryItem[] = []
      if (selection.baseClass?.spellcasting) {
        items.push({
          id: `${selection.baseClass.id}:spellcasting`,
          label: selection.baseClass.spellcasting.magicName ?? `${selection.baseClass.label} Spellcasting`,
          sourceLabel: selection.baseClass.label,
          source: { kind: 'CLASS', classId: selection.baseClass.id, classLevel: selection.row.classLevel }
        })
      }
      if (selection.subclass?.spellcasting) {
        items.push({
          id: `${selection.subclass.id}:spellcasting`,
          label: selection.subclass.spellcasting.magicName ?? `${selection.subclass.label} Spellcasting`,
          sourceLabel: selection.subclass.label,
          source: { kind: 'SUBCLASS', subclassId: selection.subclass.id, classLevel: selection.row.classLevel }
        })
      }
      return items
    })
  }

  const summary: CharacterBuilderSummary = {
    totalLevel,
    abilities: abilityScores,
    selectedRace: selectedRace
      ? {
          raceId: baseRace?.id ?? selectedRace.id,
          raceLabel: baseRace?.label ?? selectedRace.label,
          subraceId: selectedRace.category === RACE_CATEGORY_CODE.SUBRACE ? selectedRace.id : undefined,
          subraceLabel: selectedRace.category === RACE_CATEGORY_CODE.SUBRACE ? selectedRace.label : undefined,
          ancestryId: selectedRace.ancestry?.id,
          ancestryLabel: selectedRace.ancestry?.label,
          ancestryOptionId: selectedAncestryOption?.id,
          ancestryOptionLabel: selectedAncestryOption?.label
        }
      : undefined,
    selectedBackground: selectedBackground
      ? {
          backgroundId: selectedBackground.id,
          label: selectedBackground.label
        }
      : undefined,
    classes: classSelections.map((selection) => ({
      classId: selection.row.classId,
      classLabel: selection.baseClass?.label ?? 'Unknown Class',
      classLevel: selection.row.classLevel,
      subclassId: selection.row.subclassId,
      subclassLabel: selection.subclass?.label,
      specializationId: selection.row.specializationId,
      specializationLabel: selection.subclass?.specializations?.find(
        (record) => record.id === selection.row.specializationId
      )?.label,
      featureLabels: selection.features.map((feature) => feature.label),
      resourceLabels: selection.resources.map((resource) => resource.label),
      spellcastingLabels: selection.spellcasting.map(
        (spellcasting) => spellcasting.magicName ?? 'Spellcasting'
      )
    }))
  }

  const validations: CharacterBuilderValidation[] = []

  if (character.intent.race.raceId && !baseRace) {
    validations.push({
      code: 'RACE_NOT_FOUND',
      severity: 'blocking',
      message: 'The selected race no longer exists.'
    })
  }

  if (character.intent.race.subraceId && !selectedRace) {
    validations.push({
      code: 'SUBRACE_NOT_FOUND',
      severity: 'blocking',
      message: 'The selected subrace no longer exists.'
    })
  }

  if (character.intent.background.backgroundId && !selectedBackground) {
    validations.push({
      code: 'BACKGROUND_NOT_FOUND',
      severity: 'blocking',
      message: 'The selected background no longer exists.'
    })
  }

  for (const selection of classSelections) {
    if (!selection.baseClass) {
      validations.push({
        code: 'CLASS_NOT_FOUND',
        severity: 'blocking',
        message: `The selected class "${selection.row.classId}" no longer exists.`
      })
    }

    if (selection.row.subclassId && !selection.subclass) {
      validations.push({
        code: 'SUBCLASS_NOT_FOUND',
        severity: 'blocking',
        message: `The selected subclass "${selection.row.subclassId}" no longer exists.`
      })
    }

    if (selection.baseClass && selection.subclass && selection.subclass.parentClassId !== selection.baseClass.id) {
      validations.push({
        code: 'SUBCLASS_PARENT_MISMATCH',
        severity: 'blocking',
        message: `${selection.subclass.label} no longer belongs to ${selection.baseClass.label}.`
      })
    }
  }

  validations.push(...validateMulticlass(classSelections, abilityScores))

  const outstandingChoices: CharacterBuilderIssue[] = []

  if (selectedRace?.ancestry && !selectedAncestryOption) {
    outstandingChoices.push({
      code: 'ANCESTRY_SELECTION_REQUIRED',
      message: `${selectedRace.ancestry.label} requires an option selection.`,
      sourceLabel: selectedRace.label,
      required: true
    })
  }

  for (const selection of classSelections) {
    if (selection.subclass?.specializations?.length && !selection.row.specializationId) {
      outstandingChoices.push({
        code: 'SPECIALIZATION_REQUIRED',
        message: `${selection.subclass.label} requires a specialization.`,
        sourceLabel: selection.subclass.label,
        required: true
      })
    }
  }

  const primaryClass = classSelections[0]?.baseClass
  if (primaryClass?.startingEquipment.sets.length && !character.intent.startingEquipment?.class) {
    outstandingChoices.push({
      code: 'CLASS_STARTING_EQUIPMENT_REQUIRED',
      message: `${primaryClass.label} has starting equipment choices to resolve.`,
      sourceLabel: primaryClass.label,
      required: true
    })
  }

  if (selectedBackground?.startingEquipment?.sets.length && !character.intent.startingEquipment?.background) {
    outstandingChoices.push({
      code: 'BACKGROUND_STARTING_EQUIPMENT_REQUIRED',
      message: `${selectedBackground.label} has starting equipment choices to resolve.`,
      sourceLabel: selectedBackground.label,
      required: true
    })
  }

  for (const granted of grantedFeatures) {
    const requiredOptionCount = (granted.feature.optionChoices ?? [])
      .filter((choice) => choice.level <= granted.level)
      .reduce((sum, choice) => sum + choice.count, 0)

    if (requiredOptionCount <= 0) continue

    const acquisition = character.intent.featureAcquisitions.find((record) =>
      record.featureId === granted.feature.id && sameProvenance(record.source, granted.source)
    )

    if (!acquisition) {
      outstandingChoices.push({
        code: 'FEATURE_SELECTION_REQUIRED',
        message: `${granted.feature.label} requires a selection.`,
        sourceLabel: granted.sourceLabel,
        required: true
      })
      continue
    }

    if (!acquisition.selections || optionCount(acquisition.selections) < requiredOptionCount) {
      outstandingChoices.push({
        code: 'FEATURE_SELECTION_INCOMPLETE',
        message: `${granted.feature.label} has incomplete selections.`,
        sourceLabel: granted.sourceLabel,
        required: true
      })
    }
  }

  for (const acquisition of character.intent.featureAcquisitions) {
    if (!isProvenanceStillValid(acquisition.source, character, registry, grantedFeatures)) {
      validations.push({
        code: 'STALE_FEATURE_ACQUISITION',
        severity: 'blocking',
        message: `Feature acquisition "${acquisition.featureId}" no longer matches the current build.`
      })
    }
  }

  for (const selection of character.intent.spellSelections ?? []) {
    if (!isProvenanceStillValid(selection.source, character, registry, grantedFeatures)) {
      validations.push({
        code: 'STALE_SPELL_SELECTION',
        severity: 'blocking',
        message: `Spell selection "${selection.id}" no longer matches the current build.`
      })
    }
  }

  for (const grant of character.intent.resourceGrants ?? []) {
    if (!isProvenanceStillValid(grant.source, character, registry, grantedFeatures)) {
      validations.push({
        code: 'STALE_RESOURCE_GRANT',
        severity: 'blocking',
        message: `Resource grant "${grant.id}" no longer matches the current build.`
      })
    }
  }

  if (selectedAncestry && !selectedRace?.ancestry?.options.some((option) => option.id === selectedAncestry.optionId)) {
    validations.push({
      code: 'STALE_ANCESTRY_SELECTION',
      severity: 'blocking',
      message: 'The selected ancestry option no longer belongs to the current race choice.'
    })
  }

  if (selectedAncestry && !isValidAncestrySource(character, selectedAncestry.source)) {
    validations.push({
      code: 'ANCESTRY_SOURCE_MISMATCH',
      severity: 'blocking',
      message: 'The selected ancestry option no longer matches the current race or subrace.'
    })
  }

  return {
    mode,
    registry,
    summary,
    grants,
    outstandingChoices,
    validations,
    readiness: createReadiness(character, summary, validations, outstandingChoices),
    recommendedSectionId: resolveRecommendedCharacterBuilderSection(
      character,
      mode,
      summary,
      validations,
      outstandingChoices
    )
  }
}
