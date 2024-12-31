import { createContext } from 'react'
import { ThemeOptionsType } from './ThemeProvider'

const ThemeContext = createContext<ThemeOptionsType>(null)

export default ThemeContext
