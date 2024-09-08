import { useContext } from 'react'
import { FormContext, FormContextProps } from '../components/Form/FormContext'

export const useForm = (): FormContextProps => {
  const context = useContext(FormContext)
  if (!context) {
    throw new Error('useForm must be used within a FormProvider')
  }

  return context
}
