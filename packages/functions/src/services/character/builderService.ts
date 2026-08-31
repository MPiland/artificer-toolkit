import { createAuthoredVersionRepository, type DBLike } from '@artificer-toolkit/db'
import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'
import {
  ADVANCEMENT_METHOD_CODE,
  AUTHORED_RECORD_STATUS,
  CLASS_CATEGORY,
  CHARACTER_ABILITY_GENERATION_METHOD,
  HITPOINT_CALCULATION_METHOD_CODE,
  RACE_CATEGORY_CODE,
  type AbilityCode,
  type AuthoredRecordStatus
} from '@artificer-toolkit/shared/core'
import {
  CharacterStartingEquipmentSource,
  getCharacterChosenGrantSelectionIdentityKey,
  isSameCharacterProvenanceIdentity,
  type BackgroundAuthored,
  type CharacterAuthored,
  type CharacterProvenance,
  type FeatAuthored,
  type ClassAuthored,
  type SpellAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'
import type { ResolvedEquipment, ResolvedRace } from '@artificer-toolkit/shared/subjects/compilers'
import {
  createSystemVocabularySnapshotRepository,
  type SystemSeedRecord
} from '@artificer-toolkit/db'
import {
  getSelectedFeatureOptionIds,
  resolveCharacterChosenGrantChoices,
  type CharacterBuilderChosenGrantChoice,
  type CharacterChosenGrantChoiceRegistry
} from './chosenGrantChoiceResolver.js'
import {
  loadCharacterBuilderCatalog,
  loadCharacterBuilderSpellCatalog,
  loadCharacterStructuralSpellCatalog,
  loadCharacterStructuralSubclassCatalog,
  mergeCampaignContentIntoCharacterBuilderCatalog,
  toCharacterBuilderSpellCatalogRecord,
  type CharacterBuilderCatalog
} from './builderCatalog.js'
import { loadCharacterAssemblyRegistry } from './characterAssemblyOrchestrator.js'
import {
  hydrateCampaignCatalogContent,
  loadCampaignCharacterContentOverlay,
  type CampaignAuthoredSource
} from './campaignCharacterContent.js'
import {
  appendAbilityIntentValidationIssues,
  featureContributesSpellGrant,
  filterRegistryFeatureOptions,
  getAvailableSubclassesForClass,
  getCharacterChosenGrantOwners,
  isProvenanceStillValid,
  resolveFeatureOptionEligibility,
  validateMulticlass
} from './builderEligibility.js'
import {
  collectGrantedFeaturesForCharacter,
  deriveAbilityScores,
  isValidAncestrySource
} from './characterBuilderSelections.js'
import {
  appendDuplicateSpellSelectionIssues,
  getClassSpellChoiceRequirements,
  getInvalidSpellSelectionIds,
  getSpellSelectionCounts
} from './builderSpellSelection.js'
import {
  compileStartingEquipmentEligibilityRuleFacts,
  hasStartingEquipmentGroupWithoutEligibleOptions,
  isStartingEquipmentDecisionComplete,
  resolveEligibleStartingEquipment
} from './builderStartingEquipment.js'
import {
  createReadiness,
  resolveRecommendedCharacterBuilderSection
} from './builderPresentation.js'
import {
  appendManualHitpointValidationIssues,
  isCharacterHitpointProgressionValid
} from './builderHitPoints.js'
import { assembleCharacterRuleSnapshot } from './characterRuleSnapshot.js'
import {
  buildCharacterSpellRuleFacts,
  collectCharacterRuleInputSpellIds
} from './characterSpellRuleFacts.js'

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
  /** Exact current Spell documents authorized for this Character context. */
  spellDocumentsById?: ReadonlyMap<string, SpellAuthored>
  /** Exact server-loaded vocabulary snapshot that produced this registry. */
  vocabularySnapshot?: SystemVocabularySnapshot
}

export interface CharacterBuilderContextLoadOptions {
  includeEffects?: boolean
  referenceSpellIds?: readonly string[]
}

