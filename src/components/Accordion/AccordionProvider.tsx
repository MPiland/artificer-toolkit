import { ReactNode, useState } from 'react'
import { AccordionContext } from './AccordionContext'

export const AccordionProvider = ({ children }: { children: ReactNode }) => {
  const [activeHeader, setActiveHeader] = useState<HTMLDivElement | null>(null)

  const props = {
    activeHeader,
    setActiveHeader,
  }

  return <AccordionContext.Provider value={{ ...props }}>{children}</AccordionContext.Provider>
}

export default AccordionProvider
