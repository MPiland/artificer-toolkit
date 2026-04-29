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
  description?: string
  attributes?: Record<string, string | undefined>
  badges?: string[]
  searchText?: string
  filterValues?: Record<string, string | string[] | undefined>
  sortValues?: Record<string, string | number | undefined>
  sourceLabel: string
  sourceKind: AuthoredListProvenance
  permissions: AuthoredListPermissions
}

export interface AuthoredListFilter {
  key: string
  label: string
  placeholder: string
  options: Array<{ value: string, label: string }>
}

export interface AuthoredListAttributeColumn {
  key: string
  label: string
  fallback?: string
}

export interface AuthoredListSortOption {
  value: string
  label: string
}

export interface AuthoredListPageProps {
  title: string
  summary: string
  createLabel: string
  items: AuthoredListItem[]
  filters: AuthoredListFilter[]
  attributeColumns?: AuthoredListAttributeColumn[]
  sortOptions?: AuthoredListSortOption[]
  defaultSort?: string
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
