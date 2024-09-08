import { useContext } from 'react'
import { FeatureContext, FeatureContextProps } from '../components/Form/Features/FeatureContext'

export const useFeature = (): FeatureContextProps => {
  const context = useContext(FeatureContext)
  if (!context) {
    throw new Error('useForm must be used within a FormProvider')
  }

  return context
}
