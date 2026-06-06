import type { ReactNode } from 'react'

export type MobileAppFooterMenuItem = {
  href: string
  id: string
  isActive?: boolean
  label: string
}

export type MobileAppFooterItemIcon = 'account' | 'create' | 'library' | 'search'

export type MobileAppFooterItem = {
  icon: MobileAppFooterItemIcon
  id: string
  isActive?: boolean
  label: string
  menuContent?: ReactNode
  menuItems?: readonly MobileAppFooterMenuItem[]
  onClick?: () => void
}

export type MobileAppFooterProps = {
  'aria-label'?: string
  className?: string
  items: readonly MobileAppFooterItem[]
}
