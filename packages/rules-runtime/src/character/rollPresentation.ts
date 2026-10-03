import type {
  GmCampaignRollDto,
  RollHistoryEntryDto,
  RollRecordDto
} from '@artificer-toolkit/schema/api/rolls'
import {
  presentCampaignPlainText,
  type CampaignContentMaturity
} from '@artificer-toolkit/shared/campaign/textPolicy'

/**
 * A stored roll as a reader sees it: at STANDARD maturity its free-text labels are masked. Shared by
 * Convex and the live room so a roll reads the same wherever it is presented.
 */
export function presentRoll(
  record: RollRecordDto,
  maturity: CampaignContentMaturity | null
): RollRecordDto {
  if (maturity !== 'STANDARD') return record
  return {
    ...record,
    characterLabel: presentCampaignPlainText(record.characterLabel, maturity),
    source: {
      ...record.source,
      label: presentCampaignPlainText(record.source.label, maturity).slice(0, 80)
    }
  }
}

export function presentRetainedRoll(
  { gmCampaignRoll, ...record }: RollRecordDto & { gmCampaignRoll: GmCampaignRollDto | null },
  maturity: CampaignContentMaturity | null
): RollHistoryEntryDto {
  return { ...presentRoll(record, maturity), gmCampaignRoll }
}
