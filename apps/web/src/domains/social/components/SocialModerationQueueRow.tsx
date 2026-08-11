import { Badge, Button, Group, Text, Title } from '@mantine/core'
import type { SocialModerationQueueItemDto } from '#app/lib/api'
import { formatStatusLabel } from '../socialModels'
import * as styles from './SocialModerationQueueRow.css'

export function SocialModerationQueueRow({
  item,
  isOpening,
  onOpen
}: {
  item: SocialModerationQueueItemDto
  isOpening: boolean
  onOpen: () => void
}) {
  return (
    <article className={styles.row}>
      <div className={styles.rowBody}>
        <Group gap='xs'>
          <Badge variant='light'>{formatStatusLabel(item.targetKind)}</Badge>
          <Badge variant='outline'>{formatStatusLabel(item.status)}</Badge>
        </Group>
        <Title order={2} size='h4'>
          {formatStatusLabel(item.reason)}
        </Title>
        <Text c='dimmed' size='sm'>
          Submitted{' '}
          {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
            new Date(item.createdAt)
          )}
        </Text>
      </div>
      <div className={styles.rowActions}>
        <Button loading={isOpening} size='xs' onClick={onOpen}>
          Open report
        </Button>
      </div>
    </article>
  )
}
