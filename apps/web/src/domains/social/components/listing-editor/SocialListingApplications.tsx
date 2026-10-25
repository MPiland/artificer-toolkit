import { Alert, Badge, Button, Group, Loader, Text, Title } from '@mantine/core'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type {
  DecideSocialApplicationInput,
  SocialApplicationDto
} from '@artificer-toolkit/schema/api/socialHub'
import { useMutation as useConvexMutation, usePaginatedQuery } from 'convex/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CatchBoundary } from '@tanstack/react-router'
import { queryKeys } from '#app/lib/queryKeys'
import { formatEnumLabel } from '#components/AuthoredDetail'
import { admissionPageSize, mergeAdmissionRows } from '../../hooks/admissionLists'
import { AdmissionListFooter } from '../AdmissionListFooter'
import { SocialReportDialog } from '../SocialReportDialog'
import * as listStyles from '../SocialHubViews.css'
import * as styles from './SocialListingSections.css'

export function SocialListingApplications({ listingPublicId }: { listingPublicId: string }) {
  const normalizedListingPublicId = listingPublicId.toLowerCase()
  return (
    <CatchBoundary
      getResetKey={() => `social-listing-applications:${normalizedListingPublicId}`}
      errorComponent={ApplicationsError}
    >
      <SocialListingApplicationsList listingPublicId={normalizedListingPublicId} />
    </CatchBoundary>
  )
}

function SocialListingApplicationsList({ listingPublicId }: { listingPublicId: string }) {
  const pending = usePaginatedQuery(
    convexApi.social.admissionLists.listListingApplications,
    { listingPublicId, group: 'PENDING' },
    { initialNumItems: admissionPageSize }
  )
  const history = usePaginatedQuery(
    convexApi.social.admissionLists.listListingApplications,
    { listingPublicId, group: 'HISTORY' },
    { initialNumItems: admissionPageSize }
  )
  const queryClient = useQueryClient()
  const decideApplication = useConvexMutation(convexApi.social.applications.decide)
  const decide = useMutation({
    mutationFn: (input: DecideSocialApplicationInput) => decideApplication(input),
    onSuccess: (_application, variables) => {
      if (variables.decision === 'ACCEPT') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all() })
      }
    }
  })
  const {
    rows: applications,
    loadingFirstPage,
    exhaustedEmpty: empty
  } = mergeAdmissionRows<SocialApplicationDto>({
    pending,
    history,
    direct: undefined,
    isPending: (application) => application.status === 'SUBMITTED',
    getKey: (application) => application.applicationPublicId
  })

  return (
    <section className={styles.panel} aria-labelledby='listing-applications-title'>
      <Title id='listing-applications-title' order={2}>
        Applications for this table
      </Title>
      {loadingFirstPage ? <Loader aria-label='Loading listing applications' size='sm' /> : null}
      {decide.error ? <Alert color='red'>{decide.error.message}</Alert> : null}
      {empty ? <Text c='dimmed'>No applications for this listing.</Text> : null}
      {!empty ? (
        <div className={listStyles.rows} aria-label='Listing applications'>
          {applications.map((application) => (
            <article className={listStyles.row} key={application.applicationPublicId}>
              <div className={listStyles.rowBody}>
                <Group gap='xs'>
                  <Title order={3} size='h4'>
                    @{application.applicant.username}
                  </Title>
                  <Badge variant='light'>{formatEnumLabel(application.status)}</Badge>
                </Group>
                <Text className={listStyles.prose}>{application.message}</Text>
              </div>
              <div className={listStyles.rowActions}>
                {application.status === 'SUBMITTED' ? (
                  <>
                    <Button
                      disabled={decide.isPending}
                      loading={
                        decide.isPending &&
                        decide.variables?.applicationPublicId === application.applicationPublicId &&
                        decide.variables.decision === 'ACCEPT'
                      }
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
                      disabled={decide.isPending}
                      loading={
                        decide.isPending &&
                        decide.variables?.applicationPublicId === application.applicationPublicId &&
                        decide.variables.decision === 'DECLINE'
                      }
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
        </div>
      ) : null}
      <AdmissionListFooter noun='application' pending={pending} history={history} />
    </section>
  )
}

function ApplicationsError() {
  return <Alert color='red'>Could not load applications.</Alert>
}
