import { ActionIcon, Button, Group, Paper, Stack, Text } from '@mantine/core'
import type { AnyFieldApi } from '@tanstack/react-form'
import ITrash from '#assets/icons/ITrash'
import { nestedShell } from './runtimeStyles.css.ts'

export function NestedObjectShell({ label, readOnly }: { label: string, readOnly?: boolean }) {
  return (
    <Paper className={nestedShell}>
      <Text fw={600}>{label}</Text>
      <Text c='dimmed' size='sm'>
        Nested object fields render here during domain rollout.
      </Text>
      {readOnly ? <Text size='sm'>This section is read only.</Text> : null}
    </Paper>
  )
}

export function NestedCollectionShell({
  field,
  label,
  readOnly,
  createItem = () => ({})
}: {
  field: AnyFieldApi
  label: string
  readOnly?: boolean
  createItem?: () => unknown
}) {
  const items = Array.isArray(field.state.value) ? field.state.value : []

  return (
    <Stack className={nestedShell}>
      <Group justify='space-between'>
        <Text fw={600}>{label}</Text>
        <Button size='xs' disabled={readOnly} onClick={() => field.pushValue(createItem())}>
          Add
        </Button>
      </Group>
      {items.length === 0
        ? (
            <Text c='dimmed' size='sm'>No items yet.</Text>
          )
        : items.map((_, index) => (
            <Group key={index} justify='space-between'>
              <Text size='sm'>{`${label} ${index + 1}`}</Text>
              <ActionIcon
                aria-label={`Remove ${label} ${index + 1}`}
                variant='subtle'
                color='red'
                disabled={readOnly}
                onClick={() => field.removeValue(index)}
              >
                <ITrash size={16} />
              </ActionIcon>
            </Group>
          ))}
    </Stack>
  )
}
