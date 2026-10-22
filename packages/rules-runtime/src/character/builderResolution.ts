import { CLASS_CATEGORY, RACE_CATEGORY_CODE } from '@artificer-toolkit/shared/core'
import {
  getCharacterChosenGrantSelectionIdentityKey,
  isSameCharacterProvenanceIdentity,
  type CharacterAuthored,
  type CharacterProvenance
} from '@artificer-toolkit/shared/subjects/authored'
import type { CompiledFeature } from '@artificer-toolkit/shared/compilers'
import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import {
  getSelectedFeatureOptionIds,
  resolveCharacterChosenGrantChoices,
  type CharacterBuilderChosenGrantChoice,
  type CharacterChosenGrantChoiceRegistry
} from './chosenGrantChoiceResolver.js'
import {
  appendAbilityIntentValidationIssues,
  filterRegistryFeatureOptions,
  getAvailableSubclassesForClass,
  getCharacterChosenGrantOwners,
  isProvenanceStillValid,
  validateMulticlass,
  type FeatureOptionEligibility
} from './builderEligibility.js'
import {
  collectGrantedFeaturesForCharacter,
  collectCharacterBuilderFeatures,
  deriveAbilityScores,
  findCurrentCharacterFeatureAcquisition,
  isCharacterFeatAcquisitionValid,
  isValidAncestrySource,
  type GrantedFeatureRecord
} from './characterBuilderSelections.js'
import {
  appendDuplicateSpellSelectionIssues,
  getClassSpellChoiceRequirements,
  getInvalidSpellSelectionIds,
  getSpellSelectionCounts
} from './builderSpellSelection.js'
import {
  collectSpellClassListAdditions,
  withClassListAdditions
} from './spellClassListAdditions.js'
import {
  compileStartingEquipmentEligibilityRuleFacts,
  hasStartingEquipmentGroupWithoutEligibleOptions,
  isStartingEquipmentDecisionComplete,
  resolveEligibleStartingEquipment
} from './builderStartingEquipment.js'
import {
  characterBuilderSectionOfSource,
  createReadiness,
  resolveRecommendedCharacterBuilderSection
} from './builderPresentation.js'
import {
  appendManualHitpointValidationIssues,
  isCharacterHitpointProgressionValid
} from './builderHitPoints.js'
import type {
  CharacterBuilderContext,
  CharacterBuilderGrantSummaryItem,
  CharacterBuilderGrantedContent,
  CharacterBuilderIssue,
  CharacterBuilderResolution,
  CharacterBuilderSummary,
  CharacterBuilderValidation
} from './builderTypes.js'

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
        sectionId: 'REVIEW',
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
        sectionId: 'CLASSES',
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
        sectionId: characterBuilderSectionOfSource(choice.source),
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
        sectionId: characterBuilderSectionOfSource(choice.source),
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
        sectionId: characterBuilderSectionOfSource(choice.source),
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
      sectionId: characterBuilderSectionOfSource(selection.source),
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

function getRequiredFeatureOptionCount(feature: CompiledFeature, level: number): number {
  return (feature.optionChoices ?? [])
    .filter((choice) => choice.level <= level)
    .reduce((sum, choice) => sum + choice.count, 0)
}

