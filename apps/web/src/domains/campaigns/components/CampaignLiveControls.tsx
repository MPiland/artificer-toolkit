import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { CampaignClockControl } from './CampaignClock/CampaignClockControl'

export function CampaignLiveControls({ campaign }: { campaign: CampaignDetailDto }) {
  return <CampaignClockControl campaign={campaign} />
}
