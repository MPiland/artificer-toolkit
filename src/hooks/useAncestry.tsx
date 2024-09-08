import { useContext } from 'react'
import { AncestryContext, AncestryContextProps } from '../components/Form/Races/AncestryContext'

export const useAncestry = (): AncestryContextProps => {
  const context = useContext(AncestryContext)
  if (!context) {
    throw new Error('useForm must be used within a FormProvider')
  }

  return context
}
