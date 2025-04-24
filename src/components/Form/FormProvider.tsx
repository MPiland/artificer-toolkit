import { ReactElement, useEffect, useMemo } from 'react'
import { FeatureWrapper } from './Features'
import Details from './Steps/Details'
import Traits from './Steps/Traits'
import Contains from './Steps/Contains'
import Proficiencies from './Steps/Proficiencies'
import Races from './Steps/CharacterRaces'
import Attributes from './Steps/Attributes'
import Abilities from './Steps/Abilities'
import StartingEquipment from './Steps/StartingEquipment'
import Classes from './Steps/CharacterClasses'
import Equipment from './Steps/Equipment'
import { AncestryWrapper } from './Ancestry'
import { FormContext } from './FormContext'
import { DiceProvider } from '@/components/Dice'
import { Outlet } from '@tanstack/react-router'
import { isEqual } from 'lodash'
import { Suspense } from 'react'
import Loading from '@/components/Loading'
import Background from './Steps/Background'
import { useGetCharacterData } from '@/hooks'
import { useFormStore, type FormStore } from '@/store'
import { Character } from '@/types'
import type { FormDataType, Step } from '@/types'

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
