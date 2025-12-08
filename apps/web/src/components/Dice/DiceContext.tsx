import { createContext } from 'react'
import { DiceOptionsType } from './DiceProvider'

export const DiceContext = createContext<DiceOptionsType>({} as DiceOptionsType)
