import { useState, useReducer } from 'react'
import formReducer from './useReducer'
import { Step } from '../utils/types'

type UseFormHandlingType = {
  steps?: Step[]
}

const useFormHandling = ({ steps }: UseFormHandlingType) => {
  const [saving, setSaving] = useState<boolean>(false)
  const [formState, setFormState] = useReducer(formReducer, {})
  const [oldFormState, setOldFormState] = useState<any>({})
  const [stepIndex, setStepIndex] = useState<number>(0)
  const [isFirstStep, setIsFirstStep] = useState<boolean>(false)
  const [isLastStep, setIsLastStep] = useState<boolean>(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [formName, setFormName] = useState<string>()
  const [stepName, setStepName] = useState<Step | []>(steps ? steps[stepIndex] : [])

  return {
    formState,
    setFormState,
    oldFormState,
    setOldFormState,
    saving,
    setSaving,
    stepName,
    setStepName,
  }
}

export default useFormHandling
