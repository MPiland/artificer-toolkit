import type { ReactNode } from 'react'

export type AuthoredListProvenance = 'master' | 'owned'
export type AuthoredListViewMode = 'table' | 'cards'

export interface AuthoredListPermissions {
  canView: boolean
  canEdit: boolean
  canCopy: boolean
  canDelete: boolean
}

export interface AuthoredListItem {
  id: string
  name: string
  level?: string
  school?: string
  castingTime?: string
  classes?: string[]
  sourceLabel: string
  sourceKind: AuthoredListProvenance
  permissions: AuthoredListPermissions
}

export interface AuthoredListFilter {
  key: 'school' | 'level' | 'class'
  label: string
  placeholder: string
  options: Array<{ value: string, label: string }>
}

export interface AuthoredListPageProps {
  title: string
  summary: string
  createLabel: string
  items: AuthoredListItem[]
  filters: AuthoredListFilter[]
  emptyState?: ReactNode
  error?: string
  loading?: boolean
  initialViewMode?: AuthoredListViewMode
  onCreate?: () => void
  onView?: (item: AuthoredListItem) => void
  onEdit?: (item: AuthoredListItem) => void
  onCopy?: (item: AuthoredListItem) => void
  onDelete?: (item: AuthoredListItem) => void
}
