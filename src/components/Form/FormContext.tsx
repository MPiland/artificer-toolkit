import { createContext, Dispatch, ReactElement, SetStateAction } from 'react'
import { ReducerActionType, ContextType, StepType } from '../../utils/types'

export interface FormContextProps {
  context: ContextType
  setContext: Dispatch<SetStateAction<ContextType>>
  formState: any
  setFormState: (arg: ReducerActionType) => void
  oldFormState: any
  setOldFormState: (arg: any) => void
  saving: boolean
  setSaving: (arg: boolean) => void
  stepIndex: number
  setStepIndex: (arg: number) => void
  successMessage: string | null
  setSuccessMessage: (arg: string | null) => void
  errorMessage: string | null
  setErrorMessage: (arg: string | null) => void
  validForm: { [key: string]: boolean } | Record<string, never>
  setValidForm: (arg: { [key: string]: boolean }) => void
  addClass: boolean
  setAddClass: (arg: boolean) => void
  changeRace: boolean
  setChangeRace: (arg: boolean) => void
  formSteps: { [key: string]: ReactElement }
  steps: StepType[]
  setSteps: (arg: StepType[]) => void
  stateReset: () => Promise<void>
  isFirstStep: boolean
  isLastStep: boolean
}

export const FormContext = createContext<FormContextProps | undefined>(undefined)
