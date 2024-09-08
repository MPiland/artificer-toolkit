import { createContext } from 'react'

export interface AccordionContextProps {
  activeHeader: HTMLDivElement | null
  setActiveHeader: (header: HTMLDivElement | null) => void
}

export const AccordionContext = createContext<AccordionContextProps | undefined>(undefined)
