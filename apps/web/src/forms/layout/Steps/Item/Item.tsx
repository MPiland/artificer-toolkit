import { useDisclosure } from '@mantine/hooks'
import { useEffect, type CSSProperties } from 'react'
import type { ItemIcon, ItemProps } from './Item.types'
import { Collapse, UnstyledButton } from '@mantine/core'
import * as styles from './Item.css'
import { Rail } from '#ui'
import clsx from 'clsx'
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Flame,
  Settings2,
  Sparkles,
  TrendingUp,
  Zap
} from 'lucide-react'
import { StatusMarker } from './StatusMarker'

function Icon({ icon = 'book' }: { icon?: ItemIcon }) {
  const size = 15

  switch (icon) {
    case 'bolt':
      return <Zap size={size} />
    case 'check':
      return <CheckCircle2 size={size} />
    case 'flame':
      return <Flame size={size} />
    case 'gear':
      return <Settings2 size={size} />
    case 'spark':
      return <Sparkles size={size} />
    case 'trend':
      return <TrendingUp size={size} />
    case 'book':
    default:
      return <BookOpen size={size} />
  }
}

export function Item({ item }: { item: ItemProps }) {
  const [expanded, { open, toggle }] = useDisclosure(item.expanded ?? true)
  const children = item.children ?? []
  const hasChildren = children.length > 0
  const canSelect = Boolean(item.onSelect || hasChildren)

  const handleSelect = () => {
    item.onSelect?.()
    if (hasChildren) toggle()
  }

  useEffect(() => {
    if (item.expanded) open()
  }, [item.expanded, open])

  return (
    <Rail.Item>
      <UnstyledButton
        className={clsx(
          styles.itemRow,
          { ['active']: item.isActive },
          item.tone === 'muted' && styles.itemRowMuted
        )}
        style={{ '--authoring-rail-level': item.level ?? 0 } as CSSProperties}
        aria-current={item.isActive ? 'step' : undefined}
        onClick={canSelect ? handleSelect : undefined}
      >
        <span className={styles.expander} aria-hidden='true'>
          {hasChildren ? (
            expanded ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )
          ) : null}
        </span>
        <span className={styles.itemIcon} aria-hidden='true'>
          <Icon icon={item.icon} />
        </span>
        <span className={styles.itemText}>
          <span className={styles.itemLabel}>{item.label}</span>
        </span>
        <StatusMarker status={item.status ?? 'empty'} />
      </UnstyledButton>
      {hasChildren ? (
        <Collapse
          expanded={expanded}
          keepMounted
          transitionDuration={140}
          transitionTimingFunction='cubic-bezier(0.2, 0, 0, 1)'
        >
          {children.map((child) => (
            <Item key={child.id} item={child} />
          ))}
        </Collapse>
      ) : null}
    </Rail.Item>
  )
}
