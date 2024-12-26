import { createContext, useState } from 'react'

export const CardOptions = (itemId: string) => {
  const [collapsedStates, setCollapsedStates] = useState<Record<string, boolean>>({})

  const collapsed = collapsedStates[itemId] ?? true
  const setCollapsed = (value: boolean) => {
    setCollapsedStates((prev) => ({
      ...prev,
      [itemId]: value,
    }))
  }

  return {
    collapsed,
    setCollapsed,
  }
}

type CardOptionsType = ReturnType<typeof CardOptions> | null

const CardContext = createContext<CardOptionsType>(undefined)

export default CardContext