export function collectContextSpellIds(
  character: CharacterAuthored,
  context: CharacterBuilderContext,
  referenceSpellIds: readonly string[] | undefined
): readonly string[] {
  const assembled = assembleCharacterRuleSnapshot({ character, context })
  const spellFacts = buildCharacterSpellRuleFacts(assembled.snapshot, assembled.registry)
  return [
    ...collectCharacterRuleInputSpellIds({
      referenceSpellIds,
      spellAccessCandidates: spellFacts.spellAccessCandidates,
      spellSources: assembled.snapshot.spellSources
    })
  ]
}

function getRealCampaignSpellDocuments(
  campaignContent: Awaited<ReturnType<typeof loadCampaignCharacterContentOverlay>>
): SpellAuthored[] {
  if (!campaignContent) return []
  return [...campaignContent.latest.entries()].flatMap(([key, source]) =>
    source.subjectKind === 'SPELL' && campaignContent.sharesByRoot.has(key)
      ? [source.authored as SpellAuthored]
      : []
  )
}

export function getCharacterChosenGrantChoiceRegistry(
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
  sourceRegistry: CharacterBuilderRegistry
  summary: CharacterBuilderSummary
  grants: CharacterBuilderGrantedContent
  chosenGrantChoices: CharacterBuilderChosenGrantChoice[]
  outstandingChoices: CharacterBuilderIssue[]
  validations: CharacterBuilderValidation[]
  readiness: CharacterBuilderReadiness
  recommendedSectionId: CharacterBuilderSectionId
}

export function createEmptyCharacterAuthored(params: {
  id: string
  primaryRulesCatalogueId: string
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
    primaryRulesCatalogueId: params.primaryRulesCatalogueId,
    userId: params.userId
  }
}

