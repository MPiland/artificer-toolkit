import { ReactNode, useState, useEffect } from 'react'
import { ThemeContext } from './ThemeContext'
import { Theme, light, dark, theme as defaultTheme } from '../css/theme.css'

const ThemeProvider = ({ theme, children }: { theme?: Theme; children: ReactNode }) => {
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

  const value = {
    theme: themeObject,
    themeType,
    toggleTheme,
    themeVar,
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export default ThemeProvider
