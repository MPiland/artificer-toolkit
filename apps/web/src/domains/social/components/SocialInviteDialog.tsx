import { Alert, Button, Modal, Stack, Text, TextInput } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useMutation } from '@tanstack/react-query'
import { type SubmitEvent, useState } from 'react'
import type { SocialListingDto } from '@artificer-toolkit/schema/api/socialHub'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useMutation as useConvexMutation } from 'convex/react'

export function SocialInviteDialog({
  listing
}: {
  listing: Pick<SocialListingDto, 'listingPublicId' | 'version' | 'status' | 'title'>
}) {
  const [opened, { close, open }] = useDisclosure(false)
  const [username, setUsername] = useState('')
  const createInvitation = useConvexMutation(convexApi.social.invitations.create)
  const invite = useMutation({
    mutationFn: () =>
      createInvitation({
        listingPublicId: listing.listingPublicId,
        expectedListingVersion: listing.version,
        username
      }),
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'Invitation added to the player inbox.' })
      setUsername('')
      close()
    }
  })

  return (
    <>
      <Button disabled={listing.status !== 'OPEN'} size='xs' variant='default' onClick={open}>
        Invite player
      </Button>
      <Modal centered opened={opened} title={`Invite to ${listing.title}`} onClose={close}>
        <form
          onSubmit={(event: SubmitEvent) => {
            event.preventDefault()
            invite.mutate()
          }}
        >
          <Stack>
            <Text c='dimmed' size='sm'>
              The invitation will appear in this player&apos;s authenticated Social Hub inbox.
            </Text>
            <TextInput
              autoComplete='off'
              label='Username'
              maxLength={30}
              minLength={3}
              required
              value={username}
              onChange={(event) => setUsername(event.currentTarget.value)}
            />
            {invite.error ? <Alert color='red'>{invite.error.message}</Alert> : null}
            <Button disabled={!username.trim()} loading={invite.isPending} type='submit'>
              Send invitation
            </Button>
          </Stack>
        </form>
      </Modal>
    </>
  )
}
