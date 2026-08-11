import { Alert, Badge, Button, Group, Loader, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { formatStatusLabel } from '../socialModels'
import { SocialEmptyState } from './SocialEmptyState'
import * as styles from './SocialHubViews.css'

export function SocialInvitationsView() {
  const queryClient = useQueryClient()
  const invitations = useQuery({
    queryKey: queryKeys.socialHub.invitationsReceived(),
    queryFn: () => api.campaigns.invites.listReceived()
  })
  const accept = useMutation({
    mutationFn: (input: { invitePublicId: string; expectedVersion: number }) =>
      api.campaigns.invites.accept(input.invitePublicId, input.expectedVersion),
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'Invitation accepted.' })
      void queryClient.invalidateQueries({ queryKey: queryKeys.socialHub.invitationsReceived() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all() })
    }
  })
  const decline = useMutation({
    mutationFn: (input: { invitePublicId: string; expectedVersion: number }) =>
      api.campaigns.invites.decline(input.invitePublicId, input.expectedVersion),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.socialHub.invitationsReceived() })
  })

  if (invitations.isPending) return <Loader aria-label='Loading invitations' size='sm' />
  if (invitations.isError) return <Alert color='red'>Could not load invitations.</Alert>
  if (invitations.data.length === 0) {
    return (
      <SocialEmptyState
        title='No invitations'
        body='Username invitations sent to you will appear here.'
      />
    )
  }

  return (
    <div className={styles.rows} aria-label='Received invitations'>
      {invitations.data.map((invitation) => (
        <article className={styles.row} key={invitation.invitePublicId}>
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
          </div>
          {invitation.status === 'PENDING' ? (
            <div className={styles.rowActions}>
              <Button
                size='xs'
                loading={accept.isPending}
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
                size='xs'
                variant='default'
                loading={decline.isPending}
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
  )
}
