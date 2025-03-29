import { createContext } from 'react'
import { CardOptionsType } from './CardProvider'

export const CardContext = createContext<CardOptionsType>({} as CardOptionsType)
