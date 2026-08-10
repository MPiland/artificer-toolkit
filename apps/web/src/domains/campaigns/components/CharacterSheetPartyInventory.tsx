import { Alert, Loader } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { getCampaignDetail } from '#app/data/campaigns/queries'
import { CampaignInventory } from './CampaignInventory'

export function CharacterSheetPartyInventory({
  campaignId,
  currentUserId
}: {
  campaignId: string
  currentUserId: string
}) {
  const campaign = useQuery(getCampaignDetail(campaignId))

  if (campaign.isPending) return <Loader size='sm' />
  if (campaign.error) return <Alert color='red'>{campaign.error.message}</Alert>
  return campaign.data ? (
    <CampaignInventory campaign={campaign.data} currentUserId={currentUserId} partyOnly />
  ) : null
}
