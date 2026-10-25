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
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type { SocialModerationEvidenceDto } from '@artificer-toolkit/schema/api/socialModeration'
import type { TakeSocialModerationActionInput } from '@artificer-toolkit/schema/api/socialHub'
import { useMutation } from '@tanstack/react-query'
import { CatchBoundary } from '@tanstack/react-router'
import { useMutation as useConvexMutation, usePaginatedQuery } from 'convex/react'
import { useState } from 'react'
import { SocialModerationQueueRow } from './components/SocialModerationQueueRow'
import { formatEnumLabel } from '#components/AuthoredDetail'
import { socialModerationActions } from './socialModels'
import * as styles from './SocialModerationPage.css'

export function SocialModerationPage() {
  return (
    <section className={styles.page} aria-labelledby='social-moderation-title'>
      <header className={styles.headerCopy}>
        <Title id='social-moderation-title' order={1}>
          Social moderation
        </Title>
        <Text c='dimmed'>Opening evidence is recorded in the audit log.</Text>
      </header>
      <CatchBoundary getResetKey={() => 'social-moderation'} errorComponent={SocialModerationError}>
        <SocialModerationWorkspace />
      </CatchBoundary>
    </section>
  )
}

function SocialModerationWorkspace() {
  const [openedReport, setOpenedReport] = useState<SocialModerationEvidenceDto>()
  const [action, setAction] = useState<TakeSocialModerationActionInput['action']>('START_REVIEW')
  const [reason, setReason] = useState('')
  const queue = usePaginatedQuery(convexApi.social.moderation.list, {}, { initialNumItems: 8 })
  const open = useConvexMutation(convexApi.social.moderation.open)
  const review = useConvexMutation(convexApi.social.moderation.review)
  const moderateListing = useConvexMutation(convexApi.social.listingModeration.action)
  const moderateProfile = useConvexMutation(convexApi.social.profileModeration.action)
  const openReport = useMutation({
    mutationFn: (reportPublicId: string) => open({ reportPublicId }),
    onSuccess: (result) => {
      setOpenedReport(result)
      setReason('')
      takeAction.reset()
    }
  })
  const takeAction = useMutation({
    mutationFn: () => {
      if (!openedReport) throw new Error('Open a report first.')
      const input = {
        reportPublicId: openedReport.reportPublicId,
        reason,
        expectedVersion: openedReport.version
      }
      switch (action) {
        case 'HIDE_LISTING':
        case 'RESTORE_LISTING':
          return moderateListing({ ...input, action })
        case 'SUSPEND_PROFILE':
        case 'RESTORE_PROFILE':
          return moderateProfile({ ...input, action })
        default:
          return review({ ...input, action })
      }
    },
    onSuccess: (result) => {
      setOpenedReport(result)
      setReason('')
      notifications.show({ color: 'green', message: 'Moderation action recorded.' })
    }
  })

  return (
    <>
      {queue.status === 'LoadingFirstPage' ? (
        <Loader aria-label='Loading moderation queue' size='sm' />
      ) : null}
      {openReport.error ? <Alert color='red'>{openReport.error.message}</Alert> : null}
      {queue.status === 'Exhausted' && queue.results.length === 0 ? (
        <Text c='dimmed'>No reports in the queue.</Text>
      ) : null}
      {queue.status !== 'LoadingFirstPage' ? (
        <div className={styles.detailGrid}>
          <div className={styles.rows} aria-label='Moderation queue'>
            {queue.results.map((item) => (
              <SocialModerationQueueRow
                item={item}
                isOpening={openReport.isPending && openReport.variables === item.reportPublicId}
                disabled={openReport.isPending || takeAction.isPending}
                key={item.reportPublicId}
                onOpen={() => openReport.mutate(item.reportPublicId)}
              />
            ))}
            {queue.status === 'CanLoadMore' ? (
              <Button variant='subtle' onClick={() => queue.loadMore(8)}>
                Load more reports
              </Button>
            ) : null}
            {queue.status === 'LoadingMore' ? (
              <Loader aria-label='Loading more reports' size='sm' />
            ) : null}
          </div>
          <aside className={styles.panel} aria-label='Opened report evidence'>
            {openedReport ? (
              <>
                <Group gap='xs'>
                  <Title order={2} size='h3'>
                    Opened report
                  </Title>
                  <Badge>{formatEnumLabel(openedReport.status)}</Badge>
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
                    disabled={openReport.isPending || takeAction.isPending}
                    value={action}
                    onChange={(value) => {
                      const next = socialModerationActions.find((option) => option.value === value)
                      if (next) setAction(next.value)
                    }}
                  />
                  <Textarea
                    autosize
                    label='Audit reason'
                    disabled={openReport.isPending || takeAction.isPending}
                    maxLength={4000}
                    minRows={3}
                    required
                    value={reason}
                    onChange={(event) => setReason(event.currentTarget.value)}
                  />
                  {takeAction.error ? <Alert color='red'>{takeAction.error.message}</Alert> : null}
                  <Button
                    disabled={openReport.isPending || !reason.trim()}
                    loading={takeAction.isPending}
                    onClick={() => takeAction.mutate()}
                  >
                    Record action
                  </Button>
                </Stack>
              </>
            ) : (
              <Text c='dimmed'>Select a report to view its evidence.</Text>
            )}
          </aside>
        </div>
      ) : null}
    </>
  )
}

function SocialModerationError({ reset }: { reset: () => void }) {
  return (
    <Alert color='red'>
      Moderation queue unavailable.
      <Button mt='sm' size='xs' variant='default' onClick={reset}>
        Retry queue
      </Button>
    </Alert>
  )
}
