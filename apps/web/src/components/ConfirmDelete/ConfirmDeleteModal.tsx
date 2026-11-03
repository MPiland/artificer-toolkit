import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core'

export function ConfirmDeleteModal({
  body,
  confirmLabel,
  errorMessage,
  isDeleting,
  opened,
  title,
  onClose,
  onConfirm
}: {
  body: string
  confirmLabel: string
  errorMessage: string | null
  isDeleting: boolean
  opened: boolean
  title: string
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Modal centered opened={opened} title={title} onClose={isDeleting ? () => undefined : onClose}>
      <Stack gap='md'>
        <Text>{body}</Text>
        {errorMessage ? <Alert color='red'>{errorMessage}</Alert> : null}
        <Group justify='flex-end'>
          <Button disabled={isDeleting} type='button' variant='default' onClick={onClose}>
            Keep it
          </Button>
          <Button color='red' loading={isDeleting} type='button' onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
