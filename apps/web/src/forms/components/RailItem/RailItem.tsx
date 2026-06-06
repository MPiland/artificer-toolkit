import { Collapse, UnstyledButton } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
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
import type { Item, ItemIcon } from '../Rail/Rail.types'
import { StatusMarker } from '../StatusMarker/StatusMarker'
import * as styles from './RailItem.css'

export function RailItem({ item }: { item: Item }) {
  const [expanded, { toggle }] = useDisclosure(true)
  const children = item.children ?? []
  const hasChildren = children.length > 0
  const canSelect = Boolean(item.onSelect || hasChildren)

  const handleSelect = () => {
    item.onSelect?.()
    if (hasChildren) toggle()
  }

  return (
    <div className={styles.itemBlock}>
      <UnstyledButton
        className={clsx(
          styles.itemRow,
          styles.levelClass[item.level ?? 0],
          { ['active']: item.isActive },
          item.tone === 'muted' && styles.itemRowMuted
        )}
        aria-current={item.isActive ? 'step' : undefined}
        onClick={canSelect ? handleSelect : undefined}
      >
        <span className={styles.expander} aria-hidden='true'>
          {hasChildren ? (
            item.expanded ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )
          ) : null}
        </span>
        <span className={styles.itemIcon} aria-hidden='true'>
          <RailIcon icon={item.icon} />
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
            <RailItem key={child.id} item={child} />
          ))}
        </Collapse>
      ) : null}
    </div>
  )
}

function RailIcon({ icon = 'book' }: { icon?: ItemIcon }) {
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
