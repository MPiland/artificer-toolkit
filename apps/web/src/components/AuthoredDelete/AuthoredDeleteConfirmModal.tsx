import { Button, Group, Modal, Stack, Text } from '@mantine/core'
import type { AuthoredDeleteTarget } from './AuthoredDelete.types'

export function AuthoredDeleteConfirmModal({
  domainLabel,
  isDeleting,
  onClose,
  onConfirm,
  target
}: {
  domainLabel: string
  isDeleting: boolean
  onClose: () => void
  onConfirm: () => void
  target: AuthoredDeleteTarget | null
}) {
  const lowerDomain = domainLabel.toLowerCase()
  const body = target?.kind === 'draft'
    ? `Delete the draft for ${target.label}? The active ${lowerDomain} will stay unchanged if one exists.`
    : target
      ? `Delete ${target.label}? Any draft for this ${lowerDomain} will stay available.`
      : ''

  return (
    <Modal
      centered
      opened={Boolean(target)}
      title={target ? `Delete ${target.label}` : 'Delete item'}
      onClose={onClose}
    >
      <Stack gap='md'>
        <Text size='sm'>{body}</Text>
        <Group justify='flex-end'>
          <Button disabled={isDeleting} type='button' variant='default' onClick={onClose}>
            Cancel
          </Button>
          <Button color='red' loading={isDeleting} type='button' onClick={onConfirm}>
            Delete
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
