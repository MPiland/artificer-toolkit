import { createContext } from 'react'
import { AccordionOptionsType } from './AccordionProvider'

export const AccordionContext = createContext<AccordionOptionsType>(undefined)
