import { Button, Group, Modal, PasswordInput, Stack, Text, TextInput } from '@mantine/core'
import { useState } from 'react'
import { accountClient } from './accountClient'

export function DeleteAccountModal({
  email,
  onClose,
  opened
}: {
  email: string
  onClose: () => void
  opened: boolean
}) {
  const [confirmationEmail, setConfirmationEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const confirmationMatches = confirmationEmail.trim().toLowerCase() === email.toLowerCase()

  function handleClose() {
    if (isDeleting) return
    setConfirmationEmail('')
    setCurrentPassword('')
    setFeedback(null)
    onClose()
  }

  async function handleDelete() {
    if (!confirmationMatches || !currentPassword) return

    setIsDeleting(true)
    setFeedback(null)
    const result = await accountClient.deleteAccount({
      email: confirmationEmail,
      currentPassword
    })

    if (!result.ok) {
      setFeedback(result.message ?? 'Could not delete your account. Try again.')
      setIsDeleting(false)
      return
    }

    window.location.assign('/sign-in')
  }

  return (
    <Modal centered opened={opened} title='Delete account' onClose={handleClose}>
      <Stack gap='md'>
        <Text size='sm'>
          This permanently deletes your profile, homebrew, drafts, characters, and sheet data. This
          action cannot be undone.
        </Text>
        <Text size='sm'>
          Your Campaign contributions stay in the Campaign under &quot;Deleted user&quot;: chat,
          shared notes, and notes the GM can read.
        </Text>
        <TextInput
          autoComplete='email'
          error={
            confirmationEmail && !confirmationMatches
              ? 'Enter the email address for this account.'
              : undefined
          }
          label={`Type ${email} to confirm`}
          value={confirmationEmail}
          onChange={(event) => setConfirmationEmail(event.currentTarget.value)}
        />
        <PasswordInput
          autoComplete='current-password'
          label='Current password'
          name='currentPassword'
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.currentTarget.value)}
        />
        {feedback ? (
          <Text c='red' role='alert' size='sm'>
            {feedback}
          </Text>
        ) : null}
        <Group justify='flex-end'>
          <Button disabled={isDeleting} type='button' variant='default' onClick={handleClose}>
            Cancel
          </Button>
          <Button
            color='red'
            disabled={!confirmationMatches || !currentPassword}
            loading={isDeleting}
            type='button'
            onClick={() => void handleDelete()}
          >
            Permanently delete account
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
