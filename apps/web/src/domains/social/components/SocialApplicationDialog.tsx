import { Alert, Button, Modal, Stack, Textarea } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type SubmitEvent, useState } from 'react'
import type { SocialListingDto } from '#app/lib/api'
import { api } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import * as inputStyles from '#ui/primitives/Select/Select.css'

export function SocialApplicationDialog({ listing }: { listing: SocialListingDto }) {
  const queryClient = useQueryClient()
  const [opened, { close, open }] = useDisclosure(false)
  const [message, setMessage] = useState('')
  const application = useMutation({
    mutationFn: () =>
      api.socialHub.applications.submit({
        listingPublicId: listing.listingPublicId,
        message,
        expectedListingVersion: listing.version
      }),
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'Application sent to the host.' })
      void queryClient.invalidateQueries({ queryKey: queryKeys.socialHub.applicationsMine() })
      setMessage('')
      close()
    }
  })

  return (
    <>
      <Button
        disabled={
          listing.status !== 'OPEN' || listing.audience !== 'PUBLIC' || listing.availableSeats === 0
        }
        onClick={open}
      >
        {listing.availableSeats === 0 ? 'Table full' : 'Apply to join'}
      </Button>
      <Modal centered opened={opened} title={`Apply to ${listing.title}`} onClose={close}>
        <form
          onSubmit={(event: SubmitEvent) => {
            event.preventDefault()
            application.mutate()
          }}
        >
          <Stack>
            <Textarea
              autosize
              classNames={{
                root: inputStyles.root,
                label: inputStyles.label,
                description: inputStyles.description,
                required: inputStyles.required,
                input: inputStyles.input
              }}
              description='Tell the host why this table is a good fit. Only you and the host can read this.'
              label='Message to the host'
              maxLength={2000}
              minRows={5}
              name='message'
              required
              value={message}
              onChange={(event) => setMessage(event.currentTarget.value)}
            />
            {application.error ? <Alert color='red'>{application.error.message}</Alert> : null}
            <Button disabled={!message.trim()} loading={application.isPending} type='submit'>
              Send application
            </Button>
          </Stack>
        </form>
      </Modal>
    </>
  )
}
