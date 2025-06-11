import { ReactElement, useEffect, useMemo, type FunctionComponent } from 'react'
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
import { isEqual } from 'lodash'
import { Suspense } from 'react'
import Loading from '@/components/Loading'
import Background from './Steps/Background'
import { useGetCharacterData } from '@/hooks'
import { useFormStore, type FormStore } from '@/store'
import type { CharacterInput, FormDataType, Step } from '@/types'
import { CharacterInputSchema } from '@/schemas'
import { AnyFormApi } from '@tanstack/react-form'

const useFormOptions = () => {
  const formStore: FormStore<FormDataType> = useFormStore((state) => state)

  const { features, characterFeatures, sections, hitpoints, abilityScores } = useGetCharacterData({
    formData: formStore.data as CharacterInput,
  })

  const characterData = useMemo(() => {
    if (formStore.data.__kind !== 'CharacterInput') return null

    return CharacterInputSchema.parse({
      ...formStore.data,
      features: characterFeatures,
      ...sections,
      abilities: {
        ...formStore.data.abilities,
        scores: abilityScores,
      },
      hitpoint: hitpoints,
    })
  }, [formStore.data, characterFeatures, sections, abilityScores, hitpoints])

  useEffect(() => {
    if (formStore.data.__kind === 'CharacterInput' && characterData) {
      if (!isEqual(formStore.data, characterData)) {
        formStore.reinitState(characterData)
      }
    }
  }, [formStore.data, formStore, characterData])

  const EquipmentWithDice = () => (
    <DiceProvider>
      <Equipment />
    </DiceProvider>
  )

  const AbilitiesWithDice = () => (
    <DiceProvider>
      <Abilities />
    </DiceProvider>
  )

  // Standard possible form steps
  const formSteps: Record<Step['id'], FunctionComponent<{ form: AnyFormApi }>> = {
    details: Details,
    attributes: Attributes,
    traits: Traits,
    ancestry: AncestryWrapper,
    features: FeatureWrapper,
    contains: Contains,
    proficiencies: Proficiencies,
    equipment: EquipmentWithDice,
    startingEquipment: StartingEquipment,
    race: Races,
    class: Classes,
    abilities: AbilitiesWithDice,
    background: Background,
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

const FormProvider = ({ children }: { children: ReactElement }) => {
  const formOptions = useFormOptions()

  return (
    <Suspense fallback={<Loading />}>
      <FormContext value={formOptions}>{children}</FormContext>
    </Suspense>
  )
}

export default FormProvider

export type FormOptionsType = ReturnType<typeof useFormOptions>
