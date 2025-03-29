import { createContext } from 'react'
import { FormOptionsType } from './FormProvider'

export const FormContext = createContext<FormOptionsType>({} as FormOptionsType)

export type UpdateFormData = FormOptionsType['updateFormData']
