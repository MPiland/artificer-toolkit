import { ActionIcon, Alert, Button, Drawer, Loader, Tooltip } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useQuery } from '@tanstack/react-query'
import { MessagesSquare } from 'lucide-react'
import type { CampaignDetailDto } from '#app/lib/api'
import { getCampaignDetail } from '#app/data/campaigns/queries'
import { useCampaignRealtime } from '#app/data/campaigns/useCampaignRealtime'
import { CampaignChat } from './CampaignChat'
import * as chatStyles from './CampaignChat.css'

export function CampaignChatDrawer({
  campaignId,
  currentUserId,
  realtime = true,
  trigger = 'button'
}: {
  campaignId: string
  currentUserId: string
  realtime?: boolean
  trigger?: 'button' | 'icon'
}) {
  const [opened, { close, open }] = useDisclosure(false)
  const campaign = useQuery({ ...getCampaignDetail(campaignId), enabled: opened })

  return (
    <>
      {trigger === 'icon' ? (
        <Tooltip label='Campaign chat'>
          <ActionIcon aria-label='Open Campaign chat' size='lg' variant='default' onClick={open}>
            <MessagesSquare aria-hidden='true' size={18} />
          </ActionIcon>
        </Tooltip>
      ) : (
        <Button
          leftSection={<MessagesSquare aria-hidden='true' size={18} />}
          variant='default'
          onClick={open}
        >
          Chat
        </Button>
      )}
      <Drawer
        classNames={{ body: chatStyles.drawerBody, content: chatStyles.drawerShell }}
        closeButtonProps={{ 'aria-label': 'Close Campaign chat' }}
        opened={opened}
        position='right'
        size='min(32rem, 100vw)'
        title='Chat'
        zIndex={400}
        onClose={close}
      >
        {campaign.isPending ? <Loader size='sm' /> : null}
        {campaign.isError ? <Alert color='red'>Campaign chat could not be loaded.</Alert> : null}
        {campaign.data ? (
          realtime ? (
            <LiveCampaignChat campaign={campaign.data} currentUserId={currentUserId} />
          ) : (
            <CampaignChat campaign={campaign.data} currentUserId={currentUserId} />
          )
        ) : null}
      </Drawer>
    </>
  )
}

function LiveCampaignChat({
  campaign,
  currentUserId
}: {
  campaign: CampaignDetailDto
  currentUserId: string
}) {
  useCampaignRealtime(campaign, currentUserId)
  return <CampaignChat campaign={campaign} currentUserId={currentUserId} />
}
