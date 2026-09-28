import { Alert, Button, Group, Loader, Stack, Text } from '@mantine/core'
import type { ContentSnapshotKind } from '@artificer-toolkit/schema/api/contentSnapshots'
import type { CharacterBuilderContentStatus } from '../state/useCharacterBuilderEvaluation'

const KIND_LABELS: Record<ContentSnapshotKind, string> = {
  BACKGROUND: 'backgrounds',
  CLASS: 'classes',
  CREATURE: 'creatures',
  EQUIPMENT: 'equipment',
  FEAT: 'feats',
  RACE: 'races',
  SPELL: 'spells',
  VEHICLE: 'vehicles'
}

const listFormat = new Intl.ListFormat('en', { type: 'conjunction' })

/**
 * The Builder's content state while it evaluates in the browser: content still loading, a scope
 * still rebuilding after a publish, or content that failed to load (with a retry).
 */
export function CharacterBuilderContentNotice({
  status,
  onRetry
}: {
  status: CharacterBuilderContentStatus
  onRetry: () => void
}) {
  const failed = status.failedKind !== undefined
  const loading = status.preparing || status.loadingKinds.length > 0
  if (!failed && !loading && !status.updating) return null

  return (
    <Stack gap='xs'>
      {failed ? (
        <Alert color='red' variant='light'>
          <Group justify='space-between' gap='sm'>
            <Text size='sm'>
              {status.failedKind
                ? `Could not load ${KIND_LABELS[status.failedKind]}. Your choices are not updated yet.`
                : 'Could not update your choices from the latest content.'}
            </Text>
            <Button size='xs' variant='light' color='red' onClick={onRetry}>
              Try again
            </Button>
          </Group>
        </Alert>
      ) : null}
      {!failed && loading ? (
        <Group gap='xs' role='status'>
          <Loader size='xs' />
          <Text size='sm' c='dimmed'>
            {status.loadingKinds.length > 0
              ? `Loading ${listFormat.format(status.loadingKinds.map((kind) => KIND_LABELS[kind]))}…`
              : 'Preparing content…'}
          </Text>
        </Group>
      ) : null}
      {status.updating ? (
        <Text size='sm' c='dimmed' role='status'>
          Content was just published and is still updating. Your choices may change when it
          finishes.
        </Text>
      ) : null}
    </Stack>
  )
}
