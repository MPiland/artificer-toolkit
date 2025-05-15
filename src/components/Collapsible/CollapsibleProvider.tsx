import { ReactNode, useState } from 'react'
import { CollapsibleContext } from './CollapsibleContext'

const useCollapsibleOptions = () => {
  const [defaultOpenState, setDefaultOpenState] = useState<boolean>(false)
  const [disabledState, setDisabledState] = useState<boolean>(false)
  const [open, setOpen] = useState<boolean>(defaultOpenState)

  return {
    open,
    setOpen,
    defaultOpenState,
    setDefaultOpenState,
    disabledState,
    setDisabledState,
  }
}

const CollapsibleProvider = ({ children }: { children: ReactNode }) => {
  const collapsibleOptions = useCollapsibleOptions()
  return <CollapsibleContext value={collapsibleOptions}>{children}</CollapsibleContext>
}

export default CollapsibleProvider

export type CollapsibleOptionsType = ReturnType<typeof useCollapsibleOptions>
