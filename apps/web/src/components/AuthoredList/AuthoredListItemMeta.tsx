import clsx from 'clsx'
import type { CSSProperties } from 'react'
import type { AuthoredListItem } from './AuthoredList.types'
import {
  hasAuthoredListAccent,
  hasAuthoredListBadges,
  hasAuthoredListStatus
} from './authoredList.utils'
import * as styles from './AuthoredListItemMeta.css'

export function AuthoredListAccentDot({
  item,
  className
}: {
  item: AuthoredListItem
  className?: string
}) {
  if (!hasAuthoredListAccent(item)) {
    return null
  }

  const style = { '--authored-list-accent': item.accentColor } as CSSProperties

  return (
    <span
      aria-hidden='true'
      className={clsx(styles.sourceDot, className)}
      style={style}
      title={item.accentLabel}
    />
  )
}

export function AuthoredListBadges({ item }: { item: AuthoredListItem }) {
  if (!hasAuthoredListBadges(item)) {
    return null
  }

  return (
    <span className={styles.chipGroup}>
      {item.badges.slice(0, 4).map((badge) => (
        <span key={badge} className={styles.classChip}>
          {badge}
        </span>
      ))}
    </span>
  )
}

export function AuthoredListStatusChip({ item }: { item: AuthoredListItem }) {
  if (!hasAuthoredListStatus(item)) {
    return null
  }

  return (
    <span
      className={`${styles.statusChip} ${item.statusTone === 'draft' ? styles.statusChipDraft : ''}`}
    >
      {item.statusLabel}
    </span>
  )
}
