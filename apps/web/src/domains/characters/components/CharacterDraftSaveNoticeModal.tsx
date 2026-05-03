import { Button, Group, List, Modal, Stack, Text } from '@mantine/core'

export function CharacterDraftSaveNoticeModal({
  inactiveAbilityMethodLabels,
  isSaving,
  opened,
  onClose,
  onConfirm
}: {
  inactiveAbilityMethodLabels: string[]
  isSaving: boolean
  opened: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Modal
      opened={opened}
      title='Save Character Draft'
      size='lg'
      onClose={onClose}
    >
      <Stack gap='md'>
        <Text>
          This draft contains ability-generation work from another method. Saving keeps that inactive work recoverable,
          but only the currently selected ability method is used for review and finalization.
        </Text>
        <List spacing='xs'>
          {inactiveAbilityMethodLabels.map((label) => <List.Item key={label}>{label}</List.Item>)}
        </List>
        <Group justify='flex-end'>
          <Button type='button' variant='default' onClick={onClose}>Cancel</Button>
          <Button type='button' loading={isSaving} onClick={onConfirm}>Save Draft</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
