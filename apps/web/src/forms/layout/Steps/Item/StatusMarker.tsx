import { ItemStatus } from './Item.types'
import * as styles from './Item.css'
import { AlertTriangle, Circle, GitBranch, CheckCircle2 } from 'lucide-react'
import clsx from 'clsx'

export function StatusMarker({ status }: { status: ItemStatus }) {
  const label = statusLabel(status)
  const className = clsx(styles.statusMarker, styles.statusClass[status])

  return (
    <span className={className} aria-label={label} title={label}>
      {statusIcon(status)}
    </span>
  )
}

function statusLabel(status: ItemStatus) {
  switch (status) {
    case 'complete':
      return 'Complete'
    case 'dirty':
      return 'Unsaved changes'
    case 'incomplete':
      return 'Incomplete'
    case 'warning':
      return 'Needs review'
    case 'error':
      return 'Has errors'
    case 'empty':
    default:
      return 'Not started'
  }
}

function statusIcon(status: ItemStatus) {
  const size = 13

  switch (status) {
    case 'complete':
      return <CheckCircle2 size={size} />
    case 'dirty':
      return <GitBranch size={size} />
    case 'incomplete':
      return <AlertTriangle size={size} />
    case 'warning':
    case 'error':
      return <AlertTriangle size={size} />
    case 'empty':
    default:
      return <Circle size={size} />
  }
}
