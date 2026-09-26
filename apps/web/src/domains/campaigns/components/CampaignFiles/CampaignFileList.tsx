import { Alert, Badge, Button, Group, Loader, Stack, Text, Title } from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useAction, useMutation as useConvexMutation, usePaginatedQuery } from 'convex/react'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import * as styles from './CampaignFiles.css'

export function CampaignFileList({
  campaign,
  currentUserId,
  sessionId
}: {
  campaign: CampaignDetailDto
  currentUserId: string
  sessionId?: string
}) {
  const attachments = usePaginatedQuery(
    convexApi.campaigns.attachments.list,
    { campaignId: campaign.id },
    { initialNumItems: 48 }
  )
  const removeAttachment = useConvexMutation(convexApi.campaigns.attachments.remove)
  const getDelivery = useAction(convexApi.media.fileActions.getDelivery)
  const visible = attachments.results.filter(
    (attachment) => !sessionId || attachment.sessionId === sessionId
  )
  const remove = useMutation({
    mutationFn: (attachmentId: string) =>
      removeAttachment({ campaignId: campaign.id, attachmentId })
  })
  const download = useMutation({
    mutationFn: (attachmentId: string) => getDelivery({ campaignId: campaign.id, attachmentId }),
    onSuccess: (delivery) => {
      const link = document.createElement('a')
      link.href = delivery.url
      link.download = delivery.fileName
      link.rel = 'noopener'
      link.click()
    }
  })

  return (
    <section
      className={styles.panel}
      aria-labelledby={sessionId ? 'session-files-title' : 'campaign-files-title'}
    >
      <Title id={sessionId ? 'session-files-title' : 'campaign-files-title'} order={2}>
        {sessionId ? 'Handouts and files' : 'Campaign files'}
      </Title>
      {attachments.status === 'LoadingFirstPage' ? (
        <Loader aria-label='Loading Campaign files' size='sm' />
      ) : null}
      <Stack gap={0}>
        {visible.map((attachment) => (
          <div className={styles.row} key={attachment.id}>
            <div>
              <Group gap='xs'>
                <Text fw={700}>{attachment.displayName}</Text>
                {attachment.profile === 'CAMPAIGN_HANDOUT_MAP' ? (
                  <Badge size='xs'>Map</Badge>
                ) : null}
              </Group>
              {attachment.description ? (
                <Text c='dimmed' size='sm'>
                  {attachment.description}
                </Text>
              ) : null}
              <Text c='dimmed' size='xs'>
                Uploaded by {attachment.uploaderLabel}
              </Text>
            </div>
            <Group gap='xs'>
              <Button
                loading={download.isPending}
                size='compact-sm'
                variant='default'
                onClick={() => download.mutate(attachment.id)}
              >
                Download
              </Button>
              {(campaign.role === 'OWNER' || attachment.uploaderUserId === currentUserId) &&
              campaign.status === 'ACTIVE' ? (
                <Button
                  color='red'
                  disabled={remove.isPending}
                  size='compact-sm'
                  variant='subtle'
                  onClick={() => remove.mutate(attachment.id)}
                >
                  Remove
                </Button>
              ) : null}
            </Group>
          </div>
        ))}
      </Stack>
      {attachments.status === 'CanLoadMore' ? (
        <Button variant='subtle' onClick={() => attachments.loadMore(48)}>
          Load more files
        </Button>
      ) : null}
      {attachments.status === 'LoadingMore' ? (
        <Loader aria-label='Loading more Campaign files' size='sm' />
      ) : null}
      {attachments.status === 'Exhausted' && visible.length === 0 ? (
        <Text c='dimmed'>No files attached.</Text>
      ) : null}
      {download.error ? <Alert color='red'>That file couldn’t be downloaded.</Alert> : null}
      {remove.error ? <Alert color='red'>That file couldn’t be removed.</Alert> : null}
    </section>
  )
}
