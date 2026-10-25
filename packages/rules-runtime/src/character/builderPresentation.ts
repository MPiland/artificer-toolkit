import { AUTHORED_RECORD_STATUS, type AuthoredRecordStatus } from '@artificer-toolkit/shared/core'
import {
  CharacterStartingEquipmentSource,
  type CharacterAncestryAcquisition,
  type CharacterAuthored,
  type CharacterFeatureAcquisitionRecord,
  type CharacterProvenance,
  type CharacterResourceGrantRecord,
  type CharacterSpellSelectionRecord
} from '@artificer-toolkit/shared/subjects/authored'

import type { CharacterBuilderCatalog } from './builderCatalog.js'
import { systemCoreCodeRegistry } from '../platformSystemCoreCodes.js'
import { isCharacterHitpointProgressionValid } from './builderHitPoints.js'
import type { CharacterStartingEquipmentDecision } from './builderStartingEquipment.js'
import type {
  CharacterBuilderChangePreview,
  CharacterBuilderContext,
  CharacterBuilderIssue,
  CharacterBuilderReadiness,
  CharacterBuilderRegistry,
  CharacterBuilderSectionId,
  CharacterBuilderSummary,
  CharacterBuilderValidation
} from './builderTypes.js'

type BuilderMode = 'create' | 'edit'

/** Whether the summary holds a score for every ability the Character's System lists. */
export const hasEveryAbilityScore = (
  character: CharacterAuthored,
  summary: CharacterBuilderSummary
) =>
  systemCoreCodeRegistry
    .abilityCodes(character.systemId)
    .every((code) => summary.abilities[code] !== undefined)

export function createReadiness(
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
  if (!hasEveryAbilityScore(character, summary)) {
    blockingIssues.push('Every ability score must be assigned.')
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

/**
 * The Builder section that owns a choice from this source. Feats, features, options and manual
 * entries have no step of their own, so the Review section lists them.
 */
export function characterBuilderSectionOfSource(
  source: CharacterProvenance | undefined
): CharacterBuilderSectionId {
  switch (source?.kind) {
    case 'RACE':
    case 'SUBRACE':
    case 'ANCESTRY':
      return 'RACE'
    case 'CLASS':
    case 'SUBCLASS':
      return 'CLASSES'
    case 'BACKGROUND':
      return 'BACKGROUND'
    case 'FEAT':
    case 'FEATURE':
    case 'OPTION':
    case 'MANUAL':
    case undefined:
      return 'REVIEW'
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
    !hasEveryAbilityScore(character, summary) ||
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

  const featureChoice = outstandingChoices.find(
    (choice) =>
      choice.code === 'FEATURE_SELECTION_REQUIRED' || choice.code === 'FEATURE_SELECTION_INCOMPLETE'
  )
  if (featureChoice) return featureChoice.sectionId

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
