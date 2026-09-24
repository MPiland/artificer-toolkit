import { ActionIcon, Alert, Button, Drawer, Loader, Tooltip } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { useQuery } from '@tanstack/react-query'
import { MessagesSquare } from 'lucide-react'
import { getCampaignDetail } from '#app/data/campaigns/queries'
import { CampaignChat } from './CampaignChat'
import * as chatStyles from './CampaignChat.css'

export function CampaignChatDrawer({
  campaignId,
  currentUserId,
  trigger = 'button'
}: {
  campaignId: string
  currentUserId: string
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
        onClose={close}
      >
        {campaign.isPending ? <Loader size='sm' /> : null}
        {campaign.isError ? <Alert color='red'>Campaign chat could not be loaded.</Alert> : null}
        {campaign.data ? (
          <CampaignChat campaign={campaign.data} currentUserId={currentUserId} />
        ) : null}
      </Drawer>
    </>
  )
}
