import { createContext, useContext, useEffect } from 'react'
import type { ReactNode } from 'react'

export interface ShellHeaderSupplementContextValue {
  setHeaderSupplement: (supplement: ShellHeaderSupplement | null) => void
}

export interface ShellAuthoringChrome {
  accountLabel?: string
  crumbs: readonly { label: string }[]
  desktopRail: ReactNode
  isNavigationOpen: boolean
  mobileRail: ReactNode
  onNavigationClose: () => void
  onNavigationToggle: () => void
  statusLabel?: string
}

export interface ShellHeaderSupplement {
  actions?: ReactNode
  authoringChrome?: ShellAuthoringChrome
  content?: ReactNode
  hideBreadcrumbLeaf?: boolean
}

export const ShellHeaderSupplementContext = createContext<ShellHeaderSupplementContextValue | null>(null)

export function useShellHeaderSupplement(
  content: ReactNode | null,
  options: { actions?: ReactNode, hideBreadcrumbLeaf?: boolean } = {}
) {
  const context = useContext(ShellHeaderSupplementContext)
  const actions = options.actions
  const hideBreadcrumbLeaf = options.hideBreadcrumbLeaf === true

  useEffect(() => {
    if (!context) return undefined
    context.setHeaderSupplement(content ? { actions, content, hideBreadcrumbLeaf } : null)

    return () => context.setHeaderSupplement(null)
  }, [
    actions,
    content,
    context,
    hideBreadcrumbLeaf
  ])

  return Boolean(context)
}

export function useShellAuthoringChrome(chrome: ShellAuthoringChrome | null) {
  const context = useContext(ShellHeaderSupplementContext)

  useEffect(() => {
    if (!context) return undefined
    context.setHeaderSupplement(chrome ? { authoringChrome: chrome } : null)

    return () => context.setHeaderSupplement(null)
  }, [
    chrome,
    context
  ])

  return Boolean(context)
}
