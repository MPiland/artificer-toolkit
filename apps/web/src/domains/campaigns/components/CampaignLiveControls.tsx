import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import { CampaignActiveCharacterRequests } from './ActiveCharacterRequests/CampaignActiveCharacterRequests'
import { CampaignClockControl } from './CampaignClock/CampaignClockControl'

export function CampaignLiveControls({ campaign }: { campaign: CampaignDetailDto }) {
  return (
    <>
      {campaign.role === 'OWNER' ? (
        <CampaignActiveCharacterRequests campaignId={campaign.id} />
      ) : null}
      <CampaignClockControl campaign={campaign} />
    </>
  )
}
