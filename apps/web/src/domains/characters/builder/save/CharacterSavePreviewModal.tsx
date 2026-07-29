import { Button, Group, List, Modal, Stack, Text } from '@mantine/core'
import type { CharacterBuilderPreviewPayloadDto } from '@artificer-toolkit/schema/api/characters'
import * as sharedStyles from '../shared/builderShared.css'
import * as styles from './characterBuilderSave.css'

export function CharacterSavePreviewModal({
  isCommitting,
  opened,
  preview,
  onClose,
  onConfirm
}: {
  isCommitting: boolean
  opened: boolean
  preview: CharacterBuilderPreviewPayloadDto | null
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Modal
      opened={opened}
      title='Finalize Character'
      size='lg'
      closeButtonProps={{
        'aria-label': 'Close finalize preview',
        className: styles.modalCloseButton
      }}
      onClose={onClose}
    >
      <Stack gap='md'>
        <Text>
          Finalizing writes the normalized character record. The existing active version stays
          unchanged unless this commit succeeds.
        </Text>
        {preview?.preview.summaryLines.length ? (
          <List spacing='xs'>
            {preview.preview.summaryLines.map((line) => (
              <List.Item key={line}>{line}</List.Item>
            ))}
          </List>
        ) : (
          <Text className={sharedStyles.mutedText}>No destructive changes were predicted.</Text>
        )}
        <Group justify='flex-end'>
          <Button
            className={styles.modalActionButton}
            type='button'
            variant='default'
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className={styles.modalActionButton}
            type='button'
            loading={isCommitting}
            onClick={onConfirm}
          >
            Finalize
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
