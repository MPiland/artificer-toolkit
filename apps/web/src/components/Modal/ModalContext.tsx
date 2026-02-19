import { createContext } from 'react'
import { ModalOptions } from './ModalProvider'

export const ModalContext = createContext<ModalOptions>({} as ModalOptions)
