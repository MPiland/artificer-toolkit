import { createContext } from 'react'

export interface CardContextProps {
  collapsed: boolean
  setCollapsed: (arg: boolean) => void
}

export const CardContext = createContext<CardContextProps | undefined>(undefined)
