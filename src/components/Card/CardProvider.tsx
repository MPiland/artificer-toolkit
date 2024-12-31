import { ReactNode, useState } from 'react'
import { CardContext } from './CardContext'

const useCardOptions = (itemId: string) => {
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

const CardProvider = ({ children, itemId }: { children: ReactNode; itemId: string }) => {
  const cardOptions = useCardOptions(itemId)
  return <CardContext value={cardOptions}>{children}</CardContext>
}

export default CardProvider

export type CardOptionsType = ReturnType<typeof useCardOptions> | null
