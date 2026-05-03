import { createContext } from 'react'
import type { ModalOptions } from './Modal.types'

export const ModalContext = createContext<ModalOptions>({} as ModalOptions)
