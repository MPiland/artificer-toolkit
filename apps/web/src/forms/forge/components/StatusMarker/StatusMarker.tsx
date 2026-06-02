import clsx from 'clsx'
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  GitBranch
} from 'lucide-react'
import type { ItemStatus } from '../Rail/Rail.types'
import * as styles from './StatusMarker.css'

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
    case 'warning':
    case 'error':
      return <AlertTriangle size={size} />
    case 'empty':
    default:
      return <Circle size={size} />
  }
}
