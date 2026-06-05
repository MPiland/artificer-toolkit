import type { RefObject, ReactNode } from 'react'

export type HeaderCrumb = {
  label: string
}

export type HeaderProps = {
  accountControl?: ReactNode
  accountLabel?: string
  actions?: ReactNode
  crumbs: readonly HeaderCrumb[]
  isNavigationOpen: boolean
  navigationActions?: ReactNode
  navigationButtonRef?: RefObject<HTMLButtonElement | null>
  navigationLabel?: string
  onNavigationToggle: () => void
  showNavigationButton?: boolean
  statusLabel?: string
}