export async function loadCharacterBuilderContext(
  db: DBLike,
  character: CharacterAuthored,
  campaignContentOverrides: readonly CampaignAuthoredSource[] = [],
  options: CharacterBuilderContextLoadOptions = {}
): Promise<CharacterBuilderContext> {
  const [baseCatalog, campaignContent, vocabularySnapshot] = await Promise.all([
    loadCharacterBuilderCatalog(db, character.systemId, character.userId, { includeSpells: false }),
    loadCampaignCharacterContentOverlay(db, character, campaignContentOverrides),
    createSystemVocabularySnapshotRepository(db).findActive(character.systemId)
  ])
  if (!vocabularySnapshot) {
    throw new Error(`Character "${character.id}" has no active System vocabulary snapshot.`)
  }
  const campaignCatalogContent = campaignContent
    ? await hydrateCampaignCatalogContent(db, campaignContent)
    : null
  const catalog = campaignCatalogContent
    ? mergeCampaignContentIntoCharacterBuilderCatalog(baseCatalog, campaignCatalogContent)
    : baseCatalog
  const { registry: lightRegistry } = await loadCharacterAssemblyRegistry({
    db,
    character,
    catalog,
    campaignContent,
    includeEffects: options.includeEffects
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
  const spells = needsSpells
    ? campaignCatalogContent
      ? mergeCampaignContentIntoCharacterBuilderCatalog(
          {
            ...catalog,
            spells: await loadCharacterBuilderSpellCatalog(db, character.systemId, character.userId)
          },
          campaignCatalogContent
        ).spells
      : await loadCharacterBuilderSpellCatalog(db, character.systemId, character.userId)
    : []

  const context: CharacterBuilderContext = {
    catalog: {
      ...catalog,
      spells
    },
    registry: lightRegistry,
    vocabularySnapshot
  }
  const spellIds = collectContextSpellIds(character, context, options.referenceSpellIds)
  const spellDocuments = await loadCharacterStructuralSpellCatalog({
    db,
    systemId: character.systemId,
    userId: character.userId,
    campaignSpells: getRealCampaignSpellDocuments(campaignContent),
    spellIds
  })

  return {
    ...context,
    spellDocumentsById: new Map(spellDocuments.map((spell) => [spell.id, spell]))
  }
}

export async function loadCharacterStructuralRuleContext(
  db: DBLike,
  character: CharacterAuthored,
  campaignContentOverrides: readonly CampaignAuthoredSource[] = [],
  options: CharacterBuilderContextLoadOptions = {}
): Promise<CharacterBuilderContext> {
  const campaignContent = await loadCampaignCharacterContentOverlay(
    db,
    character,
    campaignContentOverrides
  )
  const vocabularySnapshot = await createSystemVocabularySnapshotRepository(db).findActive(
    character.systemId
  )
  if (!vocabularySnapshot) {
    throw new Error(`Character "${character.id}" has no active System vocabulary snapshot.`)
  }
  const campaignSources = new Map(campaignContent?.latest ?? [])
  const candidateFeatIds = [
    ...new Set([
      ...character.intent.featureAcquisitions.flatMap((acquisition) =>
        acquisition.source.kind === 'FEAT' ? [acquisition.source.featId] : []
      ),
      ...(character.intent.chosenGrantSelections ?? []).flatMap((selection) => selection.targetIds)
    ])
  ]
  const canonicalFeatIds =
    candidateFeatIds.length > 0
      ? new Set(
          [
            ...(await createAuthoredVersionRepository(db).findActiveByIds({
              subjectKind: 'FEAT',
              subjectIds: candidateFeatIds,
              systemId: character.systemId,
              userId: character.userId,
              includeMaster: true
            }))
          ].flatMap(([id, record]) =>
            record.authored.document.systemId === character.systemId ? [id] : []
          )
        )
      : new Set<string>()
  const campaignFeatIds = new Set(
    [...campaignSources.values()]
      .filter((snapshot) => snapshot.subjectKind === 'FEAT')
      .map((snapshot) => snapshot.subjectId)
  )
  const knownFeatIds = new Set([...canonicalFeatIds, ...campaignFeatIds])
  const emptyCatalog: CharacterBuilderCatalog = {
    races: [],
    classes: [],
    backgrounds: [],
    equipment: [],
    feats: [],
    spells: []
  }
  const { registry } = await loadCharacterAssemblyRegistry({
    db,
    character,
    catalog: emptyCatalog,
    campaignContent,
    includeEffects: options.includeEffects,
    knownFeatIds,
    system: vocabularySnapshot.document as SystemSeedRecord
  })
  const feats = registry.feats ?? []
  const equipment = registry.equipment
  const featsById = new Map(feats.map((feat) => [feat.id, feat]))
  const selectedFeaturesById = new Map(registry.features.map((feature) => [feature.id, feature]))
  const { classSelections, grantedFeatures } = collectGrantedFeaturesForCharacter(
    character,
    registry
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
      const feat = featsById.get(acquisition.source.featId)
      return Boolean(
        feat?.grants?.spells?.length ||
        feat?.features?.some((feature) => featureContributesSpellGrant(feature, character))
      )
    }) ||
    equipment.some((record) =>
      record.features?.some((feature) => featureContributesSpellGrant(feature, character))
    )
  )
  const baseClassIds = character.intent.classes.map((selection) => selection.classId)
  const campaignSubclasses = [...campaignSources.values()].flatMap((source) => {
    const document = source.subjectKind === 'CLASS' ? (source.authored as ClassAuthored) : null
    return document?.category === CLASS_CATEGORY.SUBCLASS ? [document] : []
  })
  const campaignSpells = [...campaignSources.values()].flatMap((source) =>
    source.subjectKind === 'SPELL' ? [source.authored as SpellAuthored] : []
  )
  const selectedSpellIds = [
    ...(character.intent.spellSelections ?? []).flatMap((selection) => selection.spells),
    ...(character.intent.chosenGrantSelections ?? []).flatMap((selection) => selection.targetIds)
  ]
  const [subclasses, baseSpellCatalog] = await Promise.all([
    loadCharacterStructuralSubclassCatalog({
      db,
      systemId: character.systemId,
      userId: character.userId,
      baseClassIds,
      campaignSubclasses
    }),
    needsSpells
      ? loadCharacterBuilderSpellCatalog(db, character.systemId, character.userId)
      : Promise.resolve([])
  ])

  const structuralClassIds = new Set([
    ...baseClassIds,
    ...character.intent.classes.flatMap((selection) =>
      selection.subclassId ? [selection.subclassId] : []
    )
  ])
  const selectedIds = new Set(selectedSpellIds)
  const campaignSpellIds = new Set(campaignSpells.map((spell) => spell.id))
  const spells = [
    ...baseSpellCatalog.filter((spell) => !campaignSpellIds.has(spell.id)),
    ...campaignSpells.map(toCharacterBuilderSpellCatalogRecord)
  ].filter(
    (spell) =>
      selectedIds.has(spell.id) || spell.classIds.some((classId) => structuralClassIds.has(classId))
  )
  if (new Set(spells.map((spell) => spell.id)).size > 500) {
    throw new Error('Character structural spell candidates exceed the bounded catalogue limit.')
  }

  const context: CharacterBuilderContext = {
    catalog: {
      ...emptyCatalog,
      classes: subclasses,
      equipment: registry.equipment.map((record) => ({
        id: record.id,
        label: record.label,
        category: record.category,
        isContainer: Boolean(record.capacity),
        maxStack: record.maxStack,
        properties: [...record.properties],
        requiresAttunement: record.requiresAttunement ?? false
      })),
      feats: (registry.feats ?? []).map((record) => ({ id: record.id, label: record.label })),
      spells
    },
    registry
  }
  const spellIds = collectContextSpellIds(character, context, options.referenceSpellIds)
  const spellDocuments = await loadCharacterStructuralSpellCatalog({
    db,
    systemId: character.systemId,
    userId: character.userId,
    campaignSpells: getRealCampaignSpellDocuments(campaignContent),
    spellIds
  })

  return {
    ...context,
    vocabularySnapshot,
    spellDocumentsById: new Map(spellDocuments.map((spell) => [spell.id, spell]))
  }
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

function getFeatureChoiceLevelForCharacter(
  character: CharacterAuthored,
  source: CharacterProvenance
): number {
  if (source.kind === 'CLASS') {
    return (
      character.intent.classes.find((record) => record.classId === source.classId)?.classLevel ?? 0
    )
  }
  if (source.kind === 'SUBCLASS') {
    return (
      character.intent.classes.find((record) => record.subclassId === source.subclassId)
        ?.classLevel ?? 0
    )
  }

  return character.intent.classes.reduce((sum, record) => sum + record.classLevel, 0)
}

function getRequiredFeatureOptionCount(feature: FeatureAuthored, level: number): number {
  return (feature.optionChoices ?? [])
    .filter((choice) => choice.level <= level)
    .reduce((sum, choice) => sum + choice.count, 0)
}

function getFeatureOptionReplacementCount(params: {
  feature: FeatureAuthored
  source: CharacterProvenance
  currentCharacter: CharacterAuthored
  previousCharacter: CharacterAuthored | null
  currentOptionIds: readonly string[]
  eligibleOptionIds: ReadonlySet<string>
}): number {
  if (!params.previousCharacter) return 0
  const previousAcquisition = params.previousCharacter.intent.featureAcquisitions.find(
    (record) =>
      record.featureId === params.feature.id &&
      isSameCharacterProvenanceIdentity(record.source, params.source)
  )
  if (!previousAcquisition) return 0

  const previousLevel = getFeatureChoiceLevelForCharacter(params.previousCharacter, params.source)
  const currentLevel = getFeatureChoiceLevelForCharacter(params.currentCharacter, params.source)
  const replacementAllowance = (params.feature.optionChoices ?? [])
    .filter((choice) => choice.level > previousLevel && choice.level <= currentLevel)
    .reduce((sum, choice) => sum + (choice.replaceCount ?? 0), 0)

  const previousOptionIds = getSelectedFeatureOptionIds(
    params.feature,
    params.previousCharacter,
    params.source
  )
  const previousOptionIdSet = new Set(previousOptionIds)
  const currentOptionIdSet = new Set(params.currentOptionIds)
  const removedEligibleCount = previousOptionIds.filter(
    (optionId) => params.eligibleOptionIds.has(optionId) && !currentOptionIdSet.has(optionId)
  ).length
  const forcedReplacementCount = previousOptionIds.filter(
    (optionId) => !params.eligibleOptionIds.has(optionId)
  ).length
  const addedOptionCount = params.currentOptionIds.filter(
    (optionId) => !previousOptionIdSet.has(optionId)
  ).length
  const addedRequiredCount = Math.max(
    0,
    getRequiredFeatureOptionCount(params.feature, currentLevel) -
      getRequiredFeatureOptionCount(params.feature, previousLevel)
  )
  const voluntaryReplacementCount = Math.min(
    removedEligibleCount,
    Math.max(0, addedOptionCount - addedRequiredCount - forcedReplacementCount)
  )

  return Math.max(0, voluntaryReplacementCount - replacementAllowance)
}

export async function resolveCharacterBuilder(
  db: DBLike,
  character: CharacterAuthored,
  mode: BuilderMode,
  providedContext?: CharacterBuilderContext,
  previousCharacter: CharacterAuthored | null = null,
  existingRevisionId: string | null = null
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
  const primaryClass = classSelections[0]?.baseClass
  const startingEquipmentEligibilityFacets = [
    ...compileStartingEquipmentEligibilityRuleFacts({
      source: 'CLASS',
      startingEquipment: primaryClass?.startingEquipment
    }),
    ...compileStartingEquipmentEligibilityRuleFacts({
      source: 'BACKGROUND',
      startingEquipment: selectedBackground?.startingEquipment
    })
  ]
  const featureOptionEligibility = await resolveFeatureOptionEligibility({
    db,
    character,
    context,
    grantedFeatures,
    existingRevisionId,
    additionalEligibilityFacets: startingEquipmentEligibilityFacets
  })
  const chosenGrantChoices = resolveCharacterChosenGrantChoices(
    character,
    getCharacterChosenGrantChoiceRegistry(context),
    getCharacterChosenGrantOwners(character, classSelections, selectedBackground, grantedFeatures)
  )
  const eligibleStartingEquipment = resolveEligibleStartingEquipment({
    primaryClass,
    selectedBackground,
    eligibilityById: featureOptionEligibility.eligibilityById
  })
  const classStartingEquipment = eligibleStartingEquipment.classStartingEquipment
  const backgroundStartingEquipment = eligibleStartingEquipment.backgroundStartingEquipment
  const resolvedRegistry = filterRegistryFeatureOptions(
    {
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
    },
    featureOptionEligibility.optionsByFeatureId
  )

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
            .map((detail) => ({
              id: detail.id,
              label: detail.label,
              description: detail.description
            })),
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
            .map((detail) => ({
              id: detail.id,
              label: detail.label,
              description: detail.description
            })),
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
    const requiredOptionCount = getRequiredFeatureOptionCount(granted.feature, granted.level)

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
    const allowedOptionIds = new Set(
      (featureOptionEligibility.optionsByFeatureId.get(granted.feature.id) ?? []).map(
        (option) => option.id
      )
    )
    const hasInvalidOption = selectedOptionIds.some((optionId) => !allowedOptionIds.has(optionId))
    const hasDuplicateOption = new Set(selectedOptionIds).size !== selectedOptionIds.length
    const replacementOverage = getFeatureOptionReplacementCount({
      feature: granted.feature,
      source: granted.source,
      currentCharacter: character,
      previousCharacter,
      currentOptionIds: selectedOptionIds,
      eligibleOptionIds: allowedOptionIds
    })

    if (
      hasInvalidOption ||
      hasDuplicateOption ||
      selectedOptionIds.length > requiredOptionCount ||
      replacementOverage > 0
    ) {
      validations.push({
        code: hasInvalidOption
          ? 'FEATURE_SELECTION_INVALID'
          : hasDuplicateOption
            ? 'FEATURE_SELECTION_DUPLICATE'
            : selectedOptionIds.length > requiredOptionCount
              ? 'FEATURE_SELECTION_OVER_LIMIT'
              : 'FEATURE_SELECTION_REPLACEMENT_OVER_LIMIT',
        severity: 'blocking',
        message: hasInvalidOption
          ? `${granted.feature.label} includes a selection that is no longer available.`
          : hasDuplicateOption
            ? `${granted.feature.label} requires different selections in each slot.`
            : selectedOptionIds.length > requiredOptionCount
              ? `${granted.feature.label} has too many selections.`
              : `${granted.feature.label} replaces more previously selected options than this level permits.`
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
    sourceRegistry: registry,
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
