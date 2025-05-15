import { createContext } from 'react'
import { CollapsibleOptionsType } from './CollapsibleProvider'

export const CollapsibleContext = createContext<CollapsibleOptionsType>({} as CollapsibleOptionsType)
