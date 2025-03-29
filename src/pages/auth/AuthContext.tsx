import { createContext } from 'react'
import { AuthOptionsType } from './AuthProvider'

export const AuthContext = createContext<AuthOptionsType>({} as AuthOptionsType)
