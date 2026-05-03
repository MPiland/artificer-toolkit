import { Button, Group, List, Modal, Stack, Text } from '@mantine/core'
import type { CharacterBuilderPreviewPayloadDto } from '@artificer-toolkit/schema/api/characters'

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
      onClose={onClose}
    >
      <Stack gap='md'>
        <Text>
          Finalizing writes the normalized character record. The existing active version stays unchanged unless this
          commit succeeds.
        </Text>
        {preview?.preview.summaryLines.length
          ? (
              <List spacing='xs'>
                {preview.preview.summaryLines.map((line) => <List.Item key={line}>{line}</List.Item>)}
              </List>
            )
          : <Text c='dimmed'>No destructive changes were predicted.</Text>}
        <Group justify='flex-end'>
          <Button type='button' variant='default' onClick={onClose}>Cancel</Button>
          <Button type='button' loading={isCommitting} onClick={onConfirm}>Finalize</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
