import { useDisclosure } from '@mantine/hooks'
import { useEffect, type CSSProperties } from 'react'
import type { ItemIcon, ItemProps } from './Item.types'
import { Collapse, UnstyledButton } from '@mantine/core'
import * as styles from './Item.css'
import { Rail } from '#ui'
import clsx from 'clsx'
import {
  BookOpen,
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  Flame,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Sword,
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
    case 'cube':
      return <Box size={size} />
    case 'flame':
      return <Flame size={size} />
    case 'eye':
      return <Eye size={size} />
    case 'gear':
      return <Settings2 size={size} />
    case 'spark':
      return <Sparkles size={size} />
    case 'sliders':
      return <SlidersHorizontal size={size} />
    case 'sword':
      return <Sword size={size} />
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
  const canSelect = Boolean(item.navigationTargetId || item.onSelect)
  const childGroupId = `authoring-rail-children-${item.id}`

  const handleSelect = () => {
    if (hasChildren) open()
    item.onSelect?.()
  }

  useEffect(() => {
    if (item.expanded) open()
  }, [item.expanded, open])

  const rowClassName = clsx(
    styles.itemRow,
    { ['active']: item.isActive },
    item.tone === 'muted' && styles.itemRowMuted
  )
  const rowStyle = { '--authoring-rail-level': item.level ?? 0 } as CSSProperties

  return (
    <Rail.Item>
      <div className={rowClassName} data-level={item.level ?? 0} style={rowStyle}>
        {hasChildren ? (
          <UnstyledButton
            aria-controls={childGroupId}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.label}`}
            className={styles.expander}
            onClick={toggle}
            type='button'
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </UnstyledButton>
        ) : (
          <span className={styles.expanderPlaceholder} aria-hidden='true' />
        )}
        {(item.level ?? 0) > 0 ? (
          <span className={styles.itemIcon} aria-hidden='true'>
            <Icon icon={item.icon} />
          </span>
        ) : null}
        {item.navigationTargetId && item.navigationHref ? (
          <UnstyledButton
            component='a'
            href={item.navigationHref}
            className={styles.itemTarget}
            aria-current={item.isActive ? 'step' : undefined}
            onClick={(event) => {
              if (
                event.button !== 0 ||
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return
              }
              event.preventDefault()
              handleSelect()
            }}
          >
            <span className={styles.itemText}>
              <span className={styles.itemLabel}>{item.label}</span>
            </span>
          </UnstyledButton>
        ) : canSelect ? (
          <UnstyledButton className={styles.itemTarget} onClick={handleSelect} type='button'>
            <span className={styles.itemText}>
              <span className={styles.itemLabel}>{item.label}</span>
            </span>
          </UnstyledButton>
        ) : hasChildren ? (
          <UnstyledButton className={styles.itemTarget} onClick={toggle} type='button'>
            <span className={styles.itemText}>
              <span className={styles.itemLabel}>{item.label}</span>
            </span>
          </UnstyledButton>
        ) : (
          <span className={styles.itemTarget}>
            <span className={styles.itemText}>
              <span className={styles.itemLabel}>{item.label}</span>
            </span>
          </span>
        )}
        <StatusMarker status={item.status ?? 'empty'} />
      </div>
      {hasChildren ? (
        <div id={childGroupId}>
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
        </div>
      ) : null}
    </Rail.Item>
  )
}
