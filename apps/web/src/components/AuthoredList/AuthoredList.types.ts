import type { ReactNode } from 'react'

export type AuthoredListProvenance = 'master' | 'owned'
export type AuthoredListViewMode = 'table' | 'cards'
export type AuthoredListAttributeValue = string | string[] | undefined
export type AuthoredListStatusTone = 'default' | 'draft'

export interface AuthoredListPermissions {
  canView: boolean
  canEdit: boolean
  canCopy: boolean
  canDelete: boolean
}

export interface AuthoredListItem {
  id: string
  publicId: string
  name: string
  description?: string
  contentState?: 'active' | 'draft'
  attributes?: Record<string, AuthoredListAttributeValue>
  badges?: string[]
  statusLabel?: string
  statusTone?: AuthoredListStatusTone
  searchText?: string
  filterValues?: Record<string, string | string[] | undefined>
  sortValues?: Record<string, string | number | undefined>
  accentColor?: string
  accentLabel?: string
  hierarchy?: {
    level: number
    parentId?: string
    parentLabel?: string
  }
  sourceLabel: string
  sourceKind: AuthoredListProvenance
  permissions: AuthoredListPermissions
}

export interface AuthoredListFilter {
  key: string
  label: string
  placeholder: string
  options: Array<{ value: string; label: string }>
}

export interface AuthoredListAttributeColumn {
  key: string
  label: string
  fallback?: string
  width?: number
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
  draftItems?: AuthoredListItem[]
  filters: AuthoredListFilter[]
  attributeColumns?: AuthoredListAttributeColumn[]
  sortOptions?: AuthoredListSortOption[]
  defaultSort?: string
  emptyState?: ReactNode
  error?: string
  loading?: boolean
  initialViewMode?: AuthoredListViewMode
  cardOnly?: boolean
  onCreate?: () => void
  onView?: (item: AuthoredListItem) => void
  onViewIntent?: (item: AuthoredListItem) => void
  onEdit?: (item: AuthoredListItem) => void
  onCopy?: (item: AuthoredListItem) => void
  onDelete?: (item: AuthoredListItem) => void
}
