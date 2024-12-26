import { createContext, useState } from 'react'

export const AccordionOptions = () => {
  const [activeHeader, setActiveHeader] = useState<HTMLDivElement | null>(null)

  return {
    activeHeader,
    setActiveHeader,
  }
}

type AccordionOptionsType = ReturnType<typeof AccordionOptions> | null

export const AccordionContext = createContext<AccordionOptionsType>(undefined)
