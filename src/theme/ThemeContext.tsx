import { createContext, useState, useLayoutEffect } from 'react'
import { light, dark, theme } from '../css/theme.css'

export const ThemeOptions = () => {
  const [themeType, setThemeType] = useState<'light' | 'dark'>()

  useLayoutEffect(() => {
    if (themeType == null) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = (e: MediaQueryListEvent) => {
        if (!localStorage.getItem('theme')) {
          setThemeType(e.matches ? 'dark' : 'light')
        }
      }

      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [themeType])

  const toggleTheme = () => {
    const newTheme = themeType === 'light' ? 'dark' : 'light'
    setThemeType(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  const themeVar = themeType === 'light' ? light : dark

  return {
    theme,
    themeType,
    toggleTheme,
    themeVar,
  }
}

const ThemeContext = createContext<ThemeOptionsType>(null)

export default ThemeContext

export type ThemeOptionsType = ReturnType<typeof ThemeOptions> | null
