import { useContext } from 'react'
import { ThemeContext, ThemeContextProps } from '../theme/ThemeContext'

export const useTheme = (): ThemeContextProps => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useForm must be used within a FormProvider')
  }

  return context
}
