import { Button, Group, List, Modal, Stack, Text } from '@mantine/core'
import * as styles from './characterBuilderSave.css'

export function CharacterDraftSaveNoticeModal({
  inactiveAbilityMethodLabels,
  opened,
  onClose,
  onConfirm
}: {
  inactiveAbilityMethodLabels: string[]
  opened: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Modal
      opened={opened}
      title='Save Character Draft'
      size='lg'
      closeButtonProps={{
        'aria-label': 'Close draft save notice',
        className: styles.modalCloseButton
      }}
      onClose={onClose}
    >
      <Stack gap='md'>
        <Text>
          This draft contains ability-generation work from another method. Saving keeps that
          inactive work recoverable, but only the currently selected ability method is used for
          review and finalization.
        </Text>
        <List spacing='xs'>
          {inactiveAbilityMethodLabels.map((label) => (
            <List.Item key={label}>{label}</List.Item>
          ))}
        </List>
        <Group justify='flex-end'>
          <Button
            className={styles.modalActionButton}
            type='button'
            variant='default'
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button className={styles.modalActionButton} type='button' onClick={onConfirm}>
            Save Draft
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
