import type { CampaignDetailDto } from '#app/lib/api'
import { CampaignClockControl } from './CampaignClock/CampaignClockControl'

export function CampaignLiveControls({ campaign }: { campaign: CampaignDetailDto }) {
  return <CampaignClockControl campaign={campaign} />
}
