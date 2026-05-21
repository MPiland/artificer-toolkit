import { createContext, useContext, useEffect } from 'react'
import type { ReactNode } from 'react'

export interface ShellHeaderSupplementContextValue {
  setHeaderSupplement: (supplement: ShellHeaderSupplement | null) => void
}

export interface ShellHeaderSupplement {
  actions?: ReactNode
  content: ReactNode
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
