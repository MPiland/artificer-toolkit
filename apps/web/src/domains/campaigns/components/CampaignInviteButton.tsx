import { Alert, Button, Modal, Select, Stack, Text, TextInput } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useMutation } from '@tanstack/react-query'
import { type SubmitEvent, useState } from 'react'
import type { CampaignDetailDto, CampaignInviteDto } from '#app/lib/api'
import { api } from '#app/lib/api'
import * as sharedStyles from '../campaigns.css'

export function CampaignInviteButton({ campaign }: { campaign: CampaignDetailDto }) {
  const [opened, { close, open }] = useDisclosure(false)
  const [inviteKind, setInviteKind] = useState<'LINK' | 'USERNAME' | 'EMAIL'>('LINK')
  const [inviteTarget, setInviteTarget] = useState('')
  const [createdInvite, setCreatedInvite] = useState<CampaignInviteDto | null>(null)
  const invite = useMutation({
    mutationFn: () =>
      api.campaigns.invites.create({
        campaignId: campaign.id,
        kind: inviteKind,
        target: inviteKind === 'LINK' ? undefined : inviteTarget
      }),
    onSuccess: (result) => {
      setCreatedInvite(result)
      setInviteTarget('')
    }
  })

  function closeModal() {
    setCreatedInvite(null)
    setInviteTarget('')
    close()
  }

  function copyInviteLink(token: string) {
    const inviteUrl = new URL(
      `/campaigns/invite/${encodeURIComponent(token)}`,
      window.location.origin
    ).toString()
    void navigator.clipboard.writeText(inviteUrl)
    notifications.show({ message: 'Invite link copied.' })
  }

  return (
    <>
      <Button onClick={open}>Invite player</Button>
      <Modal centered opened={opened} title='Invite a player' onClose={closeModal}>
        <Stack gap='md'>
          <Text c='dimmed' size='sm'>
            Create a link or send an invite to a specific player.
          </Text>
          <form
            className={sharedStyles.form}
            onSubmit={(event: SubmitEvent) => {
              event.preventDefault()
              invite.mutate()
            }}
          >
            <Select
              classNames={{ input: sharedStyles.input }}
              data={[
                { value: 'LINK', label: 'Invite link' },
                { value: 'USERNAME', label: '@username' },
                { value: 'EMAIL', label: 'Email' }
              ]}
              label='Invite type'
              value={inviteKind}
              onChange={(value) => setInviteKind((value as typeof inviteKind) ?? 'LINK')}
            />
            {inviteKind !== 'LINK' ? (
              <TextInput
                classNames={{ input: sharedStyles.input }}
                label={inviteKind === 'USERNAME' ? 'Username' : 'Email'}
                required
                value={inviteTarget}
                onChange={(event) => setInviteTarget(event.currentTarget.value)}
              />
            ) : null}
            {invite.error ? <Alert color='red'>{invite.error.message}</Alert> : null}
            <Button loading={invite.isPending} type='submit'>
              Create invite
            </Button>
          </form>
          {createdInvite ? (
            <Alert title='Invite created'>
              <Text size='sm'>Share this link with the player you want to invite.</Text>
              <Button
                mt='xs'
                size='xs'
                variant='default'
                onClick={() => copyInviteLink(createdInvite.token)}
              >
                Copy invite link
              </Button>
            </Alert>
          ) : null}
        </Stack>
      </Modal>
    </>
  )
}
