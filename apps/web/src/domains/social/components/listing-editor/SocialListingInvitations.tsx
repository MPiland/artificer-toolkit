import { Alert, Badge, Button, Group, Loader, Text, Title } from '@mantine/core'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { api, type CampaignInviteDto } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { formatSocialTimestamp, formatStatusLabel } from '../../socialModels'
import { SocialEmptyState } from '../SocialEmptyState'
import * as styles from '../SocialHubViews.css'

export function SocialListingInvitations({
  invitePublicId,
  listingPublicId
}: {
  invitePublicId?: string
  listingPublicId: string
}) {
  const focusedRow = useRef<HTMLElement>(null)
  const queryClient = useQueryClient()
  const invitations = useQuery({
    queryKey: queryKeys.socialHub.invitationsSent(listingPublicId),
    queryFn: () => api.campaigns.invites.listSent(listingPublicId)
  })
  const revoke = useMutation({
    mutationFn: (invitation: CampaignInviteDto) =>
      api.campaigns.invites.revoke(invitation.invitePublicId, invitation.version),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.socialHub.invitationsSent(listingPublicId)
      })
  })

  useEffect(() => {
    if (invitations.data && invitePublicId) focusedRow.current?.focus()
  }, [invitations.data, invitePublicId])

  if (invitations.isPending) return <Loader aria-label='Loading sent invitations' size='sm' />
  if (invitations.isError) return <Alert color='red'>Could not load sent invitations.</Alert>
  if (invitations.data.length === 0 && !invitePublicId) {
    return (
      <SocialEmptyState
        title='No invitations sent'
        body='Invitations you send for this listing will appear here.'
      />
    )
  }

  return (
    <div className={styles.rows} aria-label='Sent invitations'>
      {invitePublicId &&
      !invitations.data.some((invitation) => invitation.invitePublicId === invitePublicId) ? (
        <Alert color='gray'>This item is no longer available.</Alert>
      ) : null}
      {revoke.isError ? <Alert color='red'>That invitation could not be revoked.</Alert> : null}
      {invitations.data.map((invitation) => (
        <article
          className={styles.row}
          data-highlighted={invitation.invitePublicId === invitePublicId || undefined}
          key={invitation.invitePublicId}
          ref={invitation.invitePublicId === invitePublicId ? focusedRow : undefined}
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
          {invitation.status === 'PENDING' ? (
            <div className={styles.rowActions}>
              <Button
                color='red'
                loading={
                  revoke.isPending && revoke.variables?.invitePublicId === invitation.invitePublicId
                }
                mih={44}
                size='xs'
                variant='subtle'
                onClick={() => revoke.mutate(invitation)}
              >
                Revoke invitation
              </Button>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  )
}
