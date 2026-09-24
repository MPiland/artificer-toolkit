import { Alert, Button, Modal, Stack, Textarea } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useMutation } from '@tanstack/react-query'
import { type SubmitEvent, useState } from 'react'
import type { SocialListingDto } from '@artificer-toolkit/schema/api/socialHub'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { useMutation as useConvexMutation } from 'convex/react'
import * as inputStyles from '#ui/primitives/Select/Select.css'

export function SocialApplicationDialog({
  listing
}: {
  listing: Pick<
    SocialListingDto,
    'listingPublicId' | 'version' | 'title' | 'status' | 'audience' | 'availableSeats'
  >
}) {
  const [opened, { close, open }] = useDisclosure(false)
  const [message, setMessage] = useState('')
  const submitApplication = useConvexMutation(convexApi.social.applications.submit)
  const application = useMutation({
    mutationFn: () =>
      submitApplication({
        listingPublicId: listing.listingPublicId,
        message,
        expectedListingVersion: listing.version
      }),
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'Application sent to the host.' })
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
