import { useContext } from 'react'
import { CardContext, CardContextProps } from '../components/Card/CardContext'

export const useCard = (): CardContextProps => {
  const context = useContext(CardContext)
  if (!context) {
    throw new Error('useForm must be used within a FormProvider')
  }

  return context
}
