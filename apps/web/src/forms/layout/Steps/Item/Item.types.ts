import { ReactNode } from 'react'

export type ItemIcon = 'book' | 'bolt' | 'check' | 'flame' | 'gear' | 'spark' | 'trend'

export type ItemStatus = 'complete' | 'dirty' | 'warning' | 'error' | 'incomplete' | 'empty'

export type ItemTone = 'default' | 'muted'

export type ItemProps = {
  children?: readonly ItemProps[]
  description?: string
  expanded?: boolean
  icon?: ItemIcon
  id: string
  isActive?: boolean
  label: string
  level?: 0 | 1 | 2 | 3
  onSelect?: () => void
  status?: ItemStatus
  tone?: ItemTone
}

export type StepsProps = {
  ariaLabel?: string
  ariaHidden?: boolean
  className?: string
  children: ReactNode
  onClose?: () => void
}