function getFeatureOptionReplacementCount(params: {
  feature: CompiledFeature
  source: CharacterProvenance
  currentCharacter: CharacterAuthored
  previousCharacter: CharacterAuthored | null
  currentOptionIds: readonly string[]
  eligibleOptionIds: ReadonlySet<string>
}): number {
  if (!params.previousCharacter) return 0
  const previousAcquisition = findCurrentCharacterFeatureAcquisition(
    params.previousCharacter,
    params.feature.id,
    params.source
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

export async function resolveCharacterBuilder({
  character,
  mode,
  context,
  previousCharacter = null,
  resolveFeatureOptions
}: {
  character: CharacterAuthored
  mode: 'create' | 'edit'
  context: CharacterBuilderContext
  previousCharacter?: CharacterAuthored | null
  resolveFeatureOptions: (input: {
    character: CharacterAuthored
    grantedFeatures: readonly GrantedFeatureRecord[]
    additionalEligibilityFacets: CharacterRulePolicyInput['eligibilityFacets']
  }) => Promise<Pick<FeatureOptionEligibility, 'optionsByFeatureId' | 'eligibilityById'>>
}): Promise<CharacterBuilderResolution> {
  const { registry } = context
  const abilityScores = deriveAbilityScores(character.intent.abilities)
  const {
    classSelections,
    totalLevel,
    baseRace,
    selectedRace,
    selectedBackground,
    selectedAncestry,
    selectedAncestryOption,
    grantedFeatures: structuralFeatures
  } = collectGrantedFeaturesForCharacter(character, registry)
  const catalog = {
    ...context.catalog,
    spells: withClassListAdditions(
      context.catalog.spells,
      classSelections.flatMap((selection) =>
        collectSpellClassListAdditions(selection.features, selection.row.classLevel)
      )
    )
  }
  const grantedFeatures = collectCharacterBuilderFeatures(character, registry, structuralFeatures)
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
  const featureOptionEligibility = await resolveFeatureOptions({
    character,
    grantedFeatures,
    additionalEligibilityFacets: startingEquipmentEligibilityFacets
  })
  const chosenGrantChoices = resolveCharacterChosenGrantChoices(
    character,
    getCharacterChosenGrantChoiceRegistry(context),
    getCharacterChosenGrantOwners(
      character,
      classSelections,
      selectedBackground,
      grantedFeatures,
      registry.feats ?? []
    )
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
      sectionId: 'ABILITIES',
      message: 'Hit point entries no longer match the selected class progression.'
    })
  }

  if (character.intent.race.raceId && !baseRace) {
    validations.push({
      code: 'RACE_NOT_FOUND',
      severity: 'blocking',
      sectionId: 'RACE',
      message: 'The selected race no longer exists.'
    })
  }

  if (character.intent.race.subraceId && !selectedRace) {
    validations.push({
      code: 'SUBRACE_NOT_FOUND',
      severity: 'blocking',
      sectionId: 'RACE',
      message: 'The selected subrace no longer exists.'
    })
  }

  if (character.intent.background.backgroundId && !selectedBackground) {
    validations.push({
      code: 'BACKGROUND_NOT_FOUND',
      severity: 'blocking',
      sectionId: 'BACKGROUND',
      message: 'The selected background no longer exists.'
    })
  }

  for (const selection of classSelections) {
    if (!selection.baseClass) {
      validations.push({
        code: 'CLASS_NOT_FOUND',
        severity: 'blocking',
        sectionId: 'CLASSES',
        message: `The selected class "${selection.row.classId}" no longer exists.`
      })
    }

    if (selection.row.subclassId && !selection.subclass) {
      validations.push({
        code: 'SUBCLASS_NOT_FOUND',
        severity: 'blocking',
        sectionId: 'CLASSES',
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
        sectionId: 'CLASSES',
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
        sectionId: 'CLASSES',
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
      sectionId: 'RACE',
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
        sectionId: 'CLASSES',
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
        sectionId: 'CLASSES',
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
      sectionId: 'CLASSES',
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
      sectionId: 'EQUIPMENT',
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
      sectionId: 'EQUIPMENT',
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
      sectionId: 'EQUIPMENT',
      message: `${selectedBackground?.label ?? 'The selected background'} has no eligible option for a required starting equipment group.`
    })
  }

  for (const granted of grantedFeatures) {
    const requiredOptionCount = getRequiredFeatureOptionCount(granted.feature, granted.level)

    if (requiredOptionCount <= 0) continue

    const acquisition = findCurrentCharacterFeatureAcquisition(
      character,
      granted.feature.id,
      granted.source
    )

    if (!acquisition) {
      outstandingChoices.push({
        code: 'FEATURE_SELECTION_REQUIRED',
        sectionId: characterBuilderSectionOfSource(granted.source),
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
        sectionId: characterBuilderSectionOfSource(granted.source),
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
        sectionId: characterBuilderSectionOfSource(granted.source),
        message: `${granted.feature.label} has incomplete selections.`,
        sourceLabel: granted.sourceLabel,
        source: granted.source,
        required: true
      })
    }
  }

  const featRootIds = new Set<string>()
  for (const acquisition of character.intent.featureAcquisitions) {
    if (acquisition.source.kind === 'FEAT' && acquisition.featureId === acquisition.source.featId) {
      if (featRootIds.has(acquisition.featureId)) {
        validations.push({
          code: 'DUPLICATE_FEAT_ACQUISITION',
          severity: 'blocking',
          sectionId: 'REVIEW',
          message: 'A Feat can have only one root acquisition.'
        })
      }
      featRootIds.add(acquisition.featureId)
    }
    const featureExists =
      registry.features.some((feature) => feature.id === acquisition.featureId) ||
      grantedFeatures.some(({ feature }) => feature.id === acquisition.featureId) ||
      (acquisition.source.kind === 'FEAT' &&
        acquisition.featureId === acquisition.source.featId &&
        registry.feats?.some((feat) => feat.id === acquisition.featureId))
    if (
      !featureExists ||
      !isCharacterFeatAcquisitionValid(acquisition, registry) ||
      !isProvenanceStillValid(acquisition.source, character, registry, grantedFeatures)
    ) {
      validations.push({
        code: 'STALE_FEATURE_ACQUISITION',
        severity: 'blocking',
        sectionId: 'REVIEW',
        message: `Feature acquisition "${acquisition.featureId}" no longer matches the current build.`
      })
    }
  }

  for (const selection of character.intent.spellSelections ?? []) {
    if (!isProvenanceStillValid(selection.source, character, registry, grantedFeatures)) {
      validations.push({
        code: 'STALE_SPELL_SELECTION',
        severity: 'blocking',
        sectionId: 'CLASSES',
        message: `Spell selection "${selection.id}" no longer matches the current build.`
      })
    }
  }

  for (const item of character.state.equipment.inventory) {
    if (!registry.equipment.some((equipment) => equipment.id === item.equipmentId)) {
      validations.push({
        code: 'EQUIPMENT_SOURCE_UNAVAILABLE',
        severity: 'blocking',
        sectionId: 'EQUIPMENT',
        message: `Inventory equipment "${item.equipmentId}" is no longer available.`
      })
    }
  }

  for (const grant of character.intent.resourceGrants ?? []) {
    if (!isProvenanceStillValid(grant.source, character, registry, grantedFeatures)) {
      validations.push({
        code: 'STALE_RESOURCE_GRANT',
        severity: 'blocking',
        sectionId: 'CLASSES',
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
      sectionId: 'RACE',
      message: 'The selected ancestry option no longer belongs to the current race choice.'
    })
  }

  if (selectedAncestry && !isValidAncestrySource(character, selectedAncestry.source)) {
    validations.push({
      code: 'ANCESTRY_SOURCE_MISMATCH',
      severity: 'blocking',
      sectionId: 'RACE',
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
