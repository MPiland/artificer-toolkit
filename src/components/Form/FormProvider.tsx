import { ReactElement, useEffect, useMemo } from 'react'
import FeatureWrapper from './Features/FeatureWrapper'
import Details from './Forms/Details'
import Traits from './Forms/Race/Traits'
import Contains from './Forms/Equipment/Contains'
import Proficiencies from './Forms/Class/Proficiencies'
import Races from './Forms/Character/Race/Races'
import Attributes from './Forms/Attributes'
import Abilities from './Forms/Character/Abilities/Abilities'
import StartingEquipment from './Forms/Class/StartingEquipment'
import type { FormDataType, Step } from '../../types/form'
import Classes from './Forms/Character/Classes/Classes'
import Equipment from './Forms/Character/Equipment/Equipment'
import AncestryWrapper from './Ancestry/AncestryWrapper'
import { FormContext } from './FormContext'
import DiceProvider from '../Dice/DiceProvider'
import { Outlet } from '@tanstack/react-router'
import type { Character } from '../../../amplify/gql/types'
import { isEqual } from 'lodash'
import { Suspense } from 'react'
import Loading from '../Loading/Loading'
import Background from './Forms/Character/Background/Background'
import useGetCharacterData from '../../hooks/useGetCharacterData'
import { useFormStore, type FormStore } from '../../store/formStore'

const useFormOptions = () => {
  const formStore: FormStore<FormDataType> = useFormStore((state) => state)

  const { features, characterFeatures, sections, hitpoints, abilityScores } = useGetCharacterData({
    formData: formStore.data as Character,
  })

  const characterData = useMemo(() => {
    if (formStore.data.__typename !== 'Character') return null

    return {
      ...formStore.data,
      features: characterFeatures,
      ...sections,
      abilities: {
        ...formStore.data.abilities,
        scores: abilityScores,
      },
      hitpoint: hitpoints,
    } as Character
  }, [formStore.data, characterFeatures, sections, abilityScores, hitpoints])

  useEffect(() => {
    if (formStore.data.__typename === 'Character' && characterData) {
      if (!isEqual(formStore.data, characterData)) {
        formStore.reinitState(characterData)
      }
    }
  }, [formStore.data, formStore, characterData])

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

  const { saving, steps, errorMessage, validForm, stepIndex, successMessage } = formStore.ui

  const { addClass, changeRace } = formStore.character

  const isFirstStep = stepIndex === 0 ? true : false

  const isLastStep = stepIndex === steps.length - 1 ? true : false

  return {
    formSteps,
    saving,
    stepIndex,
    successMessage,
    errorMessage,
    validForm,
    addClass,
    changeRace,
    steps,
    isFirstStep,
    isLastStep,
    formStore,
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
