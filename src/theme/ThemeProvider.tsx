import { useState, useLayoutEffect } from 'react'
import { light, dark, theme } from '@/css/theme.css'
import ThemeContext from './ThemeContext'

const useThemeOptions = () => {
  const [themeType, setThemeType] = useState<'light' | 'dark'>()

  useLayoutEffect(() => {
    const setTheme = localStorage.getItem('theme')
    if (!setTheme) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = (e: MediaQueryListEvent) => {
        if (!localStorage.getItem('theme')) {
          setThemeType(e.matches ? 'dark' : 'light')
        }
      }

      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    } else {
      setThemeType(setTheme as 'light' | 'dark')
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

const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const themeOptions = useThemeOptions()

  return <ThemeContext value={themeOptions}>{children}</ThemeContext>
}

export default ThemeProvider

export type ThemeOptionsType = ReturnType<typeof useThemeOptions>
