import { ReactNode, useState } from 'react'
import { ThemeContext } from './ThemeContext'
import { Theme, light, dark, theme as defaultTheme } from '../css/theme.css'

const ThemeProvider = ({ theme, children }: { theme?: Theme; children: ReactNode }) => {
  const [themeType, setThemeType] = useState('light')

  const themeObject = theme ?? defaultTheme

  const toggleTheme = () => {
    setThemeType(themeType === 'light' ? 'dark' : 'light')
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
