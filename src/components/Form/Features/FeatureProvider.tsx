import { ReactElement, use, ReactNode, useCallback } from 'react'
import {
  DeepKeyOf,
  FormDataType,
  SectionDataType,
  sectionSteps,
  UpdateState,
  SectionName,
  FeatureTypes,
  featureTypes,
} from '../../../types/form'
import Feats from './Sections/Feats'
import Spells from './Sections/Spells'
import Modifiers from './Sections/Modifiers'
import Senses from './Sections/Senses'
import Proficiencies from './Sections/Proficiencies'
import Options from './Options'
import { set, toLower } from 'lodash'
import Features from './Features'
import {
  FeatureOption,
  Feature,
  Feat,
  AncestryFeature,
  Class,
  Race,
  Equipment,
  Background,
  AncestryOption,
} from '../../../../amplify/gql/types'
import { FormContext } from '../FormContext'
import { useStore } from '../../../store/useStore'
import Expertise from './Sections/Expertise'
import AncestryFeatures from '../Ancestry/AncestryFeatures'
import { FeatureContext } from './FeatureContext'
import AncestryOptions from '../Ancestry/AncestryOptions'

const useFeatureOptions = () => {
  const { formData, steps, stepIndex } = use(FormContext)

  const {
    featureData,
    featureStep,
    featureIndex,
    initialFeatureData,
    addFeatureField,
    updateFeatureField,
    removeFeatureField,
    featureReset,
    initialFeatureReset,
    updateFeatureIndex,
    setFeatureStep,
    resetFeature,
    optionData,
    optionIndex,
    initialOptionData,
    addOptionField,
    updateOptionField,
    removeOptionField,
    optionReset,
    initialOptionReset,
    updateOptionIndex,
    resetOption,
    sectionData,
    sectionIndex,
    initialSectionData,
    sectionStep,
    setSectionStep,
    addSectionField,
    updateSectionField,
    removeSectionField,
    sectionReset,
    initialSectionReset,
    updateSectionIndex,
    resetSection,
    ancestryData,
    ancestryIndex,
    initialAncestryData,
    addAncestryField,
    updateAncestryField,
    removeAncestryField,
    ancestryReset,
    initialAncestryReset,
    updateAncestryIndex,
    resetAncestry,
  } = useStore((state) => state)

  const sectionStepComponent: {
    [K in SectionName]?: ReactElement
  } = {
    feats: <Feats />,
    senses: <Senses />,
    spells: <Spells />,
    modifiers: <Modifiers />,
    expertise: <Expertise />,
    proficiencies: <Proficiencies />,
  }

  const featureSteps: {
    [K in FeatureTypes]?: ReactElement
  } = {
    feature: <Features />,
    option: <Options />,
    ancestry: <AncestryFeatures />,
    ancestryOption: <AncestryOptions />,
  }

  const updateFeatureData = (state: UpdateState<Feature>) => {
    switch (state.type) {
      case 'add': {
        if (state.value) {
          addFeatureField({ path: state.path, value: state.value })
        } else {
          addFeatureField({ path: state.path })
        }
        break
      }
      case 'update':
        updateFeatureField({ path: state.path, value: state.value })
        break
      case 'remove':
        removeFeatureField({ path: state.path })
        break
      case 'reset':
        featureReset({ value: state.value })
        break
      case 'initialReset':
        initialFeatureReset({ value: state.value })
        break
      case 'index':
        updateFeatureIndex({ value: state.value })
        break
    }
  }

  const updateAncestryData = (state: UpdateState<AncestryOption>) => {
    switch (state.type) {
      case 'add': {
        if (state.value) {
          addAncestryField({ path: state.path, value: state.value })
        } else {
          addAncestryField({ path: state.path })
        }
        break
      }
      case 'update':
        updateAncestryField({ path: state.path, value: state.value })
        break
      case 'remove':
        removeAncestryField({ path: state.path })
        break
      case 'reset':
        ancestryReset({ value: state.value })
        break
      case 'initialReset':
        initialAncestryReset({ value: state.value })
        break
      case 'index':
        updateAncestryIndex({ value: state.value })
        break
    }
  }

  const updateOptionData = (state: UpdateState<FeatureOption>) => {
    switch (state.type) {
      case 'add': {
        if (state.value) {
          addOptionField({ path: state.path, value: state.value })
        } else {
          addOptionField({ path: state.path })
        }
        break
      }
      case 'update':
        updateOptionField({ path: state.path, value: state.value })
        break
      case 'remove':
        removeOptionField({ path: state.path })
        break
      case 'reset':
        optionReset({ value: state.value })
        break
      case 'initialReset':
        initialOptionReset({ value: state.value })
        break
      case 'index':
        updateOptionIndex({ value: state.value })
        break
    }
  }

  const updateSectionData = useCallback(
    <T extends SectionDataType>(state: UpdateState<T>) => {
      switch (state.type) {
        case 'add': {
          if (state.value) {
            addSectionField({ path: state.path, value: state.value })
          } else {
            addSectionField({ path: state.path })
          }
          break
        }
        case 'update':
          updateSectionField({ path: state.path, value: state.value })
          break
        case 'remove':
          removeSectionField({ path: state.path })
          break
        case 'reset':
          sectionReset({ value: state.value })
          break
        case 'initialReset':
          initialSectionReset({ value: state.value })
          break
        case 'index':
          updateSectionIndex({ value: state.value })
          break
      }
    },
    [addSectionField, removeSectionField, sectionReset, updateSectionField, updateSectionIndex, initialSectionReset]
  )

  function isSectionName(key: string): key is SectionName {
    return sectionSteps.includes(key as SectionName)
  }

  function isFeatureStep(key: string): key is FeatureTypes {
    return featureTypes.includes(key as FeatureTypes)
  }

  const cloneAndSetStates = <T extends Feature | AncestryFeature | SectionDataType | FeatureOption>({
    state,
    updateData,
  }: {
    state: T
    updateData: (arg: UpdateState<T>) => void
  }) => {
    updateData({ type: 'initialReset', value: state })
    updateData({
      type: 'reset',
      value: state,
    })
  }

  const handleSaveFeatures = async ({ type, state }: { type: FeatureTypes; state: FormDataType }) => {
    const formClone: FormDataType = state ? JSON.parse(JSON.stringify(state)) : {}
    const paths: {
      option: {
        feats: () => Array<DeepKeyOf<Feat>>
        default: () => Array<DeepKeyOf<Class | Race | Omit<Equipment, 'contains'> | Background>>
      }
      feature: {
        feats: () => Array<DeepKeyOf<Feat>>
        default: () => Array<DeepKeyOf<Class | Race | Omit<Equipment, 'contains'> | Background>>
      }
    } = {
      option: {
        feats: () => {
          const pathArray: Array<DeepKeyOf<Feat>> = [`options.${optionIndex}`]
          if (sectionStep !== null) {
            pathArray.push(`options.${optionIndex}`, `options.${optionIndex}.${sectionStep}.${sectionIndex}`)
          }
          return pathArray
        },
        default: () => {
          const pathArray: Array<DeepKeyOf<Class | Race | Omit<Equipment, 'contains'> | Background>> = []
          if (steps[stepIndex].id === 'ancestry') {
            pathArray.push(
              `ancestry.options.${ancestryIndex}`,
              `ancestry.options.${ancestryIndex}.features.${featureIndex}`,
              `ancestry.options.${ancestryIndex}.features.${featureIndex}.options.${optionIndex}`
            )
            if (sectionStep !== null) {
              pathArray.push(
                `ancestry.options.${ancestryIndex}.features.${featureIndex}.options.${optionIndex}.${sectionStep}.${sectionIndex}`
              )
            }
          } else {
            pathArray.push(`features.${featureIndex}`, `features.${featureIndex}.options.${optionIndex}`)
            if (sectionStep !== null) {
              pathArray.push(`features.${featureIndex}.options.${optionIndex}.${sectionStep}.${sectionIndex}`)
            }
          }
          return pathArray
        },
      },
      feature: {
        feats: () => {
          const pathArray: Array<DeepKeyOf<Feat>> = []
          if (sectionStep !== null) {
            pathArray.push(`features.${featureIndex}.${sectionStep}.${sectionIndex}`)
          }
          return pathArray
        },
        default: () => {
          const pathArray: Array<DeepKeyOf<Class | Race | Omit<Equipment, 'contains'> | Background>> = []
          if (steps[stepIndex].id === 'ancestry') {
            pathArray.push(
              `ancestry.options.${ancestryIndex}`,
              `ancestry.options.${ancestryIndex}.features.${featureIndex}`
            )
            if (sectionStep !== null) {
              pathArray.push(
                `ancestry.options.${ancestryIndex}.features.${featureIndex}.${sectionStep}.${sectionIndex}`
              )
            }
          } else {
            pathArray.push(`features.${featureIndex}`)
            if (sectionStep !== null) {
              pathArray.push(`features.${featureIndex}.${sectionStep}.${sectionIndex}`)
            }
          }
          return pathArray
        },
      },
    }

    const getContextPaths = ({ title }: { title: 'feats' | 'default' }): string[] => {
      const pathType = toLower(type) as 'option' | 'feature'
      return paths[pathType][title]() || paths[pathType].default()
    }

    type UpdateFunction =
      | { type: 'option'; fn: (arg: UpdateState<FeatureOption>) => void }
      | { type: 'feature'; fn: (arg: UpdateState<Feature>) => void }
      | { type: 'section'; fn: (arg: UpdateState<SectionDataType>) => void }

    const setStates = ({ title }: { title: 'feats' | 'default' }) => {
      const lowerType = toLower(type) as 'option' | 'feature'

      const stateMap: Record<'option' | 'feature', Array<FeatureOption | Feature | SectionDataType>> = {
        option: [optionData],
        feature: [featureData],
      }

      const updateFunctions: Record<'option' | 'feature', Array<UpdateFunction>> = {
        option: [{ type: 'option', fn: updateOptionData }],
        feature: [{ type: 'feature', fn: updateFeatureData }],
      }

      if (sectionStep !== null) {
        stateMap.option.push(sectionData)
        updateFunctions.option.push({ type: 'section', fn: updateSectionData })
        stateMap.feature.push(sectionData)
        updateFunctions.feature.push({ type: 'section', fn: updateSectionData })
      }

      if (featureStep !== null) {
        const currentStates = stateMap[lowerType]
        const paths = getContextPaths({ title })

        Object.values(paths).forEach((path, index) => {
          if (index < currentStates.length) {
            set(formClone, path, JSON.parse(JSON.stringify(currentStates[index])))

            if (index === 0 && lowerType === 'option') {
              cloneAndSetStates<FeatureOption>({
                state: currentStates[index] as FeatureOption,
                updateData: updateOptionData,
              })
            } else if (index === 0 && lowerType === 'feature') {
              cloneAndSetStates<Feature>({
                state: currentStates[index] as Feature,
                updateData: updateFeatureData,
              })
            } else {
              cloneAndSetStates<SectionDataType>({
                state: currentStates[index] as SectionDataType,
                updateData: updateSectionData,
              })
            }
          }
        })
      }
    }

    setStates({ title: formData.__typename === 'Feat' ? 'feats' : 'default' })

    return formClone
  }

  const featureProps = {
    resetFeature,
    featureStep,
    setFeatureStep,
    featureData,
    initialFeatureData,
    updateFeatureData,
    featureIndex,
    handleSaveFeatures,
    featureSteps,
    isFeatureStep,
  }

  const optionProps = {
    resetOption,
    optionData,
    initialOptionData,
    updateOptionData,
    optionIndex,
  }

  const sectionProps = {
    resetSection,
    sectionData,
    initialSectionData,
    updateSectionData,
    sectionIndex,
    sectionSteps,
    sectionStep,
    setSectionStep,
    sectionStepComponent,
    isSectionName,
  }

  const ancestryFeatureProps = {
    resetAncestry,
    ancestryData,
    initialAncestryData,
    updateAncestryData,
    ancestryIndex,
  }

  return {
    ...featureProps,
    ...optionProps,
    ...sectionProps,
    ...ancestryFeatureProps,
  }
}

const FeatureProvider = ({ children }: { children: ReactNode }) => {
  const featureOptions = useFeatureOptions()

  return <FeatureContext value={featureOptions}>{children}</FeatureContext>
}

export default FeatureProvider

export type FeatureOptionsType = ReturnType<typeof useFeatureOptions>

export type UpdateFeatureData = FeatureOptionsType['updateFeatureData']
export type UpdateOptionData = FeatureOptionsType['updateOptionData']
export type UpdateSectionDataType = FeatureOptionsType['updateSectionData']
