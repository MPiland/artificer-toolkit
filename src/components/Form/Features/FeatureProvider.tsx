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
} from '../../../../amplify/gql/types'
import { FormContext } from '../FormContext'
import Expertise from './Sections/Expertise'
import AncestryFeatures from '../Ancestry/AncestryFeatures'
import { FeatureContext } from './FeatureContext'
import AncestryOptions from '../Ancestry/AncestryOptions'
import { useAncestryStore } from '../../../store/ancestryStore'
import { useOptionStore, type OptionStore } from '../../../store/optionStore'
import { useFeatureStore, type FeatureStore } from '../../../store/featureStore'
import { useSectionStore, type SectionStore } from '../../../store/sectionStore'

const useFeatureOptions = () => {
  const { formStore, steps, stepIndex } = use(FormContext)

  const ancestryStore = useAncestryStore((state) => state)
  const optionStore = useOptionStore((state) => state)
  const featureStore = useFeatureStore((state) => state)
  const sectionStore = useSectionStore((state) => state)

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
    updateData: Pick<UpdateState<T>, 'resetInit' | 'resetData'>
  }) => {
    updateData.resetInit({ value: state })
    updateData.resetData({ value: state })
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
          const optionIndex = optionStore.index
          const sectionStep = sectionStore.step
          const sectionIndex = sectionStore.index
          const pathArray: Array<DeepKeyOf<Feat>> = [`options.${optionIndex}`]
          if (sectionStep !== null) {
            pathArray.push(`options.${optionIndex}`, `options.${optionIndex}.${sectionStep}.${sectionIndex}`)
          }
          return pathArray
        },
        default: () => {
          const ancestryIndex = ancestryStore.index
          const featureIndex = featureStore.index
          const optionIndex = optionStore.index
          const sectionStep = sectionStore.step
          const sectionIndex = sectionStore.index
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
          const sectionStep = sectionStore.step
          const sectionIndex = sectionStore.index
          const featureIndex = featureStore.index
          const pathArray: Array<DeepKeyOf<Feat>> = []
          if (sectionStep !== null) {
            pathArray.push(`features.${featureIndex}.${sectionStep}.${sectionIndex}`)
          }
          return pathArray
        },
        default: () => {
          const ancestryIndex = ancestryStore.index
          const sectionStep = sectionStore.step
          const sectionIndex = sectionStore.index
          const featureIndex = featureStore.index
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
      | { type: 'option'; fns: OptionStore }
      | { type: 'feature'; fns: FeatureStore }
      | { type: 'section'; fns: SectionStore }

    const setStates = ({ title }: { title: 'feats' | 'default' }) => {
      const lowerType = toLower(type) as 'option' | 'feature'

      const sectionStep = sectionStore.step

      const stateMap: Record<
        'option' | 'feature',
        Array<FeatureOption | Feature | AncestryFeature | SectionDataType>
      > = {
        option: [optionStore.data],
        feature: [featureStore.data],
      }

      const updateFunctions: Record<'option' | 'feature', Array<UpdateFunction>> = {
        option: [{ type: 'option', fns: optionStore }],
        feature: [{ type: 'feature', fns: featureStore }],
      }

      if (sectionStep !== null) {
        stateMap.option.push(sectionStore.data)
        updateFunctions.option.push({ type: 'section', fns: sectionStore })
        stateMap.feature.push(sectionStore.data)
        updateFunctions.feature.push({ type: 'section', fns: sectionStore })
      }

      const featureStep = featureStore.step

      if (featureStep !== null) {
        const currentStates = stateMap[lowerType]
        const paths = getContextPaths({ title })

        Object.values(paths).forEach((path, index) => {
          if (index < currentStates.length) {
            set(formClone, path, JSON.parse(JSON.stringify(currentStates[index])))

            if (index === 0 && lowerType === 'option') {
              cloneAndSetStates<FeatureOption>({
                state: currentStates[index] as FeatureOption,
                updateData: optionStore,
              })
            } else if (index === 0 && lowerType === 'feature') {
              cloneAndSetStates<Feature | AncestryFeature>({
                state: currentStates[index] as Feature | AncestryFeature,
                updateData: featureStore,
              })
            } else {
              cloneAndSetStates<SectionDataType>({
                state: currentStates[index] as SectionDataType,
                updateData: sectionStore,
              })
            }
          }
        })
      }
    }

    setStates({ title: formStore.data.__typename === 'Feat' ? 'feats' : 'default' })

    return formClone
  }

  const featureProps = {
    handleSaveFeatures,
    featureSteps,
    isFeatureStep,
  }

  const sectionProps = {
    sectionSteps,
    sectionStepComponent,
    isSectionName,
  }

  return {
    ...featureProps,
    ...sectionProps,
    ancestryStore,
    featureStore,
    sectionStore,
    optionStore,
  }
}

const FeatureProvider = ({ children }: { children: ReactNode }) => {
  const featureOptions = useFeatureOptions()

  return <FeatureContext value={featureOptions}>{children}</FeatureContext>
}

export default FeatureProvider

export type FeatureOptionsType = ReturnType<typeof useFeatureOptions>

export type UpdateFeatureData = FeatureOptionsType['featureStore']
export type UpdateOptionData = FeatureOptionsType['optionStore']
export type UpdateSectionDataType = FeatureOptionsType['sectionStore']
