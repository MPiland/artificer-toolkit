import { Button, Group, Modal, Stack, Text } from '@mantine/core'

type AuthoringLeaveConfirmationProps = {
  opened: boolean
  onStay: () => void
  onLeave: () => void
}

export function AuthoringLeaveConfirmation({
  opened,
  onStay,
  onLeave
}: AuthoringLeaveConfirmationProps) {
  return (
    <Modal
      centered
      closeOnClickOutside={false}
      onClose={onStay}
      opened={opened}
      title='Leave without saving?'
    >
      <Stack gap='md'>
        <Text size='sm'>
          Your unsaved changes will be discarded if you leave this authoring workspace.
        </Text>
        <Group justify='flex-end'>
          <Button type='button' variant='default' onClick={onStay}>
            Stay
          </Button>
          <Button color='red' type='button' onClick={onLeave}>
            Leave without saving
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
