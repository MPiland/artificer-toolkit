import { useState, ReactElement, createContext, use } from 'react'
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
  Subfeature as SubfeatureType,
  Feat,
  AncestryFeature,
  Class,
  Race,
  Equipment,
  Background,
} from '../../../../amplify/API'
import FormContext from '../FormContext'
import { useStore } from '../../../store/useStore'
import Expertise from './Sections/Expertise'
import RacesAncestries from '../Races/RaceAncestries'

export const FeatureOptions = () => {
  const { formData, steps, stepIndex } = use(FormContext)

  const {
    featureData,
    featureIndex,
    initialFeatureData,
    addFeatureField,
    updateFeatureField,
    removeFeatureField,
    featureReset,
    initialFeatureReset,
    updateFeatureIndex,
    optionData,
    optionIndex,
    initialOptionData,
    addOptionField,
    updateOptionField,
    removeOptionField,
    optionReset,
    initialOptionReset,
    updateOptionIndex,
    sectionData,
    sectionIndex,
    initialSectionData,
    addSectionField,
    updateSectionField,
    removeSectionField,
    sectionReset,
    initialSectionReset,
    updateSectionIndex,
    subfeatureData,
    subfeatureIndex,
    initialSubfeatureData,
    addSubfeatureField,
    updateSubfeatureField,
    removeSubfeatureField,
    subfeatureReset,
    initialSubfeatureReset,
    updateSubfeatureIndex,
    ancestryData,
    ancestryIndex,
    initialAncestryData,
    addAncestryField,
    updateAncestryField,
    removeAncestryField,
    ancestryReset,
    initialAncestryReset,
    updateAncestryIndex,
  } = useStore()

  const [sectionStep, setSectionStep] = useState<SectionName>(null)
  const [featureStep, setFeatureStep] = useState<FeatureTypes>(null)

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
    ancestry: <RacesAncestries />,
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

  const updateAncestryData = (state: UpdateState<AncestryFeature>) => {
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

  const updateSubfeatureData = (state: UpdateState<SubfeatureType>) => {
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

  const featureDataReset = () => {
    setFeatureStep(null)
    updateFeatureData({ type: 'reset', value: {} })
    updateFeatureData({ type: 'initialReset', value: {} })

    return Promise.resolve()
  }

  const optionDataReset = () => {
    updateOptionData({ type: 'reset', value: {} })
    updateOptionData({ type: 'initialReset', value: {} })

    return Promise.resolve()
  }

  const sectionDataReset = () => {
    updateSectionData({ type: 'reset', value: {} })
    updateSectionData({ type: 'initialReset', value: {} })

    return Promise.resolve()
  }

  const subfeatureDataReset = () => {
    updateSubfeatureData({ type: 'reset', value: {} })
    updateSubfeatureData({ type: 'initialReset', value: {} })

    return Promise.resolve()
  }

  const ancestryDataReset = () => {
    updateAncestryData({ type: 'reset', value: {} })
    updateAncestryData({ type: 'initialReset', value: {} })

    return Promise.resolve()
  }

  const cloneAndSetStates = ({
    state,
    updateData,
  }: {
    state: Feature | AncestryFeature | SectionDataType | FeatureOption | SubfeatureType
    updateData: (arg: UpdateState<Feature | AncestryFeature | SectionDataType | FeatureOption | SubfeatureType>) => void
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
            sectionStep as Exclude<SectionName, 'feats' | 'options' | 'subfeatures'>
          }`,
        ],
        default:
          steps[stepIndex].id === 'ancestry' && state.__typename === 'Race'
            ? [
                `ancestry.options.${featureIndex}`,
                `ancestry.options.${featureIndex}.features.${optionIndex}`,
                `ancestry.options.${featureIndex}.features.${optionIndex}.subfeatures.${subfeatureIndex}`,
                `ancestry.options.${featureIndex}.features.${optionIndex}.subfeatures.${subfeatureIndex}.${
                  sectionStep as Exclude<SectionName, 'feats' | 'options' | 'ancestries' | 'subfeatures'>
                }.${sectionIndex}`,
              ]
            : [
                `features.${featureIndex}`,
                `features.${featureIndex}.options.${optionIndex}`,
                `features.${featureIndex}.options.${optionIndex}.subfeatures.${subfeatureIndex}`,
                `features.${featureIndex}.options.${optionIndex}.subfeatures.${subfeatureIndex}.${
                  sectionStep as Exclude<SectionName, 'feats' | 'options' | 'subfeatures'>
                }.${sectionIndex}`,
              ],
      },
      option: {
        feats: [
          `options.${optionIndex}`,
          `options.${optionIndex}.${sectionStep as Exclude<SectionName, 'feats' | 'options'>}.${sectionIndex}`,
        ],
        default:
          steps[stepIndex].id === 'ancestry'
            ? [
                `ancestry.options.${featureIndex}`,
                `ancestry.options.${featureIndex}.features.${optionIndex}`,
                `ancestry.options.${featureIndex}.features.${optionIndex}.${
                  sectionStep as Exclude<SectionName, 'feats' | 'options' | 'ancestries'>
                }.${sectionIndex}`,
              ]
            : [
                `features.${featureIndex}`,
                `features.${featureIndex}.options.${optionIndex}`,
                `features.${featureIndex}.options.${optionIndex}.${
                  sectionStep as Exclude<SectionName, 'feats' | 'options'>
                }.${sectionIndex}`,
              ],
      },
      feature: {
        feats: [`features.${featureIndex}.${sectionStep as Exclude<SectionName, 'feats' | 'options'>}.${sectionIndex}`],
        default:
          steps[stepIndex].id === 'ancestry'
            ? [
                `ancestry.options.${featureIndex}`,
                `ancestry.options.${featureIndex}.${
                  sectionStep as Exclude<SectionName, 'feats' | 'options' | 'ancestries'> & 'features'
                }.${sectionIndex}`,
              ]
            : [`features.${featureIndex}`, `features.${featureIndex}.${sectionStep}.${sectionIndex}`],
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
        Array<SubfeatureType | FeatureOption | Feature | SectionDataType>
      > = {
        subfeature: [optionData, subfeatureData],
        option: [optionData],
        feature: [featureData],
      }

      const setDataMap: Record<
        'subfeature' | 'option' | 'feature',
        Array<(arg: UpdateState<Feature | SectionDataType | FeatureOption | SubfeatureType>) => void>
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

    setStates({ title: formData.__typename === 'Feat' ? 'feats' : 'default' })

    return formClone
  }

  const featureProps = {
    featureDataReset,
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
    optionDataReset,
    optionData,
    initialOptionData,
    updateOptionData,
    optionIndex,
  }

  const sectionProps = {
    sectionDataReset,
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
    subfeatureDataReset,
    subfeatureData,
    initialSubfeatureData,
    updateSubfeatureData,
    subfeatureIndex,
  }

  const ancestryFeatureProps = {
    ancestryDataReset,
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

type FeatureOptionsType = ReturnType<typeof FeatureOptions> | null

const FeatureContext = createContext<FeatureOptionsType>(undefined)

export default FeatureContext

export type UpdateFeatureData = FeatureOptionsType['updateFeatureData']
export type UpdateOptionData = FeatureOptionsType['updateOptionData']
export type UpdateSectionDataType = FeatureOptionsType['updateSectionData']
export type UpdateSubfeatureData = FeatureOptionsType['updateSubfeatureData']
