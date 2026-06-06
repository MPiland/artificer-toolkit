export type MobileAppFooterMenuItem = {
  href: string
  id: string
  isActive?: boolean
  label: string
  meta?: string
}

export type MobileAppFooterItemIcon = 'account' | 'create' | 'library' | 'search'

export type MobileAppFooterItem = {
  icon: MobileAppFooterItemIcon
  id: string
  isActive?: boolean
  label: string
  menuItems?: readonly MobileAppFooterMenuItem[]
  onClick?: () => void
}

export type MobileAppFooterProps = {
  'aria-label'?: string
  className?: string
  items: readonly MobileAppFooterItem[]
}
