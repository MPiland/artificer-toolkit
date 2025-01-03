import { useState, ReactElement, useCallback } from 'react'
import FeatureWrapper from './Features/FeatureWrapper'
import Details from './Generic/Details'
import Traits from './Races/Traits'
import Contains from './Equipment/Contains'
import Proficiencies from './Classes/Proficiencies'
import Races from './Character/Races/Races'
import Attributes from './Generic/Attributes'
import Abilities from './Character/Abilities'
import StartingEquipment from './Classes/StartingEquipment'
import { FormDataType, FormSteps, Step, UpdateState } from '../../types/form'
import CharacterClasses from './Character/Classes/CharacterClasses'
import BackgroundEquipment from './Backgrounds/BackgroundEquipment'
import Equipment from './Character/Equipment'
import AncestryWrapper from './Races/AncestryWrapper'
import { useStore } from '../../store/useStore'
import { FormContext } from './FormContext'
import DiceProvider from '../Dice/DiceProvider'
import { Outlet } from 'react-router-dom'

const useFormOptions = () => {
  // Generic form states
  const [saving, setSaving] = useState<boolean>(false)
  const [stepIndex, setStepIndex] = useState<number>(0)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [validForm, setValidForm] = useState<{ [key: string]: boolean }>({})

  // Character builder states
  const [addClass, setAddClass] = useState<boolean>(false)
  const [changeRace, setChangeRace] = useState<boolean>(false)

  const { formData, initialFormData, updateFormField, addFormField, removeFormField, formReset, initialFormReset } =
    useStore()

  const updateFormData = useCallback(
    <T extends FormDataType>(state: UpdateState<T>) => {
      switch (state.type) {
        case 'add': {
          if (state.value) {
            addFormField({ path: state.path, value: state.value })
          } else {
            addFormField({ path: state.path })
          }
          break
        }
        case 'update':
          updateFormField({ path: state.path, value: state.value })
          break
        case 'remove':
          removeFormField({ path: state.path })
          break
        case 'reset':
          formReset({ value: state.value })
          break
        case 'initialReset':
          initialFormReset({ value: state.value })
          break
      }
    },
    [addFormField, formReset, initialFormReset, removeFormField, updateFormField]
  )

  // Standard possible form steps
  const formSteps: Record<FormSteps, ReactElement> = {
    details: <Details />,
    attributes: <Attributes />,
    traits: <Traits />,
    ancestry: <AncestryWrapper />,
    features: <FeatureWrapper />,
    contains: <Contains />,
    proficiencies: <Proficiencies />,
    equipment: formData.__typename === 'Background' ? <BackgroundEquipment /> : <Equipment />,
    startingEquipment: <StartingEquipment />,
    race: <Races />,
    class: <CharacterClasses />,
    abilities: (
      <DiceProvider>
        <Abilities />
      </DiceProvider>
    ),
    background: <></>,
  }

  const isFirstStep = () => {
    if (stepIndex === 0) {
      return true
    } else {
      return false
    }
  }

  const isLastStep = () => {
    if (stepIndex === steps?.length - 1) {
      return true
    } else {
      return false
    }
  }

  const stateReset = () => {
    setSaving(false)
    setStepIndex(0)
    setSuccessMessage(null)
    setErrorMessage(null)
    setValidForm({})
    setAddClass(false)
    setChangeRace(false)

    return Promise.resolve()
  }

  return {
    formSteps,
    initialFormData,
    saving,
    setSaving,
    stepIndex,
    setStepIndex,
    successMessage,
    setSuccessMessage,
    errorMessage,
    setErrorMessage,
    validForm,
    setValidForm,
    addClass,
    setAddClass,
    changeRace,
    setChangeRace,
    steps,
    setSteps,
    stateReset,
    isFirstStep,
    isLastStep,
    formData,
    updateFormData,
  }
}

const FormProvider = () => {
  const formOptions = useFormOptions()

  return (
    <FormContext.Provider value={formOptions}>
      <Outlet />
    </FormContext.Provider>
  )
}

export default FormProvider

export type FormOptionsType = ReturnType<typeof useFormOptions> | null
