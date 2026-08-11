import type {
  CharacterHistoryResponseDto,
  CharacterRestPreviewResponseDto,
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characters'
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

const plainTextKeys = new Set([
  'activationLabel',
  'alignment',
  'authoredName',
  'backgroundLabel',
  'carryingCapacityLabel',
  'cargoCapacityLabel',
  'category',
  'categoryLabel',
  'classSummary',
  'concept',
  'costLabel',
  'crewLabel',
  'customName',
  'damageTypeLabel',
  'displayName',
  'faith',
  'gender',
  'hitOrDcLabel',
  'kindLabel',
  'label',
  'lifestyle',
  'materialDescription',
  'originLabel',
  'primaryEffect',
  'raceLabel',
  'rangeLabel',
  'relationshipLabel',
  'school',
  'sourceLabel',
  'sourceNote',
  'sourceQualifier',
  'speedLabel',
  'title',
  'unitLabel',
  'unavailableReason'
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
  'defenses',
  'effects',
  'facts',
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
  parentKey?: string
): unknown {
  if (Array.isArray(value)) {
    if (parentKey === 'classLabels') {
      return value.map((entry) =>
        typeof entry === 'string' ? presentCampaignPlainText(entry, maturity) : entry
      )
    }
    return value.map((entry) => presentKnownCharacterText(entry, maturity, parentKey))
  }
  if (!isRecord(value)) return value

  const presented: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' && plainTextKeys.has(key)) {
      presented[key] = presentCampaignPlainText(entry, maturity)
    } else if (typeof entry === 'string' && richTextKeys.has(key)) {
      presented[key] = presentCampaignRichText(entry, maturity)
    } else if (
      key === 'value' &&
      typeof entry === 'string' &&
      (displayValueContainers.has(parentKey ?? '') ||
        (value.kind === 'TEXT' && (value.field === 'CUSTOM_NAME' || value.field === 'NOTES')))
    ) {
      presented[key] = presentCampaignRichText(entry, maturity)
    } else {
      presented[key] = presentKnownCharacterText(entry, maturity, key)
    }
  }
  return presented
}

export function presentCampaignCharacterText<T extends CampaignCharacterPresentation>(
  value: T,
  maturity: CampaignContentMaturity | null
): T {
  if (maturity !== 'STANDARD') return value
  return presentKnownCharacterText(value, maturity) as T
}

export function presentCampaignCharacterHistory(
  history: CharacterHistoryResponseDto,
  maturity: CampaignContentMaturity | null
): CharacterHistoryResponseDto {
  if (maturity !== 'STANDARD') return history
  return {
    ...history,
    entries: history.entries.map((entry) => ({
      ...entry,
      summary: presentCampaignPlainText(entry.summary, maturity)
    }))
  }
}
