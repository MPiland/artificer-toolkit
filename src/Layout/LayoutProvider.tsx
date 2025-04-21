import { useState, ReactNode, useMemo } from 'react'
import { LayoutContext } from './LayoutContext'

const useLayoutOptions = () => {
  const [collapsed, setCollapsed] = useState<boolean>(false)

  // Memoize the context value
  const layoutContextValue = useMemo(
    () => ({
      collapsed,
      setCollapsed,
    }),
    [collapsed]
  )

  return layoutContextValue
}

const LayoutProvider = ({ children }: { children: ReactNode }) => {
  const formOptions = useLayoutOptions()

  return <LayoutContext value={formOptions}>{children}</LayoutContext>
}

export default LayoutProvider

export type LayoutOptionsType = ReturnType<typeof useLayoutOptions>
