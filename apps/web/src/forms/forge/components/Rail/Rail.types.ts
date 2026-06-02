import type { ReactNode } from 'react'

export type ItemIcon =
  | 'book'
  | 'bolt'
  | 'check'
  | 'flame'
  | 'gear'
  | 'spark'
  | 'trend'

export type ItemStatus = 'complete' | 'dirty' | 'warning' | 'error' | 'empty'

export type ItemTone = 'default' | 'muted'

export type Item = {
  children?: readonly Item[]
  description?: string
  expanded?: boolean
  icon?: ItemIcon
  id: string
  isActive?: boolean
  label: string
  level?: 0 | 1 | 2 | 3
  status?: ItemStatus
  tone?: ItemTone
}

export type Summary = {
  label: string
  status: ItemStatus
  value: string
}

export type RailProps = {
  'aria-label'?: string
  children?: ReactNode
  className?: string
  items?: readonly Item[]
  subtitle?: string
  summaries?: readonly Summary[]
  title?: string
}
