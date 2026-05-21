import { ActionIcon, Text, Tooltip } from '@mantine/core'
import IEdit from '#assets/icons/IEdit'
import { IExternalLink } from '#assets/icons/IExternalLink'
import ITrash from '#assets/icons/ITrash'
import * as styles from '../layout/AuthoringFormSectionRow.css'

export function AuthoringFormSectionRow({
  description,
  index,
  readOnly,
  title,
  onOpen,
  onRemove
}: {
  description?: string
  index?: number
  readOnly: boolean
  title: string
  onOpen?: () => void
  onRemove?: () => void
}) {
  const itemLabel = index === undefined ? title : `${title} ${index + 1}`
  const actionLabel = `${readOnly ? 'View' : 'Edit'} ${itemLabel}`

  return (
    <div className={styles.row}>
      <div>
        <Text className={styles.rowTitle}>{itemLabel}</Text>
        {description
          ? <Text className={styles.rowDescription}>{description}</Text>
          : null}
      </div>
      <div className={styles.rowActions}>
        {onOpen
          ? (
              <Tooltip label={readOnly ? 'View' : 'Edit'} withArrow>
                <ActionIcon aria-label={actionLabel} variant='subtle' onClick={onOpen}>
                  {readOnly ? <IExternalLink size={16} /> : <IEdit size={16} />}
                </ActionIcon>
              </Tooltip>
            )
          : null}
        {!readOnly && onRemove
          ? (
              <Tooltip label='Remove' withArrow>
                <ActionIcon aria-label={`Remove ${itemLabel}`} color='red' variant='subtle' onClick={onRemove}>
                  <ITrash size={16} />
                </ActionIcon>
              </Tooltip>
            )
          : null}
      </div>
    </div>
  )
}
