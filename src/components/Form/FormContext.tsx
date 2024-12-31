import { createContext } from 'react'
import { FormOptionsType } from './FormProvider'

export const FormContext = createContext<FormOptionsType>(null)

export type UpdateFormData = FormOptionsType['updateFormData']
