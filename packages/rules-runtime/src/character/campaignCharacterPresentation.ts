import type {
  CharacterHistoryResponseDto,
  CharacterRestPreviewResponseDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import type { CharacterBuilderPayloadDto } from '@artificer-toolkit/schema/api/characterBuilder'
import type { CharacterBuilderPreviewOutput } from '@artificer-toolkit/schema/api/characterBuilderQueries'
import type { CharacterPreparationOptionsResponseDto } from '@artificer-toolkit/schema/api/characterPreparationOptions'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import type { CharacterSheetPanelDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import {
  presentCampaignPlainText,
  presentCampaignRichText,
  type CampaignContentMaturity
} from '@artificer-toolkit/shared/campaign/textPolicy'

type CampaignCharacterPresentation =
  | CharacterSheetResponseDto
  | CharacterSheetPanelDto
  | CharacterRestPreviewResponseDto
  | Pick<CharacterBuilderPayloadDto, 'resolution' | 'references' | 'view'>
  | Pick<CharacterBuilderPreviewOutput, 'resolution' | 'preview'>
  | CharacterPreparationOptionsResponseDto

type CampaignCharacterViewer = 'CHARACTER_OWNER' | 'CAMPAIGN_OWNER'

const plainTextKeys = new Set([
  'activationLabel',
  'alignment',
  'ancestryLabel',
  'ancestryOptionLabel',
  'authoredName',
  'backgroundLabel',
  'carryingCapacityLabel',
  'cargoCapacityLabel',
  'category',
  'categoryLabel',
  'classLabel',
  'classSummary',
  'concept',
  'costLabel',
  'crewLabel',
  'customName',
  'damageTypeLabel',
  'displayCategory',
  'displayName',
  'disabledReason',
  'equipmentLabel',
  'faith',
  'featureLabel',
  'gender',
  'hitOrDcLabel',
  'kindLabel',
  'label',
  'lifestyle',
  'materialDescription',
  'message',
  'originLabel',
  'primaryEffect',
  'raceLabel',
  'rangeLabel',
  'relationshipLabel',
  'school',
  'schoolLabel',
  'sizeLabel',
  'sourceLabel',
  'sourceNote',
  'sourceQualifier',
  'spellCollectionLabel',
  'speedLabel',
  'specializationLabel',
  'subclassLabel',
  'subraceLabel',
  'summary',
  'title',
  'unitLabel',
  'unavailableReason'
])

const plainTextArrayKeys = new Set([
  'blockers',
  'blockingIssues',
  'classLabels',
  'featureLabels',
  'grantedEntries',
  'outstandingRequiredChoices',
  'resourceLabels',
  'savingThrowLabels',
  'speedLabels',
  'spellcastingLabels',
  'summaryLines',
  'entries',
  'warnings'
])

const privateNoteHistoryEventTypes = new Set([
  'CREATE_NOTE',
  'UPDATE_NOTE',
  'DELETE_NOTE',
  'CREATE_NOTE_GROUP',
  'UPDATE_NOTE_GROUP',
  'DELETE_NOTE_GROUP'
])

const richTextKeys = new Set([
  'allies',
  'appearance',
  'backstory',
  'body',
  'bonds',
  'description',
  'enemies',
  'flaws',
  'ideals',
  'notes',
  'organizations',
  'personalityTraits'
])

const displayValueContainers = new Set([
  'abilityScoreIncreaseFacts',
  'defenses',
  'effects',
  'facts',
  'grantFacts',
  'proficiencies',
  'references',
  'senses'
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function presentKnownCharacterText(
  value: unknown,
  maturity: CampaignContentMaturity,
  parentKey?: string,
  viewer?: CampaignCharacterViewer
): unknown {
  if (Array.isArray(value)) {
    if (plainTextArrayKeys.has(parentKey ?? '')) {
      return value.map((entry) =>
        typeof entry === 'string'
          ? presentCampaignPlainText(entry, maturity)
          : presentKnownCharacterText(entry, maturity, parentKey, viewer)
      )
    }
    return value.map((entry) => presentKnownCharacterText(entry, maturity, parentKey, viewer))
  }
  if (!isRecord(value)) return value

  const presented: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (viewer === 'CHARACTER_OWNER' && parentKey === undefined && key === 'notes') {
      presented[key] = entry
    } else if (viewer !== undefined && key === 'customName') {
      presented[key] = entry
    } else if (
      viewer !== undefined &&
      key === 'sourceNote' &&
      (value.commitIntent === 'ON_BLUR_OR_ENTER' || value.commitIntent === 'IMMEDIATE')
    ) {
      presented[key] = entry
    } else if (
      typeof entry === 'string' &&
      (plainTextKeys.has(key) || parentKey === 'choiceLabels')
    ) {
      presented[key] = presentCampaignPlainText(entry, maturity)
    } else if (typeof entry === 'string' && richTextKeys.has(key)) {
      presented[key] = presentCampaignRichText(entry, maturity)
    } else if (
      key === 'value' &&
      typeof entry === 'string' &&
      (displayValueContainers.has(parentKey ?? '') ||
        (value.kind === 'TEXT' &&
          ((viewer === undefined && value.field === 'CUSTOM_NAME') ||
            (viewer !== 'CHARACTER_OWNER' && value.field === 'NOTES'))))
    ) {
      presented[key] = presentCampaignRichText(entry, maturity)
    } else {
      presented[key] = presentKnownCharacterText(entry, maturity, key, viewer)
    }
  }
  return presented
}

export function presentCampaignCharacterText<T extends CampaignCharacterPresentation>(
  value: T,
  maturity: CampaignContentMaturity | null,
  viewer?: CampaignCharacterViewer
): T {
  if (maturity !== 'STANDARD') return value
  return presentKnownCharacterText(value, maturity, undefined, viewer) as T
}

export function presentCampaignCharacterHistory(
  history: CharacterHistoryResponseDto,
  maturity: CampaignContentMaturity | null,
  viewer?: CampaignCharacterViewer
): CharacterHistoryResponseDto {
  if (maturity !== 'STANDARD') return history
  return {
    ...history,
    entries: history.entries.map((entry) => ({
      ...entry,
      summary:
        viewer === 'CHARACTER_OWNER' && privateNoteHistoryEventTypes.has(entry.eventType)
          ? entry.summary
          : presentCampaignPlainText(entry.summary, maturity)
    }))
  }
}
