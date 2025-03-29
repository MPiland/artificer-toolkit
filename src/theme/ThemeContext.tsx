import { createContext } from 'react'
import { ThemeOptionsType } from './ThemeProvider'

const ThemeContext = createContext<ThemeOptionsType>({} as ThemeOptionsType)

export default ThemeContext
