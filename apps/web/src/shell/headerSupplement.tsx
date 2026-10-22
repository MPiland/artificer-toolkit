import { createContext, useContext, useEffect } from 'react'
import type { ReactNode } from 'react'

interface ShellHeaderSupplementContextValue {
  setHeaderSupplement: (supplement: ShellHeaderSupplement | null) => void
}

interface ShellAuthoringChrome {
  accountLabel?: string
  isNavigationOpen: boolean
  mobileActions?: ReactNode
  mobileRail: ReactNode
  onNavigationClose: () => void
  onNavigationToggle: () => void
}

export interface ShellHeaderSupplement {
  actions?: ReactNode
  authoringChrome?: ShellAuthoringChrome
  content?: ReactNode
  hideBreadcrumbLeaf?: boolean
}

export const ShellHeaderSupplementContext = createContext<ShellHeaderSupplementContextValue | null>(
  null
)

export function useShellHeaderSupplement(
  content: ReactNode | null,
  options: { actions?: ReactNode; hideBreadcrumbLeaf?: boolean } = {}
) {
  const context = useContext(ShellHeaderSupplementContext)
  const actions = options.actions
  const hideBreadcrumbLeaf = options.hideBreadcrumbLeaf === true

  useEffect(() => {
    if (!context) return undefined
    context.setHeaderSupplement(content ? { actions, content, hideBreadcrumbLeaf } : null)

    return () => context.setHeaderSupplement(null)
  }, [actions, content, context, hideBreadcrumbLeaf])

  return Boolean(context)
}
