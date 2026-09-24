import type { CampaignContentMaturityDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { CampaignEventDto } from '@artificer-toolkit/schema/api/campaignLiveState'
import { presentCampaignPlainText } from '@artificer-toolkit/shared/campaign/textPolicy'

export function presentInventoryAuditPayload(
  payload: CampaignEventDto['payload'],
  maturity: CampaignContentMaturityDto
): CampaignEventDto['payload'] {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return payload
  return {
    ...payload,
    ...(typeof payload.itemLabel === 'string'
      ? { itemLabel: presentCampaignPlainText(payload.itemLabel, maturity) }
      : {}),
    ...(typeof payload.denominationLabel === 'string'
      ? { denominationLabel: presentCampaignPlainText(payload.denominationLabel, maturity) }
      : {})
  }
}
