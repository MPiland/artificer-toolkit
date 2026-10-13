import { Alert, Button, Group, Text } from '@mantine/core'
import type { DraftFields, ServerDraft } from './useServerDraft'

function formatLatest(value: string | number | boolean) {
  if (typeof value === 'boolean') return value ? 'on' : 'off'
  return value === '' ? 'empty' : String(value)
}

/** One notice per edited field the server changed underneath the user's edit. */
export function ServerDraftConflicts<T extends DraftFields>({
  draft,
  labels
}: {
  draft: ServerDraft<T>
  labels: Record<keyof T & string, string>
}) {
  return (
    <>
      {draft.conflicts.map((key) => (
        <Alert color='yellow' key={key}>
          <Group gap='xs' justify='space-between' wrap='wrap'>
            <Text size='sm'>
              {`${labels[key]} changed to ${formatLatest(draft.server[key])} elsewhere. Your edit is kept.`}
            </Text>
            <Group gap='xs'>
              <Button size='compact-sm' variant='light' onClick={() => draft.acceptLatest(key)}>
                Use latest
              </Button>
              <Button size='compact-sm' variant='default' onClick={() => draft.keepMine(key)}>
                Keep mine
              </Button>
            </Group>
          </Group>
        </Alert>
      ))}
    </>
  )
}
