import { createContext } from 'react'
import { FloatingOptionsType } from './FloatingProvider'

export const FloatingContext = createContext<FloatingOptionsType>({} as FloatingOptionsType)
