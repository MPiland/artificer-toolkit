import { Alert, Badge, Button, Group, Loader, Stack, Text, Title } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { formatStatusLabel } from '../socialModels'
import { SocialBlocksPanel } from './SocialBlocksPanel'
import { SocialEmptyState } from './SocialEmptyState'
import { SocialReportDialog } from './SocialReportDialog'
import * as styles from './SocialHubViews.css'

export function SocialApplicationsView() {
  const queryClient = useQueryClient()
  const applications = useQuery({
    queryKey: queryKeys.socialHub.applicationsMine(),
    queryFn: () => api.socialHub.applications.mine()
  })
  const withdraw = useMutation({
    mutationFn: (input: { applicationPublicId: string; expectedVersion: number }) =>
      api.socialHub.applications.withdraw(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.socialHub.applicationsMine() })
  })

  if (applications.isPending) return <Loader aria-label='Loading applications' size='sm' />
  if (applications.isError) return <Alert color='red'>Could not load applications.</Alert>
  return (
    <Stack gap='xl'>
      {applications.data.length === 0 ? (
        <SocialEmptyState
          title='No applications yet'
          body='Applications you send will appear here.'
        />
      ) : (
        <div className={styles.rows} aria-label='My applications'>
          {applications.data.map((application) => (
            <article className={styles.row} key={application.applicationPublicId}>
              <div className={styles.rowBody}>
                <Group gap='xs'>
                  <Title order={2} size='h3'>
                    {application.listingTitle}
                  </Title>
                  <Badge variant='light'>{formatStatusLabel(application.status)}</Badge>
                </Group>
                <Text className={styles.prose}>{application.message}</Text>
                <Text c='dimmed' size='sm'>
                  Submitted{' '}
                  {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
                    new Date(application.submittedAt)
                  )}
                </Text>
              </div>
              <div className={styles.rowActions}>
                {application.status === 'SUBMITTED' ? (
                  <Button
                    color='red'
                    loading={
                      withdraw.isPending &&
                      withdraw.variables?.applicationPublicId === application.applicationPublicId
                    }
                    size='xs'
                    variant='subtle'
                    onClick={() =>
                      withdraw.mutate({
                        applicationPublicId: application.applicationPublicId,
                        expectedVersion: application.version
                      })
                    }
                  >
                    Withdraw application
                  </Button>
                ) : null}
                <SocialReportDialog
                  target={{
                    targetKind: 'APPLICATION',
                    targetPublicId: application.applicationPublicId
                  }}
                />
              </div>
            </article>
          ))}
        </div>
      )}
      <SocialBlocksPanel />
    </Stack>
  )
}
