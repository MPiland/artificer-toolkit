import { ReactElement, useCallback, useEffect } from 'react'
import FeatureWrapper from './Features/FeatureWrapper'
import Details from './Forms/Details'
import Traits from './Forms/Traits'
import Contains from './Subforms/Contains'
import Proficiencies from './Forms/Proficiencies'
import Races from './Forms/Character/Race/Races'
import Attributes from './Forms/Attributes'
import Abilities from './Forms/Abilities'
import StartingEquipment from './Forms/StartingEquipment'
import { FormDataType, FormSteps, UpdateState } from '../../types/form'
import CharacterClasses from './Forms/Character/Classes/CharacterClasses'
import BackgroundEquipment from './Forms/BackgroundEquipment'
import Equipment from './Forms/Equipment'
import AncestryWrapper from './Ancestry/AncestryWrapper'
import { useStore } from '../../store/useStore'
import { FormContext } from './FormContext'
import DiceProvider from '../Dice/DiceProvider'
import { Outlet } from 'react-router-dom'
import useGetSections from '../../hooks/useGetSectionState'
import { Character } from '../../../amplify/gql/types'
import { isEqual } from 'lodash'

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
    resetSubfeature,
  } = useStore((state) => state)

  const { createSections, createFeatures, createAbilityScores } = useGetSections({ formData: formData as Character })

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

  const features = createFeatures()

  const sections = createSections()

  const abilityScores = createAbilityScores()

  useEffect(() => {
    if (formData.__typename === 'Character') {
      const characterData: Character = JSON.parse(JSON.stringify(formData))

      // Store the current character sections for comparison at the end
      const characterSections = {
        feats: characterData.feats,
        modifiers: characterData.modifiers,
        proficiencies: characterData.proficiencies,
        expertise: characterData.expertise,
        senses: characterData.senses,
      }

      if (!isEqual(sections, characterSections)) {
        updateFormData({
          type: 'reset',
          value: { ...formData, ...sections },
        })
      }
    }
  }, [sections, updateFormData, formData])

  useEffect(() => {
    if (formData.__typename === 'Character' && !isEqual(formData?.features, features)) {
      updateFormData({
        type: 'update',
        path: 'features',
        value: features,
      })
    }
  })

  useEffect(() => {
    if (formData.__typename === 'Character') {
      if (!isEqual(abilityScores, formData?.abilities?.scores)) {
        updateFormData({ type: 'update', path: 'abilities.scores', value: abilityScores })
      }
    }
  }, [formData, updateFormData, abilityScores])

  const fullReset = () => {
    resetForm()
    resetFeature()
    resetAncestry()
    resetSection()
    resetOption()
    resetSubfeature()
  }

  // Standard possible form steps
  const formSteps: Record<FormSteps, ReactElement> = {
    details: <Details />,
    attributes: <Attributes />,
    traits: <Traits />,
    ancestry: <AncestryWrapper />,
    features: <FeatureWrapper />,
    contains: <Contains />,
    proficiencies: <Proficiencies />,
    equipment: (
      <DiceProvider>{formData.__typename === 'Background' ? <BackgroundEquipment /> : <Equipment />}</DiceProvider>
    ),
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
    <FormContext value={formOptions}>
      <Outlet />
    </FormContext>
  )
}

export default FormProvider

export type FormOptionsType = ReturnType<typeof useFormOptions> | null
