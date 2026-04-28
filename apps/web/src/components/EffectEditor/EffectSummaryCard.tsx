import { ActionIcon, Group, Stack, Text, Tooltip } from '@mantine/core'
import type { EffectDto } from '@artificer-toolkit/schema'
import IEdit from '#assets/icons/IEdit'
import { IExternalLink } from '#assets/icons/IExternalLink'
import ITrash from '#assets/icons/ITrash'
import { actionIcon, destructiveActionIcon, effectCard, effectCardHeader } from './EffectEditor.css'
import { formatEffectSummary } from './effectEditor.utils'

export function EffectSummaryCard({
  effect,
  index,
  readOnly,
  onEdit,
  onRemove
}: {
  effect: EffectDto
  index: number
  readOnly?: boolean
  onEdit: () => void
  onRemove: () => void
}) {
  return (
    <article className={effectCard}>
      <div className={effectCardHeader}>
        <Stack gap={2}>
          <Text fw={700}>{`Effect ${index + 1}`}</Text>
          <Text c='dimmed' size='sm'>{formatEffectSummary(effect)}</Text>
        </Stack>
        <Group gap='xs'>
          <Tooltip label={readOnly ? 'View effect' : 'Edit effect'}>
            <ActionIcon
              aria-label={`${readOnly ? 'View' : 'Edit'} effect ${index + 1}`}
              className={actionIcon}
              variant='subtle'
              onClick={onEdit}
            >
              {readOnly ? <IExternalLink size={18} /> : <IEdit size={18} />}
            </ActionIcon>
          </Tooltip>
          {!readOnly
            ? (
                <Tooltip label='Remove effect'>
                  <ActionIcon
                    aria-label={`Remove effect ${index + 1}`}
                    className={destructiveActionIcon}
                    variant='subtle'
                    onClick={onRemove}
                  >
                    <ITrash size={18} />
                  </ActionIcon>
                </Tooltip>
              )
            : null}
        </Group>
      </div>
    </article>
  )
}
