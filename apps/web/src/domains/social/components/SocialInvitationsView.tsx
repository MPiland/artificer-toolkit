import { Alert, Badge, Button, Group, Loader, Text, Title } from '@mantine/core'
import { convexQuery } from '@convex-dev/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type {
  CampaignInviteDto,
  CampaignInviteVersionInput
} from '@artificer-toolkit/schema/api/campaignCore'
import { useMutation as useConvexMutation, usePaginatedQuery } from 'convex/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CatchBoundary } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { notifications } from '@mantine/notifications'
import { formatEnumLabel } from '#components/AuthoredDetail'
import { admissionPageSize, mergeAdmissionRows } from '../hooks/admissionLists'
import { useInvitationExpiry } from '../hooks/useInvitationExpiry'
import { formatSocialTimestamp } from '../socialModels'
import { AdmissionListFooter } from './AdmissionListFooter'
import { SocialEmptyState } from './SocialEmptyState'
import { queryKeys } from '#app/lib/queryKeys'
import * as styles from './SocialHubViews.css'

export function SocialInvitationsView({ invitePublicId }: { invitePublicId?: string }) {
  const normalizedInvitePublicId = invitePublicId?.toLowerCase()
  return (
    <CatchBoundary getResetKey={() => 'social-invitations'} errorComponent={InvitationError}>
      <SocialInvitationsList invitePublicId={normalizedInvitePublicId} />
    </CatchBoundary>
  )
}

function SocialInvitationsList({ invitePublicId }: { invitePublicId?: string }) {
  const [asOf, setAsOf] = useState(() => new Date().toISOString())
  const pending = usePaginatedQuery(
    convexApi.social.admissionLists.listReceivedInvitations,
    { group: 'PENDING', asOf },
    { initialNumItems: admissionPageSize }
  )
  const history = usePaginatedQuery(
    convexApi.social.admissionLists.listReceivedInvitations,
    { group: 'HISTORY', asOf },
    { initialNumItems: admissionPageSize }
  )
  const direct = useQuery(
    convexQuery(
      convexApi.social.invitationReads.getReceived,
      invitePublicId ? { invitePublicId, asOf } : 'skip'
    )
  )
  const queryClient = useQueryClient()
  const acceptInvite = useConvexMutation(convexApi.social.invitations.accept)
  const declineInvite = useConvexMutation(convexApi.social.invitations.decline)
  const accept = useMutation({
    mutationFn: (input: CampaignInviteVersionInput) => acceptInvite(input),
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'Invitation accepted.' })
      void queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all() })
    }
  })
  const decline = useMutation({
    mutationFn: (input: CampaignInviteVersionInput) => declineInvite(input)
  })
  const focused = useRef<string | null>(null)
  const { rows, loadingFirstPage, exhaustedEmpty } = mergeAdmissionRows<CampaignInviteDto>({
    pending,
    history,
    direct: direct.data,
    isPending: (invitation) => invitation.status === 'PENDING',
    getKey: (invitation) => invitation.invitePublicId
  })
  useInvitationExpiry(asOf, setAsOf, rows)
  const target = rows.some((item) => item.invitePublicId === invitePublicId) ? invitePublicId : null
  useEffect(() => {
    if (!target || direct.isError || focused.current === target) return
    const row = document.getElementById(`invitation-${target}`)
    if (!row) return
    focused.current = target
    row.focus({ preventScroll: true })
    row.scrollIntoView({ block: 'center' })
  }, [direct.isError, target])
  const writing = accept.isPending || decline.isPending
  return (
    <>
      {loadingFirstPage ? <Loader aria-label='Loading invitations' size='sm' /> : null}
      {direct.isError ? <Alert color='gray'>This item is no longer available.</Alert> : null}
      {accept.error ? <Alert color='red'>{accept.error.message}</Alert> : null}
      {decline.error ? <Alert color='red'>{decline.error.message}</Alert> : null}
      {exhaustedEmpty && !invitePublicId ? (
        <SocialEmptyState
          title='No invitations'
          body='Username invitations sent to you will appear here.'
        />
      ) : (
        <div className={styles.rows} aria-label='Received invitations'>
          {rows.map((invitation) => (
            <article
              className={styles.row}
              data-highlighted={invitation.invitePublicId === invitePublicId || undefined}
              id={`invitation-${invitation.invitePublicId}`}
              key={invitation.invitePublicId}
              tabIndex={invitation.invitePublicId === invitePublicId ? -1 : undefined}
            >
              <div className={styles.rowBody}>
                <Group gap='xs'>
                  <Title order={2} size='h3'>
                    {invitation.listingTitle}
                  </Title>
                  <Badge variant='light'>{formatEnumLabel(invitation.status)}</Badge>
                </Group>
                <Text>Hosted by @{invitation.hostUsername}</Text>
                <Text c='dimmed' size='sm'>
                  Expires {formatSocialTimestamp(invitation.expiresAt)}
                </Text>
                {invitation.invitePublicId === invitePublicId &&
                (invitation.status === 'REVOKED' || invitation.status === 'EXPIRED') ? (
                  <Alert color='gray'>
                    Sorry, this invitation has either been revoked or expired.
                  </Alert>
                ) : null}
              </div>
              {invitation.status === 'PENDING' &&
              Date.parse(invitation.expiresAt) > Date.parse(asOf) ? (
                <div className={styles.rowActions}>
                  <Button
                    disabled={writing}
                    loading={
                      accept.isPending &&
                      accept.variables?.invitePublicId === invitation.invitePublicId
                    }
                    size='xs'
                    onClick={() =>
                      accept.mutate({
                        invitePublicId: invitation.invitePublicId,
                        expectedVersion: invitation.version
                      })
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    disabled={writing}
                    loading={
                      decline.isPending &&
                      decline.variables?.invitePublicId === invitation.invitePublicId
                    }
                    size='xs'
                    variant='default'
                    onClick={() =>
                      decline.mutate({
                        invitePublicId: invitation.invitePublicId,
                        expectedVersion: invitation.version
                      })
                    }
                  >
                    Decline
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
      <AdmissionListFooter noun='invitation' pending={pending} history={history} />
    </>
  )
}

function InvitationError() {
  return <Alert color='red'>Could not load invitations.</Alert>
}
