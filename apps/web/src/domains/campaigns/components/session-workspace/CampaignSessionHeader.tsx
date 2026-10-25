import { Alert, Badge, Button, Group, Text, TextInput } from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useNavigate } from '@tanstack/react-router'
import { IconChevronLeft } from '@tabler/icons-react'
import { useState } from 'react'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { CampaignSessionDto } from '@artificer-toolkit/schema/api/campaignSessions'
import { useConvex } from 'convex/react'
import { buildCampaignRouteParams } from '#app/routing/authoredRouteParams'
import { CampaignChatDrawer } from '../CampaignChatDrawer'
import { CampaignLiveControls } from '../CampaignLiveControls'
import * as styles from './CampaignSessionHeader.css'

export function CampaignSessionHeader({
  campaign,
  currentUserId,
  session,
  onUpdated
}: {
  campaign: CampaignDetailDto
  currentUserId: string
  session: CampaignSessionDto
  onUpdated: (session: CampaignSessionDto) => void
}) {
  const navigate = useNavigate()
  const convex = useConvex()
  const [title, setTitle] = useState(session.title ?? '')
  const editable = campaign.capabilities.manageActiveCampaign
  const [syncedTitle, setSyncedTitle] = useState(session.title)
  if (syncedTitle !== session.title) {
    setSyncedTitle(session.title)
    setTitle(session.title ?? '')
  }

  const update = useMutation({
    mutationFn: () =>
      convex.mutation(convexApi.campaigns.sessions.update, {
        campaignId: campaign.id,
        sessionId: session.id,
        expectedVersion: session.version,
        title: title.trim() || null
      }),
    onSuccess: (updated) => {
      onUpdated(updated)
    }
  })

  function commitTitle() {
    if (!editable || update.isPending || (title.trim() || null) === session.title) return
    update.mutate()
  }

  return (
    <>
      <header className={styles.header}>
        <div className={styles.identity}>
          <Button
            className={styles.back}
            leftSection={<IconChevronLeft aria-hidden size={15} />}
            size='compact-sm'
            variant='subtle'
            onClick={() =>
              navigate({
                to: '/campaigns/$campaignPublicId/$campaignSlug',
                params: buildCampaignRouteParams(campaign.publicId, campaign.name)
              })
            }
          >
            {campaign.name}
          </Button>
          <TextInput
            aria-label='Session name'
            className={styles.titleField}
            classNames={{ input: styles.titleInput }}
            disabled={!editable || update.isPending}
            placeholder={session.title ?? `Session ${session.sessionNumber}`}
            value={title}
            onBlur={commitTitle}
            onChange={(event) => setTitle(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
          />
          <Group gap='xs' wrap='wrap'>
            <Badge color={session.status === 'OPEN' ? 'green' : 'gray'}>
              {session.status === 'OPEN' ? 'Open' : 'Finished'}
            </Badge>
            <Text c='dimmed' size='sm'>
              {formatSchedule(session)}
            </Text>
          </Group>
        </div>
        <div className={styles.utilities}>
          <CampaignLiveControls campaign={campaign} />
          {campaign.capabilities.readTableChat ? (
            <CampaignChatDrawer
              campaignId={campaign.id}
              currentUserId={currentUserId}
              trigger='icon'
            />
          ) : null}
        </div>
      </header>
      {update.error ? (
        <Alert color='red'>Session name couldn’t be saved. Your edit is still here.</Alert>
      ) : null}
    </>
  )
}

function formatSchedule(session: CampaignSessionDto) {
  if (!session.scheduledStartAt || !session.scheduledEndAt || !session.timeZone)
    return 'Not scheduled'
  const date = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: session.timeZone
  }).format(new Date(session.scheduledStartAt))
  const formatter = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: session.timeZone
  })
  return `${date} · ${formatter.format(new Date(session.scheduledStartAt))}–${formatter.format(new Date(session.scheduledEndAt))} · ${session.timeZone}`
}
