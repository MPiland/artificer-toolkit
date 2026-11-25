import { Button, Modal, Stack } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useQuery } from '@tanstack/react-query'
import { getCampaignActiveCharacterRequests } from '#app/data/campaigns/queries'
import { ActiveCharacterRequestCard } from './ActiveCharacterRequestCard'

/** GM-only header prompt, so the GM can settle a swap from the session workspace mid-fight. */
export function CampaignActiveCharacterRequests({ campaignId }: { campaignId: string }) {
  const { data: requests = [] } = useQuery(getCampaignActiveCharacterRequests(campaignId))
  const [opened, { close, open }] = useDisclosure(false)
  if (requests.length === 0) return null

  return (
    <>
      <Button color='yellow' size='compact-xs' variant='light' onClick={open}>
        {requests.length === 1
          ? '1 Character swap request'
          : `${requests.length} Character swap requests`}
      </Button>
      <Modal centered opened={opened} title='Character swap requests' onClose={close}>
        <Stack gap='sm'>
          {requests.map((request) => (
            <ActiveCharacterRequestCard key={request.id} request={request} />
          ))}
        </Stack>
      </Modal>
    </>
  )
}
