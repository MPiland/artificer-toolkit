import { ReactElement, useCallback, useEffect, useMemo } from 'react'
import FeatureWrapper from './Features/FeatureWrapper'
import Details from './Forms/Details'
import Traits from './Forms/Traits'
import Contains from './Subforms/Contains'
import Proficiencies from './Forms/Proficiencies'
import Races from './Forms/Character/Race/Races'
import Attributes from './Forms/Attributes'
import Abilities from './Forms/Abilities'
import StartingEquipment from './Forms/StartingEquipment'
import { FormDataType, Step, UpdateState } from '../../types/form'
import Classes from './Forms/Character/Classes/Classes'
import Equipment from './Forms/Character/Equipment/Equipment'
import AncestryWrapper from './Ancestry/AncestryWrapper'
import { useStore } from '../../store/useStore'
import { FormContext } from './FormContext'
import DiceProvider from '../Dice/DiceProvider'
import { Outlet } from '@tanstack/react-router'
import { Character } from '../../../amplify/gql/types'
import { isEqual } from 'lodash'
import { Suspense } from 'react'
import Loading from '../Loading/Loading'
import Background from './Forms/Character/Background/Background'
import useGetCharacterData from '../../hooks/useGetCharacterData'

const useFormOptions = () => {
  const {
    formData,
    initialFormData,
    updateFormField,
    addFormField,
    removeFormField,
    formReset,
    initialFormReset,
    ui,
    character,
    setSaving,
    setStepIndex,
    setSuccessMessage,
    setErrorMessage,
    setSteps,
    setValidForm,
    setAddClass,
    setChangeRace,
    resetForm,
    resetFeature,
    resetAncestry,
    resetSection,
    resetOption,
    resetDice,
  } = useStore((state) => state)

  const { features, characterFeatures, sections, hitpoints, abilityScores } = useGetCharacterData({
    formData: formData as Character,
  })

  const characterData = useMemo(() => {
    if (formData.__typename !== 'Character') return formData

    return {
      ...formData,
      features: characterFeatures,
      ...sections,
      abilities: {
        ...formData.abilities,
        scores: abilityScores,
      },
      hitpoint: hitpoints,
    }
  }, [formData, characterFeatures, sections, abilityScores, hitpoints])

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

  useEffect(() => {
    if (formData.__typename === 'Character') {
      if (!isEqual(formData, characterData)) {
        updateFormData({ type: 'reset', value: characterData })
      }
    }
  }, [formData, updateFormData, characterData])

  const fullReset = () => {
    resetForm()
    resetFeature()
    resetAncestry()
    resetSection()
    resetOption()
    resetDice()
  }

  // Standard possible form steps
  const formSteps: Record<Step['id'], ReactElement> = {
    details: <Details />,
    attributes: <Attributes />,
    traits: <Traits />,
    ancestry: <AncestryWrapper />,
    features: <FeatureWrapper />,
    contains: <Contains />,
    proficiencies: <Proficiencies />,
    equipment: (
      <DiceProvider>
        <Equipment />
      </DiceProvider>
    ),
    startingEquipment: <StartingEquipment />,
    race: <Races />,
    class: <Classes />,
    abilities: (
      <DiceProvider>
        <Abilities />
      </DiceProvider>
    ),
    background: <Background />,
  }

  const { saving, steps, errorMessage, validForm, stepIndex, successMessage } = ui

  const { addClass, changeRace } = character

  const isFirstStep = stepIndex === 0 ? true : false

  const isLastStep = stepIndex === steps.length - 1 ? true : false

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
    resetForm,
    isFirstStep,
    isLastStep,
    formData,
    updateFormData,
    fullReset,
    features,
    sections,
  }
}

const FormProvider = () => {
  const formOptions = useFormOptions()

  return (
    <Suspense fallback={<Loading />}>
      <FormContext value={formOptions}>
        <Outlet />
      </FormContext>
    </Suspense>
  )
}

export default FormProvider

export type FormOptionsType = ReturnType<typeof useFormOptions>
