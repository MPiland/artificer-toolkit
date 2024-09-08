import { useState, useReducer, ReactElement } from 'react'
import formReducer from '../../../hooks/useReducer'
import { FeatureContext } from './FeatureContext'
import { useForm } from '../../../hooks/UseForm'
import { FeatureStepType, ReducerActionType, SectionNameType } from '../../../utils/types'
import Feats from './Sections/Feats'
import Spells from './Sections/Spells'
import Modifiers from './Sections/Modifiers'
import Senses from './Sections/Senses'
import Expertise from './Sections/Expertise'
import Proficiencies from './Sections/Proficiencies'
import Ancestry from './Sections/Ancestry'
import Options from './Options'
import Subfeature from './Subfeatures'
import { set, toLower } from 'lodash'
import Features from './Features'

export const FeatureProvider = ({ children }: { children: ReactElement | ReactElement[] }) => {
  const { context, formState, steps, stepIndex } = useForm()

  // Feature
  const [featureState, setFeatureState] = useReducer(formReducer, context && context.title === 'feats' ? formState : {})
  const [oldFeatureState, setOldFeatureState] = useState<any>({})
  const [featureIndex, setFeatureIndex] = useState<number>(0)
  const [subContext, setSubContext] = useState<FeatureStepType>('')
  // Option
  const [optionState, setOptionState] = useReducer(formReducer, {})
  const [oldOptionState, setOldOptionState] = useState<any>({})
  const [optionIndex, setOptionIndex] = useState<number>(0)
  // Section
  const [sectionState, setSectionState] = useReducer(formReducer, {})
  const [oldSectionState, setOldSectionState] = useState<any>({})
  const [sectionIndex, setSectionIndex] = useState<number>(0)
  const [sectionName, setSectionName] = useState<SectionNameType>('')
  // Subfeature
  const [subfeatureState, setSubfeatureState] = useReducer(formReducer, {})
  const [oldSubfeatureState, setOldSubfeatureState] = useState({})
  const [subfeatureIndex, setSubfeatureIndex] = useState<number>(0)

  const sectionSteps: {
    [K in SectionNameType]?: ReactElement
  } = {
    feats: <Feats />,
    senses: <Senses />,
    spells: <Spells />,
    modifiers: <Modifiers />,
    expertise: <Expertise />,
    proficiencies: <Proficiencies />,
    ancestry: <Ancestry />,
  }

  const featureSteps: {
    [K in FeatureStepType]?: ReactElement
  } = {
    feature: <Features />,
    subfeature: <Subfeature />,
    option: <Options />,
  }

  const sectionNames: SectionNameType[] = Array.from(Object.keys(sectionSteps)) as SectionNameType[]
  sectionNames.push('options', 'features')
  sectionNames.sort((a: any, b: any) => a.localeCompare(b))

  const featureStateReset = () => {
    setSubContext('')
    setFeatureState({ type: 'reset', target: { value: {} } })
    setOldFeatureState({})
    setFeatureIndex(0)

    return Promise.resolve()
  }

  const optionStateReset = () => {
    setOptionState({ type: 'reset', target: { value: {} } })
    setOldOptionState({})

    return Promise.resolve()
  }

  const sectionStateReset = () => {
    setSectionState({ type: 'reset', target: { value: {} } })
    setOldSectionState({})

    return Promise.resolve()
  }

  const subfeatureStateReset = () => {
    setSubfeatureState({ type: 'reset', target: { value: {} } })
    setOldSubfeatureState({})

    return Promise.resolve()
  }

  const cloneAndSetStates = ({
    state,
    setState,
    setOldState,
  }: {
    state: any
    setState: (arg: ReducerActionType) => void
    setOldState: any
  }) => {
    setOldState(state)
    setState({
      type: 'reset',
      target: { value: state },
    })
  }

  const handleSaveFeatures = async ({ type, state }: { type: FeatureStepType; state: any }) => {
    const formClone = state ? JSON.parse(JSON.stringify(state)) : {}
    const arrayName = steps[stepIndex].id === 'ancestry' ? 'ancestry.options' : 'features'
    const subArrayName = steps[stepIndex].id === 'ancestry' ? 'features' : 'options'
    const paths = {
      subfeature: {
        feats: [
          `options.${optionIndex}`,
          `options.${optionIndex}.features.${subfeatureIndex}`,
          ...(sectionName !== ''
            ? [`options.${optionIndex}.features.${subfeatureIndex}.${sectionName}.${sectionIndex}`]
            : []),
        ],
        default: [
          `${arrayName}.${featureIndex}`,
          `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}`,
          `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}.features.${subfeatureIndex}`,
          ...(sectionName !== ''
            ? [
                `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}.features.${subfeatureIndex}.${sectionName}.${sectionIndex}`,
              ]
            : []),
        ],
      },
      option: {
        feats: [`options.${optionIndex}`, `options.${optionIndex}.${sectionName}.${sectionIndex}`],
        default: [
          `${arrayName}.${featureIndex}`,
          `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}`,
          ...(sectionName !== ''
            ? [`${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}.${sectionName}.${sectionIndex}`]
            : []),
        ],
      },
      feature: {
        feats: [...(sectionName !== '' ? [`${arrayName}.${featureIndex}.${sectionName}.${sectionIndex}`] : [])],
        default: [
          `${arrayName}.${featureIndex}`,
          ...(sectionName !== '' ? [`${arrayName}.${featureIndex}.${sectionName}.${sectionIndex}`] : []),
        ],
      },
    }

    const getContextPaths = ({ title }: { title: 'feats' | 'default' }): string[] => {
      const pathType = toLower(type) as 'subfeature' | 'option' | 'feature'
      return paths[pathType][title] || paths[pathType].default
    }

    const setStates = ({ title }: { title: 'feats' | 'default' }) => {
      const lowerType = toLower(type)
      const stateMap: { [s: string]: any[] } = {
        subfeature: [optionState, subfeatureState],
        option: [optionState],
        feature: [featureState],
      }

      const setStateMap: { [s: string]: ((arg: ReducerActionType) => void)[] } = {
        subfeature: [setOptionState, setSubfeatureState],
        option: [setOptionState],
        feature: [setFeatureState],
      }

      const setOldStateMap: { [s: string]: ((arg: any) => void)[] } = {
        subfeature: [setOldOptionState, setOldSubfeatureState],
        option: [setOldOptionState],
        feature: [setOldFeatureState],
      }

      if (sectionName !== '') {
        stateMap.subfeature.push(sectionState)
        setStateMap.subfeature.push(setSectionState)
        setStateMap.subfeature.push(setOldSectionState)
        stateMap.option.push(sectionState)
        setStateMap.option.push(setSectionState)
        setOldStateMap.option.push(setOldSectionState)
        stateMap.feature.push(sectionState)
        setStateMap.feature.push(setSectionState)
        setOldStateMap.feature.push(setOldSectionState)
      }

      const currentStates = stateMap[lowerType]
      const setStates = setStateMap[lowerType]
      const setOldStates = setOldStateMap[lowerType]
      const paths = getContextPaths({ title })

      Object.values(paths).forEach((path, index) => {
        if (index < currentStates.length) {
          set(formClone, path, JSON.parse(JSON.stringify(currentStates[index])))
          cloneAndSetStates({
            state: currentStates[index],
            setState: setStates[index],
            setOldState: setOldStates[index],
          })
        }
      })
    }

    setStates({ title: context.title === 'feats' ? 'feats' : 'default' })

    return formClone
  }

  const featureProps = {
    featureStateReset,
    subContext,
    setSubContext,
    featureState,
    setFeatureState,
    oldFeatureState,
    setOldFeatureState,
    featureIndex,
    setFeatureIndex,
    handleSaveFeatures,
    featureSteps,
  }

  const optionProps = {
    optionStateReset,
    optionState,
    setOptionState,
    oldOptionState,
    setOldOptionState,
    optionIndex,
    setOptionIndex,
  }

  const sectionProps = {
    sectionStateReset,
    sectionState,
    setSectionState,
    oldSectionState,
    setOldSectionState,
    sectionIndex,
    setSectionIndex,
    sectionNames,
    sectionName,
    setSectionName,
    sectionSteps,
  }

  const subfeatureProps = {
    subfeatureStateReset,
    subfeatureState,
    setSubfeatureState,
    oldSubfeatureState,
    setOldSubfeatureState,
    subfeatureIndex,
    setSubfeatureIndex,
  }

  return (
    <FeatureContext.Provider value={{ ...featureProps, ...optionProps, ...sectionProps, ...subfeatureProps }}>
      {children}
    </FeatureContext.Provider>
  )
}

export default FeatureProvider
