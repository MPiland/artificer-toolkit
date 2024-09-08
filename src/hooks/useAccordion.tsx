import { useContext } from 'react'
import { AccordionContext, AccordionContextProps } from '../components/Accordion/AccordionContext'

export const useAccordion = (): AccordionContextProps => {
  const context = useContext(AccordionContext)
  if (!context) {
    throw new Error('useForm must be used within a FormProvider')
  }

  return context
}
