import { ActionIcon, Group, Menu, Tooltip } from '@mantine/core'
import type { ReactNode } from 'react'
import ICopy from '#assets/icons/ICopy'
import IEdit from '#assets/icons/IEdit'
import IMore from '#assets/icons/IMore'
import ITrash from '#assets/icons/ITrash'
import type { AuthoredListItem } from './AuthoredList.types'
import * as styles from './AuthoredListActions.css'

export interface AuthoredListActionHandlers {
  onEdit?: (item: AuthoredListItem) => void
  onCopy?: (item: AuthoredListItem) => void
  onDelete?: (item: AuthoredListItem) => void
}

interface AuthoredListAction {
  label: string
  icon: ReactNode
  tone?: 'copy' | 'danger'
  onSelect: () => void
}

export function AuthoredListActions({
  item,
  actionHandlers,
  itemName,
  menu = false
}: {
  item: AuthoredListItem
  actionHandlers: AuthoredListActionHandlers
  itemName: string
  menu?: boolean
}) {
  const actions = getAvailableActions(item, actionHandlers)

  if (actions.length === 0) {
    return null
  }

  if (menu) {
    return (
      <Menu position='bottom-end' width={180}>
        <Menu.Target>
          <ActionIcon
            aria-label={`More actions for ${item.name}`}
            className={styles.moreActionButton}
            variant='default'
          >
            <IMore size={20} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          {actions.map((action) => (
            <Menu.Item
              key={action.label}
              className={getActionMenuItemClassName(action)}
              leftSection={action.icon}
              onClick={action.onSelect}
            >
              {action.label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    )
  }

  return (
    <Group gap='xs' justify='flex-start'>
      {actions.map((action) => (
        <Tooltip key={action.label} label={`${action.label} ${itemName}`} withArrow>
          <ActionIcon
            aria-label={`${action.label} ${itemName}`}
            className={getActionButtonClassName(action)}
            variant='default'
            onClick={(event) => {
              event.stopPropagation()
              action.onSelect()
            }}
          >
            {action.icon}
          </ActionIcon>
        </Tooltip>
      ))}
    </Group>
  )
}

function getAvailableActions(item: AuthoredListItem, actionHandlers: AuthoredListActionHandlers) {
  const actions: AuthoredListAction[] = []

  if (item.permissions.canEdit && actionHandlers.onEdit) {
    actions.push({
      label: 'Edit',
      icon: <IEdit size={17} />,
      onSelect: () => actionHandlers.onEdit?.(item)
    })
  }

  if (item.permissions.canCopy && actionHandlers.onCopy) {
    actions.push({
      label: 'Duplicate',
      icon: <ICopy size={17} />,
      tone: 'copy',
      onSelect: () => actionHandlers.onCopy?.(item)
    })
  }

  if (item.permissions.canDelete && actionHandlers.onDelete) {
    actions.push({
      label: 'Delete',
      icon: <ITrash size={17} />,
      tone: 'danger',
      onSelect: () => actionHandlers.onDelete?.(item)
    })
  }

  return actions
}

function getActionButtonClassName(action: AuthoredListAction): string {
  return [
    styles.rowActionButton,
    action.tone === 'copy' ? styles.copyActionButton : '',
    action.tone === 'danger' ? styles.dangerActionButton : ''
  ]
    .filter(Boolean)
    .join(' ')
}

function getActionMenuItemClassName(action: AuthoredListAction): string | undefined {
  if (action.tone === 'copy') return styles.copyMenuItem
  if (action.tone === 'danger') return styles.dangerMenuItem
  return undefined
}
