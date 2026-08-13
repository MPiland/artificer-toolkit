import { Alert, Badge, Button, Group, Loader, Stack, Text, Title } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CampaignDetailDto } from '#app/lib/api'
import { api } from '#app/lib/api'
import { getCampaignAttachments } from '#app/data/campaigns/queries'
import { queryKeys } from '#app/lib/queryKeys'
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
  const queryClient = useQueryClient()
  const attachments = useQuery(getCampaignAttachments(campaign.id))
  const visible = (attachments.data ?? []).filter(
    (attachment) => !sessionId || attachment.sessionId === sessionId
  )
  const remove = useMutation({
    mutationFn: (attachmentId: string) =>
      api.campaigns.attachments.delete(campaign.id, attachmentId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.attachments(campaign.id)
      })
  })
  const download = useMutation({
    mutationFn: (attachmentId: string) =>
      api.campaigns.attachments.delivery(campaign.id, attachmentId),
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
      {attachments.isPending ? <Loader aria-label='Loading Campaign files' size='sm' /> : null}
      {attachments.error ? <Alert color='red'>Campaign files couldn’t be loaded.</Alert> : null}
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
      {!attachments.isPending && !attachments.error && visible.length === 0 ? (
        <Text c='dimmed'>No files attached.</Text>
      ) : null}
      {download.error ? <Alert color='red'>That file couldn’t be downloaded.</Alert> : null}
      {remove.error ? <Alert color='red'>That file couldn’t be removed.</Alert> : null}
    </section>
  )
}
