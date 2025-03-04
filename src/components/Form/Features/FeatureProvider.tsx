import { ReactElement, use, ReactNode } from 'react'
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
import Ancestries from './Sections/Ancestries'
import Options from './Options'
import Subfeature from './Subfeatures'
import { set, toLower } from 'lodash'
import Features from './Features'
import {
  FeatureOption,
  Feature,
  FeatureSubfeature,
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
    subfeatureData,
    subfeatureIndex,
    initialSubfeatureData,
    addSubfeatureField,
    updateSubfeatureField,
    removeSubfeatureField,
    subfeatureReset,
    initialSubfeatureReset,
    updateSubfeatureIndex,
    resetSubfeature,
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
    ancestries: <Ancestries />,
  }

  const featureSteps: {
    [K in FeatureTypes]?: ReactElement
  } = {
    feature: <Features />,
    subfeature: <Subfeature />,
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

  const updateSubfeatureData = (state: UpdateState<FeatureSubfeature>) => {
    switch (state.type) {
      case 'add': {
        if (state.value) {
          addSubfeatureField({ path: state.path, value: state.value })
        } else {
          addSubfeatureField({ path: state.path })
        }
        break
      }
      case 'update':
        updateSubfeatureField({ path: state.path, value: state.value })
        break
      case 'remove':
        removeSubfeatureField({ path: state.path })
        break
      case 'reset':
        subfeatureReset({ value: state.value })
        break
      case 'initialReset':
        initialSubfeatureReset({ value: state.value })
        break
      case 'index':
        updateSubfeatureIndex({ value: state.value })
        break
    }
  }

  const updateSectionData = <T extends SectionDataType>(state: UpdateState<T>) => {
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
  }

  function isSectionName(key: string): key is SectionName {
    return sectionSteps.includes(key as SectionName)
  }

  function isFeatureStep(key: string): key is FeatureTypes {
    return featureTypes.includes(key as FeatureTypes)
  }

  const cloneAndSetStates = ({
    state,
    updateData,
  }: {
    state: Feature | AncestryFeature | SectionDataType | FeatureOption | FeatureSubfeature
    updateData: (
      arg: UpdateState<Feature | AncestryFeature | SectionDataType | FeatureOption | FeatureSubfeature>
    ) => void
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
      subfeature: {
        feats: Array<DeepKeyOf<Feat>>
        default: Array<DeepKeyOf<Class | Race | Omit<Equipment, 'contains'> | Background>>
      }
      option: {
        feats: Array<DeepKeyOf<Feat>>
        default: Array<DeepKeyOf<Class | Race | Omit<Equipment, 'contains'> | Background>>
      }
      feature: {
        feats: Array<DeepKeyOf<Feat>>
        default: Array<DeepKeyOf<Class | Race | Omit<Equipment, 'contains'> | Background>>
      }
    } = {
      subfeature: {
        feats: [
          `options.${optionIndex}`,
          `options.${optionIndex}.subfeatures.${subfeatureIndex}`,
          `options.${optionIndex}.subfeatures.${subfeatureIndex}.${
            sectionStep as Exclude<SectionName, 'options' | 'subfeatures' | 'features'>
          }`,
        ],
        default:
          steps[stepIndex].id === 'ancestry'
            ? [
                `ancestry.options.${ancestryIndex}`,
                `ancestry.options.${ancestryIndex}.features.${featureIndex}`,
                `ancestry.options.${ancestryIndex}.features.${featureIndex}.options.${optionIndex}`,
                `ancestry.options.${ancestryIndex}.features.${featureIndex}.options.${optionIndex}.subfeatures.${subfeatureIndex}`,
                `ancestry.options.${featureIndex}.features.${featureIndex}.options.${optionIndex}.subfeatures.${subfeatureIndex}.${
                  sectionStep as Exclude<SectionName, 'options' | 'ancestries' | 'subfeatures'>
                }.${sectionIndex}`,
              ]
            : [
                `features.${featureIndex}`,
                `features.${featureIndex}.options.${optionIndex}`,
                `features.${featureIndex}.options.${optionIndex}.subfeatures.${subfeatureIndex}`,
                `features.${featureIndex}.options.${optionIndex}.subfeatures.${subfeatureIndex}.${
                  sectionStep as Exclude<SectionName, 'options' | 'subfeatures' | 'features'>
                }.${sectionIndex}`,
              ],
      },
      option: {
        feats: [
          `options.${optionIndex}`,
          `options.${optionIndex}.${sectionStep as Exclude<SectionName, 'options' | 'features'>}.${sectionIndex}`,
        ],
        default:
          steps[stepIndex].id === 'ancestry'
            ? [
                `ancestry.options.${ancestryIndex}`,
                `ancestry.options.${ancestryIndex}.features.${featureIndex}`,
                `ancestry.options.${ancestryIndex}.features.${featureIndex}.options.${optionIndex}`,
                `ancestry.options.${ancestryIndex}.features.${featureIndex}.options.${optionIndex}.${
                  sectionStep as Exclude<SectionName, 'options' | 'features'>
                }.${sectionIndex}`,
              ]
            : [
                `features.${featureIndex}`,
                `features.${featureIndex}.options.${optionIndex}`,
                `features.${featureIndex}.options.${optionIndex}.${
                  sectionStep as Exclude<SectionName, 'options' | 'features'>
                }.${sectionIndex}`,
              ],
      },
      feature: {
        feats: [
          `features.${featureIndex}.${sectionStep as Exclude<SectionName, 'options' | 'subfeatures'>}.${sectionIndex}`,
        ],
        default:
          steps[stepIndex].id === 'ancestry'
            ? [
                `ancestry.options.${ancestryIndex}`,
                `ancestry.options.${ancestryIndex}.features.${featureIndex}`,
                `ancestry.options.${ancestryIndex}.features.${featureIndex}.${
                  sectionStep as Exclude<SectionName, 'subfeatures' | 'ancestries'>
                }.${sectionIndex}`,
              ]
            : [
                `features.${featureIndex}`,
                `features.${featureIndex}.${sectionStep as Exclude<SectionName, 'subfeatures'>}.${sectionIndex}`,
              ],
      },
    }

    const getContextPaths = ({ title }: { title: 'feats' | 'default' }): string[] => {
      const pathType = toLower(type) as 'subfeature' | 'option' | 'feature'
      return paths[pathType][title] || paths[pathType].default
    }

    const setStates = ({ title }: { title: 'feats' | 'default' }) => {
      const lowerType = toLower(type) as 'subfeature' | 'option' | 'feature'
      const stateMap: Record<
        'subfeature' | 'option' | 'feature',
        Array<FeatureSubfeature | FeatureOption | Feature | SectionDataType>
      > = {
        subfeature: [optionData, subfeatureData],
        option: [optionData],
        feature: [featureData],
      }

      const setDataMap: Record<
        'subfeature' | 'option' | 'feature',
        Array<(arg: UpdateState<Feature | SectionDataType | FeatureOption | FeatureSubfeature>) => void>
      > = {
        subfeature: [updateOptionData, updateSubfeatureData],
        option: [updateOptionData],
        feature: [updateFeatureData],
      }

      if (sectionStep !== null) {
        stateMap.subfeature.push(sectionData)
        setDataMap.subfeature.push(updateSectionData)
        stateMap.option.push(sectionData)
        setDataMap.option.push(updateSectionData)
        stateMap.feature.push(sectionData)
        setDataMap.feature.push(updateSectionData)
      }

      if (featureStep !== null) {
        const currentStates = stateMap[lowerType]
        const updateStates = setDataMap[lowerType]
        const paths = getContextPaths({ title })

        Object.values(paths).forEach((path, index) => {
          if (index < currentStates.length) {
            set(formClone, path, JSON.parse(JSON.stringify(currentStates[index])))
            cloneAndSetStates({
              state: currentStates[index],
              updateData: updateStates[index],
            })
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

  const subfeatureProps = {
    resetSubfeature,
    subfeatureData,
    initialSubfeatureData,
    updateSubfeatureData,
    subfeatureIndex,
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
    ...subfeatureProps,
    ...ancestryFeatureProps,
  }
}

const FeatureProvider = ({ children }: { children: ReactNode }) => {
  const featureOptions = useFeatureOptions()

  return <FeatureContext value={featureOptions}>{children}</FeatureContext>
}

export default FeatureProvider

export type FeatureOptionsType = ReturnType<typeof useFeatureOptions> | null

export type UpdateFeatureData = FeatureOptionsType['updateFeatureData']
export type UpdateOptionData = FeatureOptionsType['updateOptionData']
export type UpdateSectionDataType = FeatureOptionsType['updateSectionData']
export type UpdateSubfeatureData = FeatureOptionsType['updateSubfeatureData']
