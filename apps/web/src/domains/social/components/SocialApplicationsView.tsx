import { Alert, Badge, Button, Group, Loader, Stack, Text, Title } from '@mantine/core'
import { convexQuery } from '@convex-dev/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type {
  SocialApplicationDto,
  SocialApplicationVersionInput
} from '@artificer-toolkit/schema/api/socialHub'
import { useMutation as useConvexMutation, usePaginatedQuery } from 'convex/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CatchBoundary } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { formatEnumLabel } from '#components/AuthoredDetail'
import { admissionPageSize, mergeAdmissionRows } from '../hooks/admissionLists'
import { formatSocialDate } from '../socialModels'
import { AdmissionListFooter } from './AdmissionListFooter'
import { SocialBlocksPanel } from './SocialBlocksPanel'
import { SocialEmptyState } from './SocialEmptyState'
import { SocialReportDialog } from './SocialReportDialog'
import * as styles from './SocialHubViews.css'

export function SocialApplicationsView({ applicationPublicId }: { applicationPublicId?: string }) {
  return (
    <Stack gap='xl'>
      <CatchBoundary
        getResetKey={() => 'social-applications'}
        errorComponent={SocialApplicationsError}
      >
        <SocialApplicationsList applicationPublicId={applicationPublicId?.toLowerCase()} />
      </CatchBoundary>
      <SocialBlocksPanel />
    </Stack>
  )
}

function SocialApplicationsList({ applicationPublicId }: { applicationPublicId?: string }) {
  const pending = usePaginatedQuery(
    convexApi.social.admissionLists.listOwnApplications,
    { group: 'PENDING' },
    { initialNumItems: admissionPageSize }
  )
  const history = usePaginatedQuery(
    convexApi.social.admissionLists.listOwnApplications,
    { group: 'HISTORY' },
    { initialNumItems: admissionPageSize }
  )
  const direct = useQuery(
    convexQuery(
      convexApi.social.applications.getOwn,
      applicationPublicId ? { applicationPublicId } : 'skip'
    )
  )
  const withdrawApplication = useConvexMutation(convexApi.social.applications.withdraw)
  const withdraw = useMutation({
    mutationFn: (input: SocialApplicationVersionInput) => withdrawApplication(input)
  })
  const focusedApplicationPublicId = useRef<string | null>(null)
  const {
    rows: applications,
    loadingFirstPage,
    exhaustedEmpty
  } = mergeAdmissionRows<SocialApplicationDto>({
    pending,
    history,
    direct: direct.data,
    isPending: (application) => application.status === 'SUBMITTED',
    getKey: (application) => application.applicationPublicId
  })
  const matchingApplicationPublicId = applications.some(
    (item) => item.applicationPublicId === applicationPublicId
  )
    ? applicationPublicId
    : null

  useEffect(() => {
    if (
      !matchingApplicationPublicId ||
      direct.isError ||
      direct.isPending ||
      focusedApplicationPublicId.current === matchingApplicationPublicId
    )
      return
    const element = document.getElementById(`application-${matchingApplicationPublicId}`)
    if (!element) return
    focusedApplicationPublicId.current = matchingApplicationPublicId
    element.focus({ preventScroll: true })
    element.scrollIntoView({ block: 'center' })
  }, [direct.isError, direct.isPending, matchingApplicationPublicId])

  return (
    <>
      {loadingFirstPage ? <Loader aria-label='Loading applications' size='sm' /> : null}
      {direct.isError ? <Alert color='gray'>This item is no longer available.</Alert> : null}
      {withdraw.error ? <Alert color='red'>{withdraw.error.message}</Alert> : null}
      {exhaustedEmpty && !applicationPublicId ? (
        <SocialEmptyState
          title='No applications yet'
          body='Applications you send will appear here.'
        />
      ) : (
        <div className={styles.rows} aria-label='My applications'>
          {applications.map((application) => (
            <SocialApplicationRow
              application={application}
              applicationPublicId={applicationPublicId}
              key={application.applicationPublicId}
              withdraw={withdraw}
            />
          ))}
        </div>
      )}
      <AdmissionListFooter noun='application' pending={pending} history={history} />
    </>
  )
}

function SocialApplicationRow({
  application,
  applicationPublicId,
  withdraw
}: {
  application: SocialApplicationDto
  applicationPublicId?: string
  withdraw: {
    isPending: boolean
    variables?: SocialApplicationVersionInput
    mutate: (input: SocialApplicationVersionInput) => void
  }
}) {
  return (
    <article
      className={styles.row}
      data-highlighted={application.applicationPublicId === applicationPublicId || undefined}
      id={`application-${application.applicationPublicId}`}
      tabIndex={application.applicationPublicId === applicationPublicId ? -1 : undefined}
    >
      <div className={styles.rowBody}>
        <Group gap='xs'>
          <Title order={2} size='h3'>
            {application.listingTitle}
          </Title>
          <Badge variant='light'>{formatEnumLabel(application.status)}</Badge>
        </Group>
        <Text className={styles.prose}>{application.message}</Text>
        <Text c='dimmed' size='sm'>
          Submitted {formatSocialDate(application.submittedAt)}
        </Text>
      </div>
      <div className={styles.rowActions}>
        {application.status === 'SUBMITTED' ? (
          <Button
            color='red'
            disabled={withdraw.isPending}
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
          target={{ targetKind: 'APPLICATION', targetPublicId: application.applicationPublicId }}
        />
      </div>
    </article>
  )
}

function SocialApplicationsError() {
  return <Alert color='red'>Could not load applications.</Alert>
}
