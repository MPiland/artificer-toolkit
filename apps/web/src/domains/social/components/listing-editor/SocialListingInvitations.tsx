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
import { formatEnumLabel } from '#components/AuthoredDetail'
import { formatSocialTimestamp } from '../../socialModels'
import { admissionPageSize, mergeAdmissionRows } from '../../hooks/admissionLists'
import { useInvitationExpiry } from '../../hooks/useInvitationExpiry'
import { AdmissionListFooter } from '../AdmissionListFooter'
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
    { initialNumItems: admissionPageSize }
  )
  const history = usePaginatedQuery(
    convexApi.social.admissionLists.listListingInvitations,
    { listingPublicId, group: 'HISTORY', asOf },
    { initialNumItems: admissionPageSize }
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
  return (
    <>
      {loadingFirstPage ? <Loader aria-label='Loading sent invitations' size='sm' /> : null}
      {direct.isError ? <Alert color='gray'>This item is no longer available.</Alert> : null}
      {revoke.error ? <Alert color='red'>{revoke.error.message}</Alert> : null}
      {exhaustedEmpty && !invitePublicId ? (
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
                  <Badge variant='light'>{formatEnumLabel(invitation.status)}</Badge>
                </Group>
                <Text c='dimmed' size='sm'>
                  Sent {formatSocialTimestamp(invitation.createdAt)} - Expires{' '}
                  {formatSocialTimestamp(invitation.expiresAt)}
                </Text>
              </div>
              {invitation.status === 'PENDING' &&
              Date.parse(invitation.expiresAt) > Date.parse(asOf) ? (
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
      <AdmissionListFooter noun='invitation' pending={pending} history={history} />
    </>
  )
}

function InvitationError() {
  return <Alert color='red'>Could not load sent invitations.</Alert>
}
