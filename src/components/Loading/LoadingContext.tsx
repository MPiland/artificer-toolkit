import { createContext } from 'react'
import { LoadingOptionsType } from './LoadingProvider'

export const LoadingContext = createContext<LoadingOptionsType>({} as LoadingOptionsType)