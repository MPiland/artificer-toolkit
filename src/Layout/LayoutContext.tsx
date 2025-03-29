import { createContext } from 'react'
import { LayoutOptionsType } from './LayoutProvider'

export const LayoutContext = createContext<LayoutOptionsType>({} as LayoutOptionsType)
