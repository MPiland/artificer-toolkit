import { ReactNode, useState } from 'react'
import { CardContext } from './CardContext'

export const CardProvider = ({ children }: { children: ReactNode }) => {
  const [collapsed, setCollapsed] = useState<boolean>(true)

  const props = {
    collapsed,
    setCollapsed,
  }

  return <CardContext.Provider value={{ ...props }}>{children}</CardContext.Provider>
}

export default CardProvider
