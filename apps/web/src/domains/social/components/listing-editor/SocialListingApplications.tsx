import { Alert, Badge, Button, Group, Loader, Stack, Text, Title } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { SocialListingDto } from '#app/lib/api'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { formatStatusLabel } from '../../socialModels'
import { SocialReportDialog } from '../SocialReportDialog'
import * as listStyles from '../SocialHubViews.css'
import * as styles from './SocialListingSections.css'

export function SocialListingApplications({
  applications,
  isError,
  isPending,
  listing
}: {
  applications: Awaited<ReturnType<typeof api.socialHub.applications.forListing>>
  isError: boolean
  isPending: boolean
  listing: SocialListingDto
}) {
  const queryClient = useQueryClient()
  const decide = useMutation({
    mutationFn: (input: {
      applicationPublicId: string
      expectedVersion: number
      decision: 'ACCEPT' | 'DECLINE'
    }) => api.socialHub.applications.decide(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.socialHub.applicationsForListing(listing.listingPublicId)
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.socialHub.listing(listing.listingPublicId)
      })
    }
  })

  return (
    <section className={styles.panel} aria-labelledby='listing-applications-title'>
      <Title id='listing-applications-title' order={2}>
        Applications for this table
      </Title>
      {isPending ? <Loader aria-label='Loading listing applications' size='sm' /> : null}
      {isError ? <Alert color='red'>Could not load applications.</Alert> : null}
      {!isPending && !isError && applications.length === 0 ? (
        <Text c='dimmed'>No applications for this listing.</Text>
      ) : null}
      <Stack>
        {applications.map((application) => (
          <article className={listStyles.row} key={application.applicationPublicId}>
            <div className={listStyles.rowBody}>
              <Group gap='xs'>
                <Title order={3} size='h4'>
                  @{application.applicant.username}
                </Title>
                <Badge variant='light'>{formatStatusLabel(application.status)}</Badge>
              </Group>
              <Text className={listStyles.prose}>{application.message}</Text>
            </div>
            <div className={listStyles.rowActions}>
              {application.status === 'SUBMITTED' ? (
                <>
                  <Button
                    loading={decide.isPending}
                    size='xs'
                    onClick={() =>
                      decide.mutate({
                        applicationPublicId: application.applicationPublicId,
                        expectedVersion: application.version,
                        decision: 'ACCEPT'
                      })
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    loading={decide.isPending}
                    size='xs'
                    variant='default'
                    onClick={() =>
                      decide.mutate({
                        applicationPublicId: application.applicationPublicId,
                        expectedVersion: application.version,
                        decision: 'DECLINE'
                      })
                    }
                  >
                    Decline
                  </Button>
                </>
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
      </Stack>
    </section>
  )
}
