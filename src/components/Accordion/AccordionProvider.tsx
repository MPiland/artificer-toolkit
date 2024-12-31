import { ReactNode, useState } from 'react'
import { AccordionContext } from './AccordionContext'

const useAccordion = () => {
  const [activeHeader, setActiveHeader] = useState<HTMLDivElement | null>(null)

  return {
    activeHeader,
    setActiveHeader,
  }
}

const AccordionProvider = ({ children }: { children: ReactNode }) => {
  const accordionOptions = useAccordion()
  return <AccordionContext value={accordionOptions}>{children}</AccordionContext>
}

export default AccordionProvider

export type AccordionOptionsType = ReturnType<typeof useAccordion> | null
