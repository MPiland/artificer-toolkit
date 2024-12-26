import { createContext } from 'react'
import { useState, useEffect } from 'react'
import { Theme, light, dark, theme as defaultTheme } from '../css/theme.css'

export const ThemeOptions = ({ theme }: { theme?: Theme }) => {
  const [themeType, setThemeType] = useState<'light' | 'dark'>()

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        setThemeType(e.matches ? 'dark' : 'light')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const themeObject = theme ?? defaultTheme

  const toggleTheme = () => {
    const newTheme = themeType === 'light' ? 'dark' : 'light'
    setThemeType(newTheme)
    localStorage.setItem('theme', newTheme)
  }

  const themeVar = themeType === 'light' ? light : dark

  return {
    theme: themeObject,
    themeType,
    toggleTheme,
    themeVar,
  }
}

export interface ThemeContextProps {
  theme: Theme
  themeType: string
  toggleTheme: () => void
  themeVar: string
}

const ThemeContext = createContext<ThemeOptionsType>(null)

export default ThemeContext

export type ThemeOptionsType = ReturnType<typeof ThemeOptions> | null
