import { createContext } from 'react'
import { ModalOptionsType } from './ModalProvider'

export const ModalContext = createContext<ModalOptionsType>({} as ModalOptionsType)
