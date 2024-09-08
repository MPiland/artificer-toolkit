import { useState, useReducer, ReactElement, useMemo } from 'react'
import formReducer from '../../hooks/useReducer'
import { StepType } from '../../utils/types'
import FeatureWrapper from './Features/FeatureWrapper'
import Details from './Generic/Details'
import Traits from './Races/Traits'
import Contains from './Equipment/Contains'
import Proficiencies from './Classes/Proficiencies'
import Races from './Character/Races/Races'
import Attributes from './Generic/Attributes'
import Abilities from './Character/Abilities'
import StartingEquipment from './Classes/StartingEquipment'
import { ContextType } from '../../utils/types'
import { FormContext } from './FormContext'
import Classes from './Character/Classes/Classes'
import { DiceProvider } from '../Dice/DiceProvider'
import BackgroundEquipment from './Backgrounds/BackgroundEquipment'
import { Outlet } from 'react-router-dom'
import Equipment from './Character/Races/Equipment'
import AncestryWrapper from './Races/AncestryWrapper'

export const FormProvider = () => {
  // Generic form states
  const [context, setContext] = useState<ContextType>({ title: undefined, type: undefined })
  const [saving, setSaving] = useState<boolean>(false)
  const [formState, setFormState] = useReducer(formReducer, {})
  const [oldFormState, setOldFormState] = useState<any>({})
  const [stepIndex, setStepIndex] = useState<number>(0)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [steps, setSteps] = useState<StepType[]>([])
  const [validForm, setValidForm] = useState<{ [key: string]: boolean }>({})

  // Character builder states
  const [addClass, setAddClass] = useState<boolean>(false)
  const [changeRace, setChangeRace] = useState<boolean>(false)

  // Standard possible form steps
  const formSteps: { [key: string]: ReactElement } = {
    details: <Details />,
    attributes: <Attributes />,
    traits: <Traits />,
    ancestry: <AncestryWrapper />,
    features: <FeatureWrapper />,
    contains: <Contains />,
    proficiencies: <Proficiencies />,
    equipment: context.title === 'backgrounds' ? <BackgroundEquipment /> : <Equipment />,
    startingEquipment: <StartingEquipment />,
    race: <Races />,
    class: <Classes />,
    abilities: (
      <DiceProvider>
        <Abilities />
      </DiceProvider>
    ),
  }

  const isFirstStep = useMemo(() => {
    if (stepIndex === 0) {
      return true
    } else {
      return false
    }
  }, [stepIndex])

  const isLastStep = useMemo(() => {
    if (stepIndex === steps?.length - 1) {
      return true
    } else {
      return false
    }
  }, [stepIndex, steps])

  const stateReset = () => {
    setContext({ title: undefined, type: undefined })
    setSaving(false)
    setStepIndex(0)
    setSuccessMessage(null)
    setErrorMessage(null)
    setValidForm({})
    setAddClass(false)
    setChangeRace(false)

    return Promise.resolve()
  }

  const formProps = {
    formSteps,
    formState,
    setFormState,
    oldFormState,
    setOldFormState,
    saving,
    setSaving,
    stepIndex,
    setStepIndex,
    context,
    setContext,
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
  }

  return (
    <FormContext.Provider value={formProps}>
      <Outlet />
    </FormContext.Provider>
  )
}

export default FormProvider
