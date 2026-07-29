import { Menu, UnstyledButton } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import clsx from 'clsx'
import { MobileAppFooterIcon } from './MobileAppFooterIcon'
import type { MobileAppFooterItem, MobileAppFooterProps } from './MobileAppFooter.types'
import * as styles from './MobileAppFooter.css'

export function MobileAppFooter({
  'aria-label': ariaLabel = 'App navigation',
  className,
  items
}: MobileAppFooterProps) {
  return (
    <footer aria-label={ariaLabel} className={clsx(styles.root, className)}>
      {items.map((item) => (
        <MobileFooterItem key={item.id} item={item} />
      ))}
    </footer>
  )
}

function MobileFooterItem({ item }: { item: MobileAppFooterItem }) {
  const control = (
    <UnstyledButton
      className={clsx(styles.item, item.isActive && styles.itemActive)}
      type='button'
      aria-label={item.label}
      aria-current={item.isActive ? 'page' : undefined}
      onClick={item.menuItems?.length || item.menuContent ? undefined : item.onClick}
    >
      <MobileAppFooterIcon icon={item.icon} />
      <span className={styles.label}>{item.label}</span>
    </UnstyledButton>
  )

  if (!item.menuItems?.length && !item.menuContent) return control

  return (
    <Menu position='top' width={230} withinPortal>
      <Menu.Target>{control}</Menu.Target>
      <Menu.Dropdown>
        {item.menuContent ??
          item.menuItems?.map((menuItem) => (
            <Menu.Item
              key={menuItem.id}
              component={Link}
              to={menuItem.href}
              aria-current={menuItem.isActive ? 'page' : undefined}
            >
              <span className={styles.menuItemText}>
                <span>{menuItem.label}</span>
              </span>
            </Menu.Item>
          ))}
      </Menu.Dropdown>
    </Menu>
  )
}
