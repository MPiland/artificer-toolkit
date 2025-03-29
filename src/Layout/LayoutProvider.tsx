import { useState, ReactNode } from 'react'
import { LayoutContext } from './LayoutContext'

const useLayoutOptions = () => {
  const [collapsed, setCollapsed] = useState<boolean>(false)

  return {
    collapsed,
    setCollapsed,
  }
}

const LayoutProvider = ({ children }: { children: ReactNode }) => {
  const formOptions = useLayoutOptions()

  return <LayoutContext value={formOptions}>{children}</LayoutContext>
}

export default LayoutProvider

export type LayoutOptionsType = ReturnType<typeof useLayoutOptions>
