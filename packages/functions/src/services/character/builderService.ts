import type { DBLike } from '@artificer-toolkit/db'
import {
  ABILITY_CODE,
  ADVANCEMENT_METHOD_CODE,
  applyGrants,
  AUTHORED_RECORD_STATUS,
  CLASS_CATEGORY,
  CHARACTER_ABILITY_GENERATION_METHOD,
  createCharacterEligibilityContext,
  evaluateCharacterFacet,
  GRANT_KIND,
  HITPOINT_CALCULATION_METHOD_CODE,
  POINT_BUY_SCORE_REGISTRY,
  POINT_BUY_TOTAL_POINTS,
  RACE_CATEGORY_CODE,
  resolveRulesSystem,
  resolveSpellGrantState,
  type AbilityCode,
  type AuthoredRecordStatus,
  type CharacterBuildSnapshot,
  type CharacterEligibilityContext,
  type EquipmentCategoryCode,
  type EquipmentPropertyCode
} from '@artificer-toolkit/shared/core'
import { evaluateMulticlassRequirements } from '@artificer-toolkit/shared/character'
import {
  CharacterStartingEquipmentSource,
  getCharacterChosenGrantSelectionIdentityKey,
  isSameCharacterProvenanceIdentity,
  type BackgroundAuthored,
  type CharacterAbilityScoresIntent,
  type CharacterAncestryAcquisition,
  type CharacterAcquisitionTiming,
  type CharacterAuthored,
  type CharacterClassIntent,
  type CharacterFeatureAcquisitionRecord,
  type CharacterProvenance,
  type CharacterResourceGrantRecord,
  type FeatAuthored,
  type CharacterSpellSelectionRecord,
  type ClassAuthored,
  type ParentClassAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import type { FeatureAuthored, StartingEquipmentAuthored } from '@artificer-toolkit/shared/authored'
import type { ResolvedEquipment, ResolvedRace } from '@artificer-toolkit/shared/subjects/compilers'
import type { SystemSeedRecord } from '@artificer-toolkit/db'
import {
  getSelectedFeatureOptionIds,
  resolveCharacterChosenGrantChoices,
  type CharacterBuilderChosenGrantChoice,
  type CharacterChosenGrantChoiceRegistry,
  type CharacterChosenGrantOwner
} from './chosenGrantChoiceResolver.js'
import {
  createCharacterAssemblyRegistry,
  toCharacterEngineFeatureSource,
  toCharacterEngineFeatureTiming
} from './characterEngine.js'
import {
  loadCharacterBuilderCatalog,
  loadCharacterBuilderSpellCatalog,
  type CharacterBuilderCatalog,
  type CharacterBuilderClassCatalogRecord
} from './builderCatalog.js'
import { loadCharacterAssemblyRegistry } from './characterAssemblyOrchestrator.js'

type BuilderMode = 'create' | 'edit'

export interface CharacterBuilderRegistry {
  system: SystemSeedRecord | null
  races: ResolvedRace[]
  classes: ClassAuthored[]
  backgrounds: BackgroundAuthored[]
  equipment: ResolvedEquipment[]
  feats?: FeatAuthored[]
  features: FeatureAuthored[]
}

export interface CharacterBuilderContext {
  catalog: CharacterBuilderCatalog
  registry: CharacterBuilderRegistry
}

function getCharacterChosenGrantChoiceRegistry(
  context: CharacterBuilderContext
): CharacterChosenGrantChoiceRegistry {
  return {
    system: context.registry.system,
    equipment: context.catalog.equipment,
    spells: context.catalog.spells,
    feats: context.catalog.feats
  }
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
  description?: string
  details?: Array<{ id: string; label: string; description: string }>
  sortOrder?: number
  availableAtLevel?: number
  attributes?: string[]
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
  source?: CharacterProvenance
  required: boolean
}

export interface CharacterBuilderValidation {
  code: string
  message: string
  severity: 'blocking' | 'warning'
  sourceLabel?: string
  source?: CharacterProvenance
}

export interface CharacterBuilderReadiness {
  ready: boolean
  blockingIssues: string[]
  outstandingRequiredChoices: string[]
}

export type CharacterBuilderSectionId =
  | 'BASICS'
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
  catalog: CharacterBuilderCatalog
  registry: CharacterBuilderRegistry
  summary: CharacterBuilderSummary
  grants: CharacterBuilderGrantedContent
  chosenGrantChoices: CharacterBuilderChosenGrantChoice[]
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

type CharacterStartingEquipmentDecision = NonNullable<
  NonNullable<CharacterAuthored['intent']['startingEquipment']>['class']
>
type StartingEquipmentItem =
  StartingEquipmentAuthored['sets'][number]['groups'][number]['options'][number]['items'][number]
type ChosenStartingEquipmentItem = StartingEquipmentItem & {
  startingEquipmentKind: 'EQUIPMENT'
  category?: EquipmentCategoryCode
  properties?: EquipmentPropertyCode[]
  selectionKind: 'CHOSEN'
  count: number
  equipmentIds?: string[]
}
type CharacterSpellSelectionSource = CharacterSpellSelectionRecord['source']
type CharacterBuilderGrantedFeatureLookup = readonly { feature: Pick<FeatureAuthored, 'id'> }[]

export interface CharacterSpellChoiceRequirement {
  label: string
  sourceLabel: string
  source: CharacterSpellSelectionSource
  cantripLimit: number
  learnedSpellLimit: number
  maxSpellLevel: number
  allowedClassIds: string[]
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

function getActiveSpellLimit(
  spellcasting: ClassAuthored['spellcasting'],
  classLevel: number
): NonNullable<ClassAuthored['spellcasting']>['spellLimits'][number] | undefined {
  return spellcasting?.spellLimits
    .filter((limit) => limit.classLevel <= classLevel)
    .sort((left, right) => right.classLevel - left.classLevel)[0]
}

function getSpellSelectionCounts(
  selection: CharacterSpellSelectionRecord | undefined,
  catalog: CharacterBuilderCatalog
): { cantrips: number; spells: number } {
  const spellIds = selection?.spells ?? []

  return {
    cantrips: spellIds.filter(
      (spellId) => catalog.spells.find((spell) => spell.id === spellId)?.level === 0
    ).length,
    spells: spellIds.filter((spellId) => {
      const spell = catalog.spells.find((record) => record.id === spellId)
      return spell && spell.level > 0
    }).length
  }
}

function isSpellAllowedForClassRequirement(
  spell: CharacterBuilderCatalog['spells'][number],
  requirement: CharacterSpellChoiceRequirement
): boolean {
  const matchesClass = spell.classIds.some((classId) =>
    requirement.allowedClassIds.includes(classId)
  )
  if (!matchesClass) return false
  if (spell.level === 0) return true

  return spell.level <= requirement.maxSpellLevel
}

export function getInvalidSpellSelectionIds(
  selection: CharacterSpellSelectionRecord | undefined,
  requirement: CharacterSpellChoiceRequirement,
  catalog: CharacterBuilderCatalog
): string[] {
  if (!selection) return []

  return selection.spells.filter((spellId) => {
    const spell = catalog.spells.find((record) => record.id === spellId)

    return !spell || !isSpellAllowedForClassRequirement(spell, requirement)
  })
}

function getClassSpellChoiceRequirements(
  classSelections: ResolvedClassSelection[]
): CharacterSpellChoiceRequirement[] {
  return classSelections.flatMap((selection) => {
    const requirements: CharacterSpellChoiceRequirement[] = []

    if (selection.baseClass?.spellcasting) {
      const activeLimit = getActiveSpellLimit(
        selection.baseClass.spellcasting,
        selection.row.classLevel
      )
      if (
        activeLimit &&
        ((activeLimit.cantripsLimit ?? 0) > 0 || (activeLimit.learnedSpellsLimit ?? 0) > 0)
      ) {
        const spellSlotLevels = activeLimit.slots.map((slot) => slot.spellLevel)

        requirements.push({
          label: selection.baseClass.spellcasting.magicName ?? 'Spellcasting',
          sourceLabel: selection.baseClass.label,
          source: {
            kind: 'CLASS',
            classId: selection.baseClass.id,
            classLevel: selection.row.classLevel
          },
          cantripLimit: activeLimit.cantripsLimit ?? 0,
          learnedSpellLimit: activeLimit.learnedSpellsLimit ?? 0,
          maxSpellLevel:
            Math.max(...spellSlotLevels, 0) || selection.baseClass.spellcasting.maxSpellLevel,
          allowedClassIds: [selection.baseClass.id]
        })
      }
    }

    if (selection.subclass?.spellcasting) {
      const activeLimit = getActiveSpellLimit(
        selection.subclass.spellcasting,
        selection.row.classLevel
      )
      if (
        activeLimit &&
        ((activeLimit.cantripsLimit ?? 0) > 0 || (activeLimit.learnedSpellsLimit ?? 0) > 0)
      ) {
        const spellSlotLevels = activeLimit.slots.map((slot) => slot.spellLevel)

        requirements.push({
          label: selection.subclass.spellcasting.magicName ?? 'Spellcasting',
          sourceLabel: selection.subclass.label,
          source: {
            kind: 'SUBCLASS',
            subclassId: selection.subclass.id,
            classLevel: selection.row.classLevel
          },
          cantripLimit: activeLimit.cantripsLimit ?? 0,
          learnedSpellLimit: activeLimit.learnedSpellsLimit ?? 0,
          maxSpellLevel:
            Math.max(...spellSlotLevels, 0) || selection.subclass.spellcasting.maxSpellLevel,
          allowedClassIds: [...new Set([selection.row.classId, selection.subclass.id])]
        })
      }
    }

    return requirements
  })
}

function isEquipmentAllowedForStartingItem(
  item: ChosenStartingEquipmentItem,
  equipmentId: string,
  catalog: CharacterBuilderCatalog
): boolean {
  const equipment = catalog.equipment.find((record) => record.id === equipmentId)
  if (!equipment) return false

  if (Array.isArray(item.equipmentIds) && !item.equipmentIds.includes(equipmentId)) return false
  if (item.category && equipment.category !== item.category) return false
  if (item.properties?.some((property) => !equipment.properties.includes(property))) return false

  return true
}

export function isStartingEquipmentDecisionComplete(
  startingEquipment: StartingEquipmentAuthored,
  decision: CharacterStartingEquipmentDecision | undefined,
  catalog: CharacterBuilderCatalog
): boolean {
  if (startingEquipment.sets.length === 0) return true
  if (!decision) return false

  if (decision.tookGold) {
    return Boolean(
      decision.gold && decision.gold.goldOption.trim().length > 0 && decision.gold.totalGold > 0
    )
  }

  const groupSelections = new Map((decision.groups ?? []).map((group) => [group.groupId, group]))

  return startingEquipment.sets.every((set) =>
    set.groups.every((group) => {
      const groupSelection = groupSelections.get(group.id)
      const option = group.options.find((candidate) => candidate.id === groupSelection?.optionId)
      if (!groupSelection || !option) return false

      const selectableItemIds = new Set(
        option.items.filter(isChosenStartingEquipmentItem).map((item) => item.id)
      )
      const hasInvalidSelectionKey = groupSelection.selections?.some(
        (selection) => !selectableItemIds.has(selection.selectionKey)
      )
      if (hasInvalidSelectionKey) return false

      return option.items.every((item) => {
        if (!isChosenStartingEquipmentItem(item)) return true

        const selections =
          groupSelection.selections?.filter((selection) => selection.selectionKey === item.id) ?? []
        const selectedQuantity = selections.reduce((sum, selection) => sum + selection.quantity, 0)

        return (
          selectedQuantity === item.count &&
          selections.every(
            (selection) =>
              selection.equipmentId.trim().length > 0 &&
              selection.quantity > 0 &&
              isEquipmentAllowedForStartingItem(item, selection.equipmentId, catalog)
          )
        )
      })
    })
  )
}

function isChosenStartingEquipmentItem(
  item: StartingEquipmentItem
): item is ChosenStartingEquipmentItem {
  return (
    item.startingEquipmentKind === 'EQUIPMENT' &&
    'selectionKind' in item &&
    item.selectionKind === 'CHOSEN' &&
    'count' in item
  )
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

function appendAbilityIntentValidationIssues(
  character: CharacterAuthored,
  validations: CharacterBuilderValidation[]
): void {
  const abilities = character.intent.abilities
  const assignments = abilities.method === CHARACTER_ABILITY_GENERATION_METHOD.MANUAL_ROLLED
    ? abilities.state.assignments
    : abilities.assignments
  const assignedAbilities = assignments.map((assignment) => assignment.ability)

  if (assignments.length > abilityOrder.length || new Set(assignedAbilities).size !== assignedAbilities.length) {
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

function validateMulticlass(
  classSelections: ResolvedClassSelection[],
  abilityScores: Partial<Record<AbilityCode, number>>
): CharacterBuilderValidation[] {
  if (classSelections.length <= 1) return []

  const validations: CharacterBuilderValidation[] = []
  for (const selection of classSelections) {
    const baseClass = selection.baseClass
    if (!baseClass) continue

    if (!evaluateMulticlassRequirements(baseClass.multiclass.requirementGroups, abilityScores).passes) {
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

function isProvenanceStillValid(
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

function getRequiredClassResourceGrants(
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

function mergeRequiredResourceGrants(
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

function isSameRequiredResourceGrant(
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

type CharacterHitpointLevelEntry = CharacterAuthored['intent']['hitpoints']['levels'][number]
type CharacterHitDie = CharacterAuthored['state']['hitpoints']['hitDice'][number]

function normalizeCharacterHitpointLevels(
  character: CharacterAuthored,
  authoredClasses: CharacterBuilderRegistry['classes'],
  existingCharacter: CharacterAuthored | null
): CharacterHitpointLevelEntry[] {
  const submittedLevels = character.intent.hitpoints.levels
  const persistedLevels = existingCharacter?.intent.hitpoints.levels ?? []
  const levelsByClass = new Map(submittedLevels.map((level) => [
    `${level.classId}:${level.classLevel}`,
    level
  ]))
  const existingLevelsByClass = new Map(persistedLevels.map((level) => [
    `${level.classId}:${level.classLevel}`,
    level
  ]))
  const abilityScores = deriveAbilityScores(character.intent.abilities)
  const persistedKeys = new Set(existingLevelsByClass.keys())
  const preferredLevels = existingCharacter
    ? [
        ...[...persistedLevels].sort((left, right) => left.level - right.level),
        ...[...submittedLevels]
          .sort((left, right) => left.level - right.level)
          .filter((level) => !persistedKeys.has(`${level.classId}:${level.classLevel}`))
      ]
    : [...submittedLevels].sort((left, right) => left.level - right.level)
  const orderedLevels = reconcileCharacterHitpointProgression(
    character.intent.classes,
    preferredLevels.map((level, index) => ({ ...level, level: index + 1 }))
  )
  const primaryClassId = character.intent.classes[0]?.classId
  if (primaryClassId) {
    const primaryIndex = orderedLevels.findIndex(
      (level) => level.classId === primaryClassId && level.classLevel === 1
    )
    if (primaryIndex > 0) {
      const [primaryLevel] = orderedLevels.splice(primaryIndex, 1)
      if (primaryLevel) orderedLevels.unshift(primaryLevel)
    } else if (primaryIndex === -1) {
      const primaryKey = `${primaryClassId}:1`
      orderedLevels.unshift({
        level: 1,
        classId: primaryClassId,
        classLevel: 1,
        value: levelsByClass.get(primaryKey)?.value ?? existingLevelsByClass.get(primaryKey)?.value ?? 1
      })
    }
  }
  const orderedKeys = new Set(orderedLevels.map((level) => `${level.classId}:${level.classLevel}`))

  for (const classSelection of character.intent.classes) {
    for (let classLevel = 1; classLevel <= classSelection.classLevel; classLevel += 1) {
      const key = `${classSelection.classId}:${classLevel}`
      if (orderedKeys.has(key)) continue
      orderedLevels.push({
        level: orderedLevels.length + 1,
        classId: classSelection.classId,
        classLevel,
        value: levelsByClass.get(key)?.value ?? existingLevelsByClass.get(key)?.value ?? 1
      })
      orderedKeys.add(key)
    }
  }

  return orderedLevels.map((orderedLevel, index) => {
    const level = index + 1
    const authoredClass = authoredClasses.find((record): record is ParentClassAuthored => (
      record.category === CLASS_CATEGORY.BASE && record.id === orderedLevel.classId
    ))
    const die = parseClassHitDie(authoredClass?.hitpoint?.dieConfig)
    if (!authoredClass || die === null) return { ...orderedLevel, level }

    const hitpointAbility = authoredClass.hitpoint?.ability
    const score = hitpointAbility ? abilityScores[hitpointAbility] : undefined
    const modifier = typeof score === 'number' ? Math.floor((score - 10) / 2) : 0
    const key = `${orderedLevel.classId}:${orderedLevel.classLevel}`
    const submitted = levelsByClass.get(key)
    const persisted = existingLevelsByClass.get(key)
    const fixedDieValue = level === 1 ? die : Math.floor(die / 2) + 1

    if (character.intent.hitpoints.method === HITPOINT_CALCULATION_METHOD_CODE.FIXED || level === 1) {
      return {
        level,
        classId: orderedLevel.classId,
        classLevel: orderedLevel.classLevel,
        value: Math.max(fixedDieValue + modifier, 1)
      }
    }

    const roll = submitted?.rolls?.[0]
    const persistedLegacyOverride = existingCharacter?.intent.hitpoints.method === HITPOINT_CALCULATION_METHOD_CODE.MANUAL
      && persisted !== undefined
      && !persisted.rolls?.length
      && persisted.overridden !== false

    return {
      level,
      classId: orderedLevel.classId,
      classLevel: orderedLevel.classLevel,
      value: roll
        ? Math.max(roll.value + modifier, 1)
        : persistedLegacyOverride
          ? Math.max(submitted?.value ?? persisted.value, 1)
          : Math.max(modifier + 1, 1),
      ...(roll ? { rolls: submitted?.rolls, overridden: false } : {}),
      ...(!roll && persistedLegacyOverride ? { overridden: true } : { overridden: false })
    }
  })
}

export function reconcileCharacterHitpointProgression(
  classes: CharacterAuthored['intent']['classes'],
  levels: CharacterHitpointLevelEntry[]
): CharacterHitpointLevelEntry[] {
  const selectedLevelsByClass = new Map(classes.map((entry) => [entry.classId, entry.classLevel]))
  const acceptedLevelsByClass = new Map<string, number>()
  const reconciled: CharacterHitpointLevelEntry[] = []

  for (const entry of [...levels].sort((left, right) => left.level - right.level)) {
    const selectedClassLevel = selectedLevelsByClass.get(entry.classId)
    const nextClassLevel = (acceptedLevelsByClass.get(entry.classId) ?? 0) + 1
    if (
      selectedClassLevel === undefined ||
      entry.classLevel !== nextClassLevel ||
      entry.classLevel > selectedClassLevel
    ) {
      continue
    }

    acceptedLevelsByClass.set(entry.classId, entry.classLevel)
    reconciled.push({ ...entry, level: reconciled.length + 1 })
  }

  return reconciled
}

function parseClassHitDie(dieConfig: string | undefined): number | null {
  const match = /^(?:1)?d([1-9]\d*)$/i.exec(dieConfig?.trim() ?? '')
  if (!match?.[1]) return null

  const die = Number(match[1])
  return Number.isSafeInteger(die) ? die : null
}

function appendManualHitpointValidationIssues(
  character: CharacterAuthored,
  authoredClasses: CharacterBuilderRegistry['classes'],
  validations: CharacterBuilderValidation[]
): void {
  if (character.intent.hitpoints.method !== HITPOINT_CALCULATION_METHOD_CODE.MANUAL) return

  for (const level of character.intent.hitpoints.levels) {
    if (level.level === 1) continue

    const authoredClass = authoredClasses.find((record): record is ParentClassAuthored => (
      record.category === CLASS_CATEGORY.BASE && record.id === level.classId
    ))
    const die = parseClassHitDie(authoredClass?.hitpoint?.dieConfig)
    const rolls = level.rolls ?? []
    if (rolls.length === 0 && level.overridden === true) continue

    if (rolls.length === 0) {
      validations.push({
        code: 'MISSING_MANUAL_HITPOINT_ROLL',
        severity: 'blocking',
        message: `Character level ${level.level} requires a hit-die roll.`
      })
      continue
    }

    const roll = rolls[0]
    if (
      rolls.length !== 1
      || die === null
      || !roll
      || roll.die !== die
      || roll.value < 1
      || roll.value > die
    ) {
      validations.push({
        code: 'INVALID_MANUAL_HITPOINT_ROLL',
        severity: 'blocking',
        message: `Character level ${level.level} has an invalid hit-die roll.`
      })
    }
  }
}

export function reconcileCharacterHitDice(
  selectedClasses: CharacterAuthored['intent']['classes'],
  authoredClasses: CharacterBuilderRegistry['classes'],
  currentHitDice: CharacterHitDie[]
): CharacterHitDie[] {
  const totalsByDie = new Map<number, number>()

  for (const selection of selectedClasses) {
    if (!Number.isSafeInteger(selection.classLevel) || selection.classLevel <= 0) continue

    const authoredClass = authoredClasses.find((record) => record.id === selection.classId)
    if (!authoredClass || authoredClass.category !== CLASS_CATEGORY.BASE) continue

    const die = parseClassHitDie(authoredClass.hitpoint?.dieConfig)
    if (die === null) continue

    totalsByDie.set(die, (totalsByDie.get(die) ?? 0) + selection.classLevel)
  }

  const usedByDie = new Map<number, number>()
  for (const hitDie of currentHitDice) {
    if (!Number.isSafeInteger(hitDie.die) || hitDie.die <= 0) continue
    const used = Number.isSafeInteger(hitDie.used) && hitDie.used > 0 ? hitDie.used : 0
    usedByDie.set(hitDie.die, (usedByDie.get(hitDie.die) ?? 0) + used)
  }

  return [...totalsByDie].map(([die, total]) => ({
    die,
    total,
    used: Math.min(usedByDie.get(die) ?? 0, total)
  }))
}

export function isCharacterHitpointProgressionValid(
  classes: CharacterAuthored['intent']['classes'],
  levels: CharacterHitpointLevelEntry[],
  requireComplete = false
): boolean {
  const expectedTotal = classes.reduce((sum, entry) => sum + entry.classLevel, 0)
  const reconciled = reconcileCharacterHitpointProgression(classes, levels)
  const structurallyValid =
    reconciled.length === levels.length &&
    reconciled.every(
      (entry, index) =>
        entry.level === levels[index]?.level &&
        entry.classId === levels[index]?.classId &&
        entry.classLevel === levels[index]?.classLevel
    )

  return structurallyValid && (!requireComplete || levels.length === expectedTotal)
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
  if (!character.intent.background.backgroundId)
    blockingIssues.push('A background selection is required.')
  if (summary.classes.length === 0) blockingIssues.push('At least one class is required.')
  if (Object.keys(summary.abilities).length < abilityOrder.length) {
    blockingIssues.push('All six ability scores must be assigned.')
  }
  if (
    !isCharacterHitpointProgressionValid(
      character.intent.classes,
      character.intent.hitpoints.levels,
      true
    )
  ) {
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

function hasValidationCode(validations: CharacterBuilderValidation[], codes: string[]): boolean {
  return validations.some((validation) => codes.includes(validation.code))
}

function hasOutstandingCode(outstandingChoices: CharacterBuilderIssue[], codes: string[]): boolean {
  return outstandingChoices.some((choice) => codes.includes(choice.code))
}

function getCharacterBuilderSectionForSource(
  source: CharacterProvenance | undefined
): CharacterBuilderSectionId | null {
  if (!source) return null

  switch (source.kind) {
    case 'RACE':
    case 'SUBRACE':
    case 'ANCESTRY':
      return 'RACE'
    case 'CLASS':
    case 'SUBCLASS':
      return 'CLASSES'
    case 'BACKGROUND':
      return 'BACKGROUND'
    default:
      return null
  }
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
    !character.intent.race.raceId ||
    hasValidationCode(validations, [
      'RACE_NOT_FOUND',
      'SUBRACE_NOT_FOUND',
      'STALE_ANCESTRY_SELECTION',
      'ANCESTRY_SOURCE_MISMATCH'
    ]) ||
    hasOutstandingCode(outstandingChoices, ['ANCESTRY_SELECTION_REQUIRED'])
  ) {
    return 'RACE'
  }

  if (
    summary.classes.length === 0 ||
    hasValidationCode(validations, [
      'CLASS_NOT_FOUND',
      'SUBCLASS_NOT_FOUND',
      'SUBCLASS_SELECTION_UNAVAILABLE',
      'SUBCLASS_PARENT_MISMATCH',
      'MULTICLASS_PREREQUISITE_UNMET'
    ]) ||
    hasOutstandingCode(outstandingChoices, [
      'SUBCLASS_SELECTION_REQUIRED',
      'SPECIALIZATION_REQUIRED',
      'SPELL_SELECTION_REQUIRED',
      'SPELL_SELECTION_INCOMPLETE',
      'SPELL_SELECTION_OVER_LIMIT',
      'SPELL_SELECTION_INVALID'
    ])
  ) {
    return 'CLASSES'
  }

  if (
    !character.intent.background.backgroundId ||
    hasValidationCode(validations, ['BACKGROUND_NOT_FOUND'])
  ) {
    return 'BACKGROUND'
  }

  if (
    Object.keys(summary.abilities).length < abilityOrder.length ||
    !isCharacterHitpointProgressionValid(
      character.intent.classes,
      character.intent.hitpoints.levels,
      true
    )
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
    const featureChoice = outstandingChoices.find(
      (choice) =>
        choice.code === 'FEATURE_SELECTION_REQUIRED' ||
        choice.code === 'FEATURE_SELECTION_INCOMPLETE'
    )
    return getCharacterBuilderSectionForSource(featureChoice?.source) ?? 'REVIEW'
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
  const race = registry.races.find(
    (record) =>
      record.ancestry?.id === selection.ancestryId &&
      record.ancestry.options.some((option) => option.id === selection.optionId)
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
  return (
    registry.features.find((record) => record.id === acquisition.featureId)?.label ??
    acquisition.featureId
  )
}

function buildSpellSelectionLabel(
  selection: CharacterSpellSelectionRecord,
  catalog: CharacterBuilderCatalog
): string {
  return selection.spells
    .map((spellId) => catalog.spells.find((record) => record.id === spellId)?.label ?? spellId)
    .join(', ')
}

function buildResourceGrantLabel(grant: CharacterResourceGrantRecord): string {
  return grant.resourceId
}

function summarizeRemoval(count: number, singular: string, plural = `${singular}s`): string | null {
  if (count <= 0) return null
  return count === 1 ? `1 ${singular} will be removed.` : `${count} ${plural} will be removed.`
}

function removedStartingEquipmentSelection(
  previous: CharacterStartingEquipmentDecision | undefined,
  next: CharacterStartingEquipmentDecision | undefined
): boolean {
  if (!previous) return false
  if (!next) return true

  return (previous.groups ?? []).some(
    (previousGroup) =>
      !(next.groups ?? []).some(
        (nextGroup) =>
          nextGroup.groupId === previousGroup.groupId &&
          nextGroup.optionId === previousGroup.optionId &&
          (previousGroup.selections ?? []).every((previousSelection) =>
            (nextGroup.selections ?? []).some(
              (nextSelection) =>
                nextSelection.selectionKey === previousSelection.selectionKey &&
                nextSelection.equipmentId === previousSelection.equipmentId &&
                nextSelection.quantity === previousSelection.quantity
            )
          )
      )
  )
}

export function createCharacterBuilderChangePreview(params: {
  previousCharacter: CharacterAuthored | null
  nextCharacter: CharacterAuthored
  predictedStatus: AuthoredRecordStatus
  context: CharacterBuilderContext
}): CharacterBuilderChangePreview {
  const previous = params.previousCharacter
  const next = params.nextCharacter
  const { catalog, registry } = params.context

  const removedAncestrySelections = (previous?.intent.ancestrySelections ?? [])
    .filter(
      (selection) =>
        !(next.intent.ancestrySelections ?? []).some((candidate) => candidate.id === selection.id)
    )
    .map((selection) => ({
      id: selection.id,
      label: buildAncestrySelectionLabel(selection, registry)
    }))

  const removedFeatureAcquisitions = (previous?.intent.featureAcquisitions ?? [])
    .filter(
      (acquisition) =>
        !next.intent.featureAcquisitions.some((candidate) => candidate.id === acquisition.id)
    )
    .map((acquisition) => ({
      id: acquisition.id,
      label: buildFeatureAcquisitionLabel(acquisition, registry)
    }))

  const removedSpellSelections = (previous?.intent.spellSelections ?? [])
    .filter(
      (selection) =>
        !(next.intent.spellSelections ?? []).some((candidate) => candidate.id === selection.id)
    )
    .map((selection) => ({
      id: selection.id,
      label: buildSpellSelectionLabel(selection, catalog)
    }))

  const removedResourceGrants = (previous?.intent.resourceGrants ?? [])
    .filter(
      (grant) => !(next.intent.resourceGrants ?? []).some((candidate) => candidate.id === grant.id)
    )
    .map((grant) => ({
      id: grant.id,
      label: buildResourceGrantLabel(grant)
    }))

  const clearedStartingEquipmentSources: CharacterStartingEquipmentSource[] = []
  if (
    removedStartingEquipmentSelection(
      previous?.intent.startingEquipment?.class,
      next.intent.startingEquipment?.class
    )
  ) {
    clearedStartingEquipmentSources.push(CharacterStartingEquipmentSource.CLASS)
  }
  if (
    removedStartingEquipmentSelection(
      previous?.intent.startingEquipment?.background,
      next.intent.startingEquipment?.background
    )
  ) {
    clearedStartingEquipmentSources.push(CharacterStartingEquipmentSource.BACKGROUND)
  }

  const downgradesStatus =
    previous?.status === AUTHORED_RECORD_STATUS.ACTIVE &&
    params.predictedStatus === AUTHORED_RECORD_STATUS.DRAFT

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

type SpellGrantFeature = {
  id: string
  grants?: { spells?: readonly unknown[] }
  options?: ReadonlyArray<{
    id: string
    grants?: { spells?: readonly unknown[] }
  }>
}

function featureContributesSpellGrant(
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

export async function loadCharacterBuilderContext(
  db: DBLike,
  character: CharacterAuthored
): Promise<CharacterBuilderContext> {
  const catalog = await loadCharacterBuilderCatalog(db, character.systemId, {
    includeSpells: false
  })
  const { registry: lightRegistry } = await loadCharacterAssemblyRegistry({
    db,
    character,
    catalog
  })
  const feats = lightRegistry.feats ?? []
  const equipment = lightRegistry.equipment
  const featsById = new Map(feats.map((feat) => [feat.id, feat]))
  const selectedFeaturesById = new Map(
    lightRegistry.features.map((feature) => [feature.id, feature])
  )
  const { classSelections, grantedFeatures } = collectGrantedFeaturesForCharacter(
    character,
    lightRegistry
  )
  const needsSpells = Boolean(
    character.intent.spellSelections?.length ||
    classSelections.some((selection) => selection.spellcasting.length > 0) ||
    grantedFeatures.some((granted) =>
      featureContributesSpellGrant(granted.feature, character, granted.source)
    ) ||
    character.intent.featureAcquisitions.some((acquisition) => {
      const feature = selectedFeaturesById.get(acquisition.featureId)
      if (feature && featureContributesSpellGrant(feature, character, acquisition.source)) {
        return true
      }

      if (acquisition.source.kind !== 'FEAT') return false
      const featId = acquisition.source.featId
      const feat = featsById.get(featId)
      return Boolean(
        feat?.grants?.spells?.length ||
        feat?.features?.some((feature) => featureContributesSpellGrant(feature, character))
      )
    }) ||
    equipment.some((record) =>
      record.features?.some((feature) => featureContributesSpellGrant(feature, character))
    )
  )
  const spells = needsSpells ? await loadCharacterBuilderSpellCatalog(db, character.systemId) : []

  return {
    catalog: {
      ...catalog,
      spells
    },
    registry: lightRegistry
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
      nextCharacter.intent.startingEquipment &&
      !nextCharacter.intent.startingEquipment.class &&
      !nextCharacter.intent.startingEquipment.background
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
    existingCharacter.intent.background.backgroundId !==
    nextCharacter.intent.background.backgroundId
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
    nextCharacter.intent.startingEquipment &&
    !nextCharacter.intent.startingEquipment.class &&
    !nextCharacter.intent.startingEquipment.background
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

function getCharacterChosenGrantOwners(
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

function createStartingEquipmentEligibilitySnapshot(
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

function createStartingEquipmentEligibilityContext(params: {
  character: CharacterAuthored
  registry: CharacterBuilderRegistry
  grantedFeatures: readonly GrantedFeatureRecord[]
  abilityScores: Partial<Record<AbilityCode, number>>
}): {
  context: CharacterEligibilityContext
  registry: ReturnType<typeof createCharacterAssemblyRegistry>
} {
  const registry = createCharacterAssemblyRegistry(params.registry)
  const snapshot = createStartingEquipmentEligibilitySnapshot(
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

function filterStartingEquipmentByEligibility(
  startingEquipment: StartingEquipmentAuthored,
  context: CharacterEligibilityContext,
  registry: ReturnType<typeof createCharacterAssemblyRegistry>
): StartingEquipmentAuthored {
  return {
    ...startingEquipment,
    sets: startingEquipment.sets.map((set) => ({
      ...set,
      groups: set.groups.map((group) => ({
        ...group,
        options: group.options.filter(
          (option) => evaluateCharacterFacet(option.eligibility, context, registry).passed
        )
      }))
    }))
  }
}

function resolveEligibleStartingEquipment(params: {
  character: CharacterAuthored
  registry: CharacterBuilderRegistry
  grantedFeatures: readonly GrantedFeatureRecord[]
  abilityScores: Partial<Record<AbilityCode, number>>
  primaryClass?: ParentClassAuthored
  selectedBackground?: BackgroundAuthored
}): {
  classStartingEquipment?: StartingEquipmentAuthored
  backgroundStartingEquipment?: StartingEquipmentAuthored
} {
  const classStartingEquipment = params.primaryClass?.startingEquipment
  const backgroundStartingEquipment = params.selectedBackground?.startingEquipment
  if (!classStartingEquipment && !backgroundStartingEquipment) return {}

  const hasEligibility = [classStartingEquipment, backgroundStartingEquipment]
    .filter((record): record is StartingEquipmentAuthored => Boolean(record))
    .some((record) =>
      record.sets.some((set) =>
        set.groups.some((group) => group.options.some((option) => Boolean(option.eligibility)))
      )
    )
  if (!hasEligibility) {
    return {
      classStartingEquipment,
      backgroundStartingEquipment
    }
  }

  const { context, registry } = createStartingEquipmentEligibilityContext(params)

  return {
    classStartingEquipment: classStartingEquipment
      ? filterStartingEquipmentByEligibility(classStartingEquipment, context, registry)
      : undefined,
    backgroundStartingEquipment: backgroundStartingEquipment
      ? filterStartingEquipmentByEligibility(backgroundStartingEquipment, context, registry)
      : undefined
  }
}

function reconcileStartingEquipmentDecision(
  decision: CharacterStartingEquipmentDecision | undefined,
  startingEquipment: StartingEquipmentAuthored | undefined,
  catalog: CharacterBuilderCatalog
): CharacterStartingEquipmentDecision | undefined {
  if (!decision || !startingEquipment || decision.tookGold) return decision

  const optionsByGroup = new Map(
    startingEquipment.sets.flatMap((set) =>
      set.groups.map(
        (group) => [group.id, new Map(group.options.map((option) => [option.id, option]))] as const
      )
    )
  )
  const groups = (decision.groups ?? []).flatMap((group) => {
    const option = optionsByGroup.get(group.groupId)?.get(group.optionId)
    if (!option) return []

    const chosenItemsById = new Map(
      option.items.filter(isChosenStartingEquipmentItem).map((item) => [item.id, item])
    )
    const selections = (group.selections ?? []).filter((selection) => {
      const item = chosenItemsById.get(selection.selectionKey)
      return Boolean(
        item &&
        selection.quantity > 0 &&
        isEquipmentAllowedForStartingItem(item, selection.equipmentId, catalog)
      )
    })

    return [
      {
        ...group,
        ...(group.selections ? { selections } : {})
      }
    ]
  })

  if ((decision.groups?.length ?? 0) > 0 && groups.length === 0) return undefined

  return {
    ...decision,
    groups
  }
}

function hasStartingEquipmentGroupWithoutEligibleOptions(
  startingEquipment: StartingEquipmentAuthored | undefined
): boolean {
  return Boolean(
    startingEquipment?.sets.some((set) => set.groups.some((group) => group.options.length === 0))
  )
}

function appendChosenGrantChoiceIssues(
  character: CharacterAuthored,
  choices: CharacterBuilderChosenGrantChoice[],
  outstandingChoices: CharacterBuilderIssue[],
  validations: CharacterBuilderValidation[]
): void {
  const activeKeys = new Set(
    choices.map((choice) => getCharacterChosenGrantSelectionIdentityKey(choice))
  )
  const seenSelectionKeys = new Set<string>()
  const reportedDuplicateSelectionKeys = new Set<string>()

  for (const selection of character.intent.chosenGrantSelections ?? []) {
    const key = getCharacterChosenGrantSelectionIdentityKey(selection)
    if (seenSelectionKeys.has(key) && !reportedDuplicateSelectionKeys.has(key)) {
      validations.push({
        code: 'DUPLICATE_CHOSEN_GRANT_SELECTION_IDENTITY',
        severity: 'blocking',
        message: `Grant selection "${selection.grantId}" is recorded more than once for the same source.`
      })
      reportedDuplicateSelectionKeys.add(key)
    }
    seenSelectionKeys.add(key)
  }

  for (const choice of choices) {
    const selectedIds = choice.selectedTargetIds
    const allowedIds = new Set(choice.options.map((option) => option.id))
    const selectedDisabledOption = choice.options.find(
      (option) => selectedIds.includes(option.id) && option.disabledReason
    )
    const disabledReason = selectedDisabledOption?.disabledReason
    if (disabledReason) {
      validations.push({
        code: disabledReason.startsWith('Requires full proficiency')
          ? 'EXPERTISE_REQUIRES_PROFICIENCY'
          : 'REDUNDANT_PROFICIENCY_SELECTION',
        severity: 'blocking',
        message: `${choice.label}: ${disabledReason}`,
        sourceLabel: choice.sourceLabel,
        source: choice.source
      })
    }
    const invalidTarget = selectedIds.some((targetId) => !allowedIds.has(targetId))
    const hasDuplicate = new Set(selectedIds).size !== selectedIds.length
    const isUniqueDuplicate = choice.duplicatePolicy === 'UNIQUE' && hasDuplicate
    const isIncomplete = selectedIds.length < choice.requiredCount
    const isOverLimit = selectedIds.length > choice.requiredCount

    if (choice.options.length === 0) {
      validations.push({
        code: 'CHOSEN_GRANT_OPTIONS_UNAVAILABLE',
        severity: 'blocking',
        message: `${choice.label} does not expose selectable targets.`,
        sourceLabel: choice.sourceLabel,
        source: choice.source
      })
      continue
    }

    if (invalidTarget || isUniqueDuplicate || isOverLimit) {
      validations.push({
        code: invalidTarget
          ? 'CHOSEN_GRANT_SELECTION_INVALID'
          : isUniqueDuplicate
            ? 'CHOSEN_GRANT_SELECTION_DUPLICATE'
            : 'CHOSEN_GRANT_SELECTION_OVER_LIMIT',
        severity: 'blocking',
        message: invalidTarget
          ? `${choice.label} includes a selection that is no longer available.`
          : isUniqueDuplicate
            ? `${choice.label} requires different selections in each slot.`
            : `${choice.label} has too many selections.`,
        sourceLabel: choice.sourceLabel,
        source: choice.source
      })
      continue
    }

    if (isIncomplete) {
      outstandingChoices.push({
        code:
          selectedIds.length === 0
            ? 'CHOSEN_GRANT_SELECTION_REQUIRED'
            : 'CHOSEN_GRANT_SELECTION_INCOMPLETE',
        message: `${choice.label} requires ${choice.requiredCount} selection${choice.requiredCount === 1 ? '' : 's'}.`,
        sourceLabel: choice.sourceLabel,
        source: choice.source,
        required: true
      })
    }
  }

  for (const selection of character.intent.chosenGrantSelections ?? []) {
    const key = getCharacterChosenGrantSelectionIdentityKey(selection)
    if (activeKeys.has(key)) continue
    validations.push({
      code: 'STALE_CHOSEN_GRANT_SELECTION',
      severity: 'blocking',
      message: `Grant selection "${selection.grantId}" no longer matches the current build.`,
      source: selection.source
    })
  }
}

function appendDuplicateSpellSelectionIssues(
  character: CharacterAuthored,
  choices: CharacterBuilderChosenGrantChoice[],
  catalog: CharacterBuilderCatalog,
  validations: CharacterBuilderValidation[]
): void {
  const sourcesBySpellId = new Map<string, CharacterProvenance[]>()
  const addSelections = (spellIds: readonly string[], source: CharacterProvenance): void => {
    for (const spellId of spellIds) {
      const sources = sourcesBySpellId.get(spellId) ?? []
      sources.push(source)
      sourcesBySpellId.set(spellId, sources)
    }
  }

  for (const choice of choices) {
    if (choice.grantKind === GRANT_KIND.SPELL_GRANT) {
      addSelections(choice.selectedTargetIds, choice.source)
    }
  }
  for (const selection of character.intent.spellSelections ?? []) {
    addSelections(selection.spells, selection.source)
  }

  for (const [spellId, sources] of sourcesBySpellId) {
    const hasDifferentSources = sources.some((source, index) =>
      sources.slice(index + 1).some((otherSource) =>
        !isSameCharacterProvenanceIdentity(source, otherSource)
      )
    )
    if (!hasDifferentSources) continue

    const spellLabel = catalog.spells.find((spell) => spell.id === spellId)?.label
    validations.push({
      code: 'DUPLICATE_SPELL_SELECTION',
      severity: 'blocking',
      message: spellLabel
        ? `Spell selection "${spellLabel}" is selected by multiple sources.`
        : `Spell selection "${spellId}" is selected by multiple sources.`
    })
  }
}

export async function reconcileCharacterBuilderCharacter(
  db: DBLike,
  character: CharacterAuthored,
  existingCharacter: CharacterAuthored | null = null,
  providedContext?: CharacterBuilderContext
): Promise<CharacterAuthored> {
  const context = providedContext ?? (await loadCharacterBuilderContext(db, character))
  const { catalog, registry } = context
  const nextCharacter = clearObsoleteStartingEquipmentSelections(character, existingCharacter)
  nextCharacter.intent.hitpoints.levels = normalizeCharacterHitpointLevels(
    nextCharacter,
    registry.classes,
    existingCharacter
  )
  nextCharacter.state.hitpoints.hitDice = reconcileCharacterHitDice(
    nextCharacter.intent.classes,
    registry.classes,
    nextCharacter.state.hitpoints.hitDice
  )
  if (existingCharacter?.status !== AUTHORED_RECORD_STATUS.ACTIVE) {
    const startingHitPoints = nextCharacter.intent.hitpoints.levels.reduce(
      (total, level) => total + level.value,
      0
    )
    if (startingHitPoints > 0) {
      nextCharacter.state.hitpoints.current = startingHitPoints
    }
  }

  const ancestrySelections = (nextCharacter.intent.ancestrySelections ?? []).filter((selection) => {
    const race = nextCharacter.intent.race.subraceId
      ? registry.races.find((record) => record.id === nextCharacter.intent.race.subraceId)
      : registry.races.find(
          (record) =>
            record.category === RACE_CATEGORY_CODE.BASE &&
            record.id === nextCharacter.intent.race.raceId
        )

    if (!race?.ancestry) return false
    if (selection.ancestryId !== race.ancestry.id) return false
    if (!race.ancestry.options.some((option) => option.id === selection.optionId)) return false
    return isValidAncestrySource(nextCharacter, selection.source)
  })

  nextCharacter.intent.ancestrySelections =
    ancestrySelections.length > 0 ? ancestrySelections : undefined

  const { classSelections, grantedFeatures, selectedBackground } =
    collectGrantedFeaturesForCharacter(nextCharacter, registry)

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

  const chosenGrantChoices = resolveCharacterChosenGrantChoices(
    filteredCharacter,
    getCharacterChosenGrantChoiceRegistry(context),
    getCharacterChosenGrantOwners(
      filteredCharacter,
      classSelections,
      collectGrantedFeaturesForCharacter(filteredCharacter, registry).selectedBackground,
      grantedFeatures
    )
  )
  const chosenGrantSelections = (nextCharacter.intent.chosenGrantSelections ?? []).filter(
    (selection) =>
      chosenGrantChoices.some(
        (choice) =>
          choice.grantId === selection.grantId &&
          choice.progressionLevel === selection.progressionLevel &&
          isSameCharacterProvenanceIdentity(choice.source, selection.source)
      )
  )
  nextCharacter.intent.chosenGrantSelections =
    chosenGrantSelections.length > 0 ? chosenGrantSelections : undefined
  const spellSelections = (nextCharacter.intent.spellSelections ?? []).filter((selection) =>
    isProvenanceStillValid(selection.source, filteredCharacter, registry, grantedFeatures)
  )
  nextCharacter.intent.spellSelections = spellSelections.length > 0 ? spellSelections : undefined

  const requiredResourceGrants = getRequiredClassResourceGrants(classSelections)
  const validResourceGrants = (nextCharacter.intent.resourceGrants ?? [])
    .filter((grant) =>
      isProvenanceStillValid(grant.source, filteredCharacter, registry, grantedFeatures)
    )
    .filter((grant) =>
      isClassResourceGrantSource(grant.source)
        ? requiredResourceGrants.some((requiredGrant) =>
            isSameRequiredResourceGrant(grant, requiredGrant)
          )
        : true
    )
  const resourceGrants = mergeRequiredResourceGrants(validResourceGrants, requiredResourceGrants)
  nextCharacter.intent.resourceGrants = resourceGrants.length > 0 ? resourceGrants : undefined

  const primaryClass = classSelections[0]?.baseClass
  if (primaryClass || selectedBackground?.startingEquipment) {
    const eligibleStartingEquipment = resolveEligibleStartingEquipment({
      character: nextCharacter,
      registry,
      grantedFeatures,
      abilityScores: deriveAbilityScores(nextCharacter.intent.abilities),
      primaryClass,
      selectedBackground
    })

    if (nextCharacter.intent.startingEquipment?.class) {
      nextCharacter.intent.startingEquipment.class = reconcileStartingEquipmentDecision(
        nextCharacter.intent.startingEquipment.class,
        eligibleStartingEquipment.classStartingEquipment,
        catalog
      )
    }
    if (nextCharacter.intent.startingEquipment?.background) {
      nextCharacter.intent.startingEquipment.background = reconcileStartingEquipmentDecision(
        nextCharacter.intent.startingEquipment.background,
        eligibleStartingEquipment.backgroundStartingEquipment,
        catalog
      )
    }
    if (
      nextCharacter.intent.startingEquipment &&
      !nextCharacter.intent.startingEquipment.class &&
      !nextCharacter.intent.startingEquipment.background
    ) {
      delete nextCharacter.intent.startingEquipment
    }
  }

  return nextCharacter
}

function isClassResourceGrantSource(source: CharacterProvenance): boolean {
  return source.kind === 'CLASS' || source.kind === 'SUBCLASS'
}

export async function resolveCharacterBuilder(
  db: DBLike,
  character: CharacterAuthored,
  mode: BuilderMode,
  providedContext?: CharacterBuilderContext
): Promise<CharacterBuilderResolution> {
  const context = providedContext ?? (await loadCharacterBuilderContext(db, character))
  const { catalog, registry } = context
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
  const chosenGrantChoices = resolveCharacterChosenGrantChoices(
    character,
    getCharacterChosenGrantChoiceRegistry(context),
    getCharacterChosenGrantOwners(character, classSelections, selectedBackground, grantedFeatures)
  )
  const primaryClass = classSelections[0]?.baseClass
  const eligibleStartingEquipment = resolveEligibleStartingEquipment({
    character,
    registry,
    grantedFeatures,
    abilityScores,
    primaryClass,
    selectedBackground
  })
  const classStartingEquipment = eligibleStartingEquipment.classStartingEquipment
  const backgroundStartingEquipment = eligibleStartingEquipment.backgroundStartingEquipment
  const resolvedRegistry: CharacterBuilderRegistry = {
    ...registry,
    classes:
      primaryClass && classStartingEquipment
        ? registry.classes.map((record) =>
            record.id === primaryClass.id && record.category === CLASS_CATEGORY.BASE
              ? { ...record, startingEquipment: classStartingEquipment }
              : record
          )
        : registry.classes,
    backgrounds:
      selectedBackground && backgroundStartingEquipment
        ? registry.backgrounds.map((record) =>
            record.id === selectedBackground.id
              ? { ...record, startingEquipment: backgroundStartingEquipment }
              : record
          )
        : registry.backgrounds
  }

  const grants: CharacterBuilderGrantedContent = {
    features: grantedFeatures.map((record) => ({
      id: record.feature.id,
      label: record.feature.label,
      description: record.feature.description,
      sortOrder: record.feature.order,
      availableAtLevel: record.feature.availableAtLevel,
      attributes: record.feature.attributes,
      sourceLabel: record.sourceLabel,
      source: record.source
    })),
    resources: classSelections.flatMap((selection) => {
      const items: CharacterBuilderGrantSummaryItem[] = []
      if (
        selection.baseClass?.resources &&
        selection.baseClass.resources.availableAtLevel <= selection.row.classLevel
      ) {
        items.push({
          id: selection.baseClass.resources.id,
          label: selection.baseClass.resources.label,
          description: selection.baseClass.resources.description,
          sortOrder: selection.baseClass.resources.order,
          availableAtLevel: selection.baseClass.resources.availableAtLevel,
          sourceLabel: selection.baseClass.label,
          source: {
            kind: 'CLASS',
            classId: selection.baseClass.id,
            classLevel: selection.row.classLevel
          }
        })
      }
      if (
        selection.subclass?.resources &&
        selection.subclass.resources.availableAtLevel <= selection.row.classLevel
      ) {
        items.push({
          id: selection.subclass.resources.id,
          label: selection.subclass.resources.label,
          description: selection.subclass.resources.description,
          sortOrder: selection.subclass.resources.order,
          availableAtLevel: selection.subclass.resources.availableAtLevel,
          sourceLabel: selection.subclass.label,
          source: {
            kind: 'SUBCLASS',
            subclassId: selection.subclass.id,
            classLevel: selection.row.classLevel
          }
        })
      }
      return items
    }),
    spellcasting: classSelections.flatMap((selection) => {
      const items: CharacterBuilderGrantSummaryItem[] = []
      if (
        selection.baseClass?.spellcasting &&
        (selection.baseClass.spellcasting.availableAtLevel ?? 1) <= selection.row.classLevel
      ) {
        items.push({
          id: `${selection.baseClass.id}:spellcasting`,
          label: selection.baseClass.spellcasting.magicName ?? 'Spellcasting',
          details: selection.baseClass.spellcasting.details
            ?.slice()
            .sort((left, right) => left.order - right.order)
            .map((detail) => ({ id: detail.id, label: detail.label, description: detail.description })),
          sortOrder: selection.baseClass.spellcasting.order,
          availableAtLevel: selection.baseClass.spellcasting.availableAtLevel ?? 1,
          sourceLabel: selection.baseClass.label,
          source: {
            kind: 'CLASS',
            classId: selection.baseClass.id,
            classLevel: selection.row.classLevel
          }
        })
      }
      if (
        selection.subclass?.spellcasting &&
        (selection.subclass.spellcasting.availableAtLevel ?? 1) <= selection.row.classLevel
      ) {
        items.push({
          id: `${selection.subclass.id}:spellcasting`,
          label: selection.subclass.spellcasting.magicName ?? 'Spellcasting',
          details: selection.subclass.spellcasting.details
            ?.slice()
            .sort((left, right) => left.order - right.order)
            .map((detail) => ({ id: detail.id, label: detail.label, description: detail.description })),
          sortOrder: selection.subclass.spellcasting.order,
          availableAtLevel: selection.subclass.spellcasting.availableAtLevel ?? 1,
          sourceLabel: selection.subclass.label,
          source: {
            kind: 'SUBCLASS',
            subclassId: selection.subclass.id,
            classLevel: selection.row.classLevel
          }
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
          subraceId:
            selectedRace.category === RACE_CATEGORY_CODE.SUBRACE ? selectedRace.id : undefined,
          subraceLabel:
            selectedRace.category === RACE_CATEGORY_CODE.SUBRACE ? selectedRace.label : undefined,
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

  appendAbilityIntentValidationIssues(character, validations)
  appendManualHitpointValidationIssues(character, registry.classes, validations)

  if (
    !isCharacterHitpointProgressionValid(
      character.intent.classes,
      character.intent.hitpoints.levels
    )
  ) {
    validations.push({
      code: 'INVALID_HITPOINT_PROGRESSION',
      severity: 'blocking',
      message: 'Hit point entries no longer match the selected class progression.'
    })
  }

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

    if (
      selection.baseClass &&
      selection.subclass &&
      selection.subclass.parentClassId !== selection.baseClass.id
    ) {
      validations.push({
        code: 'SUBCLASS_PARENT_MISMATCH',
        severity: 'blocking',
        message: `${selection.subclass.label} no longer belongs to ${selection.baseClass.label}.`
      })
    }

    if (
      selection.row.subclassId &&
      selection.baseClass &&
      (selection.baseClass.subclassSelectionLevel === undefined ||
        selection.row.classLevel < selection.baseClass.subclassSelectionLevel)
    ) {
      const availableAt = selection.baseClass.subclassSelectionLevel
      validations.push({
        code: 'SUBCLASS_SELECTION_UNAVAILABLE',
        severity: 'blocking',
        message:
          availableAt === undefined
            ? `${selection.baseClass.label} does not define a subclass selection level.`
            : `${selection.baseClass.label} cannot select a subclass before class level ${availableAt}.`
      })
    }
  }

  validations.push(...validateMulticlass(classSelections, abilityScores))

  const outstandingChoices: CharacterBuilderIssue[] = []
  appendChosenGrantChoiceIssues(character, chosenGrantChoices, outstandingChoices, validations)
  appendDuplicateSpellSelectionIssues(character, chosenGrantChoices, catalog, validations)

  if (selectedRace?.ancestry && !selectedAncestryOption) {
    outstandingChoices.push({
      code: 'ANCESTRY_SELECTION_REQUIRED',
      message: `${selectedRace.ancestry.label} requires an option selection.`,
      sourceLabel: selectedRace.label,
      required: true
    })
  }

  for (const selection of classSelections) {
    const availableSubclasses = getAvailableSubclassesForClass({
      classId: selection.row.classId,
      classLevel: selection.row.classLevel,
      catalog,
      registry
    })
    if (availableSubclasses.length > 0 && !selection.row.subclassId) {
      outstandingChoices.push({
        code: 'SUBCLASS_SELECTION_REQUIRED',
        message: `${selection.baseClass?.label ?? 'This class'} requires a subclass selection at class level ${selection.baseClass?.subclassSelectionLevel}.`,
        sourceLabel: selection.baseClass?.label ?? 'Class',
        source: {
          kind: 'CLASS',
          classId: selection.row.classId,
          classLevel: selection.row.classLevel
        },
        required: true
      })
    }

    if (selection.subclass?.specializations?.length && !selection.row.specializationId) {
      outstandingChoices.push({
        code: 'SPECIALIZATION_REQUIRED',
        message: `${selection.subclass.label} requires a specialization.`,
        sourceLabel: selection.subclass.label,
        required: true
      })
    }
  }

  for (const requirement of getClassSpellChoiceRequirements(classSelections)) {
    const spellSelection = character.intent.spellSelections?.find((selection) =>
      isSameCharacterProvenanceIdentity(selection.source, requirement.source)
    )
    const selectedCounts = getSpellSelectionCounts(spellSelection, catalog)
    const missingCantrips = selectedCounts.cantrips < requirement.cantripLimit
    const missingSpells = selectedCounts.spells < requirement.learnedSpellLimit
    const tooManyCantrips = selectedCounts.cantrips > requirement.cantripLimit
    const tooManySpells = selectedCounts.spells > requirement.learnedSpellLimit
    const invalidSpellIds = getInvalidSpellSelectionIds(spellSelection, requirement, catalog)
    const invalidSpells = invalidSpellIds.length > 0
    if (!missingCantrips && !missingSpells && !tooManyCantrips && !tooManySpells && !invalidSpells)
      continue

    const overLimit = tooManyCantrips || tooManySpells
    const spellSelectionIssueCode = invalidSpells
      ? 'SPELL_SELECTION_INVALID'
      : overLimit
        ? 'SPELL_SELECTION_OVER_LIMIT'
        : spellSelection
          ? 'SPELL_SELECTION_INCOMPLETE'
          : 'SPELL_SELECTION_REQUIRED'
    const spellSelectionIssueMessage = invalidSpells
      ? `${requirement.label} includes spells outside the allowed class spell list.`
      : overLimit
        ? `${requirement.label} has too many selected spells for the current class level.`
        : `${requirement.label} requires spell selections.`

    outstandingChoices.push({
      code: spellSelectionIssueCode,
      message: spellSelectionIssueMessage,
      sourceLabel: requirement.sourceLabel,
      source: requirement.source,
      required: true
    })
  }

  if (
    primaryClass &&
    eligibleStartingEquipment.classStartingEquipment?.sets.length &&
    !isStartingEquipmentDecisionComplete(
      eligibleStartingEquipment.classStartingEquipment,
      character.intent.startingEquipment?.class,
      catalog
    )
  ) {
    outstandingChoices.push({
      code: 'CLASS_STARTING_EQUIPMENT_REQUIRED',
      message: `${primaryClass.label} has starting equipment choices to resolve.`,
      sourceLabel: primaryClass.label,
      required: true
    })
  }

  if (
    selectedBackground &&
    eligibleStartingEquipment.backgroundStartingEquipment?.sets.length &&
    !isStartingEquipmentDecisionComplete(
      eligibleStartingEquipment.backgroundStartingEquipment,
      character.intent.startingEquipment?.background,
      catalog
    )
  ) {
    outstandingChoices.push({
      code: 'BACKGROUND_STARTING_EQUIPMENT_REQUIRED',
      message: `${selectedBackground.label} has starting equipment choices to resolve.`,
      sourceLabel: selectedBackground.label,
      required: true
    })
  }

  if (
    hasStartingEquipmentGroupWithoutEligibleOptions(
      eligibleStartingEquipment.backgroundStartingEquipment
    )
  ) {
    validations.push({
      code: 'BACKGROUND_STARTING_EQUIPMENT_UNAVAILABLE',
      severity: 'blocking',
      message: `${selectedBackground?.label ?? 'The selected background'} has no eligible option for a required starting equipment group.`
    })
  }

  for (const granted of grantedFeatures) {
    const requiredOptionCount = (granted.feature.optionChoices ?? [])
      .filter((choice) => choice.level <= granted.level)
      .reduce((sum, choice) => sum + choice.count, 0)

    if (requiredOptionCount <= 0) continue

    const acquisition = character.intent.featureAcquisitions.find(
      (record) =>
        record.featureId === granted.feature.id &&
        isSameCharacterProvenanceIdentity(record.source, granted.source)
    )

    if (!acquisition) {
      outstandingChoices.push({
        code: 'FEATURE_SELECTION_REQUIRED',
        message: `${granted.feature.label} requires a selection.`,
        sourceLabel: granted.sourceLabel,
        source: granted.source,
        required: true
      })
      continue
    }

    const selectedOptionIds = getSelectedFeatureOptionIds(
      granted.feature,
      character,
      granted.source
    )
    const allowedOptionIds = new Set((granted.feature.options ?? []).map((option) => option.id))
    const hasInvalidOption = selectedOptionIds.some((optionId) => !allowedOptionIds.has(optionId))
    const hasDuplicateOption = new Set(selectedOptionIds).size !== selectedOptionIds.length

    if (hasInvalidOption || hasDuplicateOption || selectedOptionIds.length > requiredOptionCount) {
      validations.push({
        code: hasInvalidOption
          ? 'FEATURE_SELECTION_INVALID'
          : hasDuplicateOption
            ? 'FEATURE_SELECTION_DUPLICATE'
            : 'FEATURE_SELECTION_OVER_LIMIT',
        severity: 'blocking',
        message: hasInvalidOption
          ? `${granted.feature.label} includes a selection that is no longer available.`
          : hasDuplicateOption
            ? `${granted.feature.label} requires different selections in each slot.`
            : `${granted.feature.label} has too many selections.`
      })
      continue
    }

    if (selectedOptionIds.length < requiredOptionCount) {
      outstandingChoices.push({
        code: 'FEATURE_SELECTION_INCOMPLETE',
        message: `${granted.feature.label} has incomplete selections.`,
        sourceLabel: granted.sourceLabel,
        source: granted.source,
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

  if (
    selectedAncestry &&
    !selectedRace?.ancestry?.options.some((option) => option.id === selectedAncestry.optionId)
  ) {
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
    catalog,
    registry: resolvedRegistry,
    summary,
    grants,
    chosenGrantChoices,
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
