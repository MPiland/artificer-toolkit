import { Alert } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { getCampaignLiveAuthority } from '#app/data/campaigns/queries'

const checkpointTime = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' })

/** Outside the live room, Encounter details are the room's last checkpoint (ADR 0035). */
export function CampaignLiveCheckpointNotice({ campaignId }: { campaignId: string }) {
  const { data: authority } = useQuery(getCampaignLiveAuthority(campaignId))
  if (!authority) return null
  return (
    <Alert color='blue' title='Live play in progress'>
      {authority.checkpointedAt
        ? `Encounter details here were saved from the table at ${checkpointTime.format(new Date(authority.checkpointedAt))}.`
        : 'Encounter details here update once the table first saves.'}{' '}
      The live table shows the current state.
    </Alert>
  )
}
