import { createContext } from 'react'
import { Theme } from '../css/theme.css'

export interface ThemeContextProps {
  theme: Theme
  themeType: string
  toggleTheme: () => void
  themeVar: string
}

export const ThemeContext = createContext<ThemeContextProps | undefined>(undefined)
