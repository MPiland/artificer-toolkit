import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  Textarea,
  Title
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { SocialModerationReportDto, TakeSocialModerationActionInput } from '#app/lib/api'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { SocialModerationQueueRow } from './components/SocialModerationQueueRow'
import { formatStatusLabel, socialModerationActions } from './socialModels'
import * as styles from './SocialModerationPage.css'

export function SocialModerationPage() {
  const queryClient = useQueryClient()
  const [openedReport, setOpenedReport] = useState<SocialModerationReportDto>()
  const [action, setAction] = useState<TakeSocialModerationActionInput['action']>('START_REVIEW')
  const [reason, setReason] = useState('')
  const queue = useQuery({
    queryKey: queryKeys.socialHub.moderationQueue(),
    queryFn: () => api.socialHub.moderation.queue()
  })
  const openReport = useMutation({
    mutationFn: (reportPublicId: string) => api.socialHub.moderation.openReport(reportPublicId),
    onSuccess: setOpenedReport
  })
  const takeAction = useMutation({
    mutationFn: () => {
      if (!openedReport) throw new Error('Open a report first.')
      return api.socialHub.moderation.takeAction({
        reportPublicId: openedReport.reportPublicId,
        action,
        reason,
        expectedVersion: openedReport.version
      })
    },
    onSuccess: (result) => {
      setOpenedReport(result)
      setReason('')
      notifications.show({ color: 'green', message: 'Moderation action recorded.' })
      void queryClient.invalidateQueries({ queryKey: queryKeys.socialHub.moderationQueue() })
    }
  })

  return (
    <section className={styles.page} aria-labelledby='social-moderation-title'>
      <header className={styles.headerCopy}>
        <Title id='social-moderation-title' order={1}>
          Social moderation
        </Title>
        <Text c='dimmed'>Report metadata is shown first. Opening evidence is audited.</Text>
      </header>
      {queue.isPending ? <Loader aria-label='Loading moderation queue' size='sm' /> : null}
      {queue.isError ? <Alert color='red'>Moderation queue unavailable.</Alert> : null}
      {queue.data?.length === 0 ? <Text c='dimmed'>No reports in the queue.</Text> : null}
      {queue.data ? (
        <div className={styles.detailGrid}>
          <div className={styles.rows} aria-label='Moderation queue'>
            {queue.data.map((item) => (
              <SocialModerationQueueRow
                item={item}
                isOpening={openReport.isPending && openReport.variables === item.reportPublicId}
                key={item.reportPublicId}
                onOpen={() => openReport.mutate(item.reportPublicId)}
              />
            ))}
          </div>
          <aside className={styles.panel} aria-label='Opened report evidence'>
            {openedReport ? (
              <>
                <Group gap='xs'>
                  <Title order={2} size='h3'>
                    Opened report
                  </Title>
                  <Badge>{formatStatusLabel(openedReport.status)}</Badge>
                </Group>
                <Text>
                  <strong>Reporter:</strong> @{openedReport.reporter.username}
                </Text>
                <Text className={styles.prose}>{openedReport.details}</Text>
                <div>
                  <Text fw={600}>Captured evidence</Text>
                  <pre className={styles.evidence}>
                    {JSON.stringify(openedReport.evidence, null, 2)}
                  </pre>
                </div>
                <Stack>
                  <Select
                    data={socialModerationActions.map((option) => ({ ...option }))}
                    label='Action'
                    value={action}
                    onChange={(value) => {
                      const next = socialModerationActions.find((option) => option.value === value)
                      if (next) setAction(next.value)
                    }}
                  />
                  <Textarea
                    autosize
                    label='Audit reason'
                    maxLength={4000}
                    minRows={3}
                    required
                    value={reason}
                    onChange={(event) => setReason(event.currentTarget.value)}
                  />
                  {takeAction.error ? <Alert color='red'>{takeAction.error.message}</Alert> : null}
                  <Button
                    disabled={!reason.trim()}
                    loading={takeAction.isPending}
                    onClick={() => takeAction.mutate()}
                  >
                    Record action
                  </Button>
                </Stack>
              </>
            ) : (
              <Text c='dimmed'>Open a report to record the audited evidence view.</Text>
            )}
          </aside>
        </div>
      ) : null}
    </section>
  )
}
