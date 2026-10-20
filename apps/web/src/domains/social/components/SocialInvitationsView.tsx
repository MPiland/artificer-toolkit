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
import { formatStatusLabel } from '../socialModels'
import { useInvitationExpiry } from '../hooks/useInvitationExpiry'
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
    { initialNumItems: 24 }
  )
  const history = usePaginatedQuery(
    convexApi.social.admissionLists.listReceivedInvitations,
    { group: 'HISTORY', asOf },
    { initialNumItems: 24 }
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
  const pendingRows =
    direct.data?.status === 'PENDING' ? [direct.data, ...pending.results] : pending.results
  const historyRows =
    direct.data && direct.data.status !== 'PENDING'
      ? [direct.data, ...history.results]
      : history.results
  const merged = new Map<string, CampaignInviteDto>()
  for (const invitation of [...pendingRows, ...historyRows])
    merged.set(invitation.invitePublicId, invitation)
  const rows = [...merged.values()]
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
  const empty =
    pending.status === 'Exhausted' && history.status === 'Exhausted' && rows.length === 0
  const writing = accept.isPending || decline.isPending
  return (
    <>
      {pending.status === 'LoadingFirstPage' || history.status === 'LoadingFirstPage' ? (
        <Loader aria-label='Loading invitations' size='sm' />
      ) : null}
      {direct.isError ? <Alert color='gray'>This item is no longer available.</Alert> : null}
      {accept.error ? <Alert color='red'>{accept.error.message}</Alert> : null}
      {decline.error ? <Alert color='red'>{decline.error.message}</Alert> : null}
      {empty && !invitePublicId ? (
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
                  <Badge variant='light'>{formatStatusLabel(invitation.status)}</Badge>
                </Group>
                <Text>Hosted by @{invitation.hostUsername}</Text>
                <Text c='dimmed' size='sm'>
                  Expires{' '}
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  }).format(new Date(invitation.expiresAt))}
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
      {pending.status === 'CanLoadMore' ? (
        <Button variant='subtle' onClick={() => pending.loadMore(24)}>
          Load more pending invitations
        </Button>
      ) : null}
      {history.status === 'CanLoadMore' ? (
        <Button variant='subtle' onClick={() => history.loadMore(24)}>
          Load more invitation history
        </Button>
      ) : null}
      {pending.status === 'LoadingMore' || history.status === 'LoadingMore' ? (
        <Loader aria-label='Loading more invitations' size='sm' />
      ) : null}
    </>
  )
}

function InvitationError() {
  return <Alert color='red'>Could not load invitations.</Alert>
}
