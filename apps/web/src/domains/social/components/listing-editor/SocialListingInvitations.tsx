import { Alert, Badge, Button, Group, Loader, Text, Title } from '@mantine/core'
import { convexQuery } from '@convex-dev/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import type {
  CampaignInviteDto,
  CampaignInviteVersionInput
} from '@artificer-toolkit/schema/api/campaignCore'
import { useMutation as useConvexMutation, usePaginatedQuery } from 'convex/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { CatchBoundary } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { formatSocialTimestamp, formatStatusLabel } from '../../socialModels'
import { useInvitationExpiry } from '../../hooks/useInvitationExpiry'
import { SocialEmptyState } from '../SocialEmptyState'
import * as styles from '../SocialHubViews.css'

export function SocialListingInvitations({
  invitePublicId,
  listingPublicId
}: {
  invitePublicId?: string
  listingPublicId: string
}) {
  const normalizedInvitePublicId = invitePublicId?.toLowerCase()
  const normalizedListingPublicId = listingPublicId.toLowerCase()
  return (
    <CatchBoundary
      getResetKey={() => `social-listing-invitations:${normalizedListingPublicId}`}
      errorComponent={InvitationError}
    >
      <SocialListingInvitationsList
        invitePublicId={normalizedInvitePublicId}
        listingPublicId={normalizedListingPublicId}
      />
    </CatchBoundary>
  )
}

function SocialListingInvitationsList({
  invitePublicId,
  listingPublicId
}: {
  invitePublicId?: string
  listingPublicId: string
}) {
  const [asOf, setAsOf] = useState(() => new Date().toISOString())
  const pending = usePaginatedQuery(
    convexApi.social.admissionLists.listListingInvitations,
    { listingPublicId, group: 'PENDING', asOf },
    { initialNumItems: 24 }
  )
  const history = usePaginatedQuery(
    convexApi.social.admissionLists.listListingInvitations,
    { listingPublicId, group: 'HISTORY', asOf },
    { initialNumItems: 24 }
  )
  const direct = useQuery(
    convexQuery(
      convexApi.social.invitationReads.getForListing,
      invitePublicId ? { listingPublicId, invitePublicId, asOf } : 'skip'
    )
  )
  const revokeInvite = useConvexMutation(convexApi.social.invitations.revoke)
  const revoke = useMutation({
    mutationFn: (input: CampaignInviteVersionInput) => revokeInvite(input)
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
  return (
    <>
      {pending.status === 'LoadingFirstPage' || history.status === 'LoadingFirstPage' ? (
        <Loader aria-label='Loading sent invitations' size='sm' />
      ) : null}
      {direct.isError ? <Alert color='gray'>This item is no longer available.</Alert> : null}
      {revoke.error ? <Alert color='red'>{revoke.error.message}</Alert> : null}
      {empty && !invitePublicId ? (
        <SocialEmptyState
          title='No invitations sent'
          body='Invitations you send for this listing will appear here.'
        />
      ) : (
        <div className={styles.rows} aria-label='Sent invitations'>
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
                    @{invitation.recipientUsername}
                  </Title>
                  <Badge variant='light'>{formatStatusLabel(invitation.status)}</Badge>
                </Group>
                <Text c='dimmed' size='sm'>
                  Sent {formatSocialTimestamp(invitation.createdAt)} - Expires{' '}
                  {formatSocialTimestamp(invitation.expiresAt)}
                </Text>
              </div>
              {invitation.status === 'PENDING' && Date.parse(invitation.expiresAt) > Date.now() ? (
                <div className={styles.rowActions}>
                  <Button
                    color='red'
                    disabled={revoke.isPending}
                    loading={
                      revoke.isPending &&
                      revoke.variables?.invitePublicId === invitation.invitePublicId
                    }
                    mih={44}
                    size='xs'
                    variant='subtle'
                    onClick={() =>
                      revoke.mutate({
                        invitePublicId: invitation.invitePublicId,
                        expectedVersion: invitation.version
                      })
                    }
                  >
                    Revoke invitation
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
  return <Alert color='red'>Could not load sent invitations.</Alert>
}
