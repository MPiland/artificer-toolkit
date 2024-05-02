import { useState, useReducer, ReactNode, useMemo, useEffect } from 'react'
import formReducer from '../../hooks/useReducer'
import { set, get, isEqual } from 'lodash'
import { FormContext, FeatureContext, Step, FeatureStepName, SectionName } from '../../utils/types'
import Feature from './Feature/Feature'
import DetailForm from './Generic/DetailForm'
import TraitForm from './Generic/TraitForm'
import ContainsForm from './Generic/ContainsForm'
import ProficiencyForm from './Generic/ProficiencyForm'
import EquipmentForm from './Generic/EquipmentForm'
import RaceSelectionForm from './Character/RaceSelectionForm'
import ClassSelectionForm from './Character/ClassSelectionForm'
import AttributeForm from './Generic/AttributeForm'
import { FormStepsContext } from './FormStepsContext'

interface FormStepsProvider {
  children: ReactNode
  steps: Step[]
  stepFilter?: any
}

const FormStepsProvider = ({ children, steps, stepFilter }: FormStepsProvider) => {
  // Set initial state for reducer
  const initialFormState = {}

  const [context, setContext] = useState<FormContext>({ title: undefined, type: undefined })
  const [saving, setSaving] = useState<boolean>(false)
  const [formState, setFormState] = useReducer(formReducer, initialFormState)
  const [oldFormState, setOldFormState] = useState<any>({})
  const [stepIndex, setStepIndex] = useState<number>(0)
  const [isFirstStep, setIsFirstStep] = useState<boolean>(false)
  const [isLastStep, setIsLastStep] = useState<boolean>(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [stepName, setStepName] = useState<Step | []>(steps ? steps[stepIndex] : [])
  const [validForm, setValidForm] = useState<{ [key: string]: boolean }>()
  const [selectedClass, setSelectedClass] = useState<any[]>([])
  const [addClass, setAddClass] = useState<boolean>(false)
  const [selectedRace, setSelectedRace] = useState<any>(null)
  const [changeRace, setChangeRace] = useState<boolean>(false)

  // feature states
  const [featureStepName, setFeatureStepName] = useState<FeatureStepName>(
    context && context.title === 'feat' ? 'FeatureContent' : ''
  )
  // Feature
  const [featureState, setFeatureState] = useReducer(formReducer, context && context.title === 'feat' ? formState : {})
  const [oldFeatureState, setOldFeatureState] = useState<any>({})
  const [featureIndex, setFeatureIndex] = useState<number>(0)
  // Option
  const [optionState, setOptionState] = useReducer(formReducer, {})
  const [oldOptionState, setOldOptionState] = useState<any>({})
  const [optionIndex, setOptionIndex] = useState<number>(0)
  // Section
  const [sectionState, setSectionState] = useReducer(formReducer, {})
  const [oldSectionState, setOldSectionState] = useState<any>({})
  const [sectionIndex, setSectionIndex] = useState<number>(0)
  // Subfeature
  const [subFeatureState, setSubFeatureState] = useReducer(formReducer, {})
  const [oldSubFeatureState, setOldSubFeatureState] = useState<any>({})
  const [subFeatureIndex, setSubFeatureIndex] = useState<number>(0)
  const [featureContext, setFeatureContext] = useState<FeatureContext>('')
  const [sectionName, setSectionName] = useState<SectionName>('')

  // Standard possible form steps
  const formSteps = useMemo(() => {
    return [
      {
        name: 'Details',
        content: <DetailForm />,
      },
      {
        name: 'Attributes',
        content: <AttributeForm />,
      },
      {
        name: 'Traits',
        content: <TraitForm />,
      },
      {
        name: 'Ancestry',
        content: <Feature />,
      },
      {
        name: 'Background',
        content: <Feature />,
      },
      {
        name: 'Features',
        content: <Feature />,
      },
      {
        name: 'Contains',
        content: <ContainsForm />,
      },
      {
        name: 'Proficiencies',
        content: <ProficiencyForm />,
      },
      {
        name: 'Equipment',
        content: <EquipmentForm />,
      },
      {
        name: 'Race',
        content: <RaceSelectionForm />,
      },
      {
        name: 'Class',
        content: <ClassSelectionForm />,
      },
    ]
  }, [])

  const filteredSteps = steps?.filter((step: Step) =>
    stepFilter && get(formState, stepFilter?.name) === stepFilter?.value ? step !== stepFilter?.filter : step
  )

  // Inject form step based on attribute
  useEffect(() => {
    if (formState?.attribute?.some((attributeItem: any) => attributeItem.name === 'containsItems')) {
      steps.push('Contains')
    }
  })

  // Save section form state
  const handleSaveSectionContent = (clone?: any) => {
    const formClone = clone ? JSON.parse(JSON.stringify(clone)) : {}
    const arrayName = stepName === 'Ancestry' ? 'ancestry.option' : 'feature'
    const subArrayName = stepName === 'Ancestry' ? 'feature' : 'option'
    if (featureContext === 'OptionFeatureContent') {
      if (context.title === 'feat') {
        // Set option clone state
        set(formClone, `option.${optionIndex}`, JSON.parse(JSON.stringify(optionState)))
        // set option subfeature clone state
        set(formClone, `option.${optionIndex}.feature.${subFeatureIndex}`, JSON.parse(JSON.stringify(subFeatureState)))
        // Set option subfeature section clone state
        set(
          formClone,
          `option.${optionIndex}.feature.${subFeatureIndex}.${sectionName}.${sectionIndex}`,
          JSON.parse(JSON.stringify(sectionState))
        )
        setOldSectionState(sectionState)
        // Update option subfeature state
        setSubFeatureState({
          type: 'reset',
          target: {
            value: get(formClone, `option.${optionIndex}.feature.${subFeatureIndex}`),
          },
        })
        setOldSubFeatureState(get(formClone, `option.${optionIndex}.feature.${subFeatureIndex}`))
        // Update option state
        setOptionState({
          type: 'reset',
          target: {
            value: get(formClone, `option.${optionIndex}`),
          },
        })
        setOldOptionState(get(formClone, `option.${optionIndex}`))
        // Update form state
        setFormState({
          type: 'reset',
          target: { value: formClone },
        })
        return formClone
      }
      // If not feat
      // Set feature clone state
      set(formClone, `${arrayName}.${featureIndex}`, featureState)
      // Set option clone state
      set(
        formClone,
        `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}`,
        JSON.parse(JSON.stringify(optionState))
      )
      // set option subfeature clone state
      set(
        formClone,
        `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}.feature.${subFeatureIndex}`,
        JSON.parse(JSON.stringify(subFeatureState))
      )
      // Set option subfeature section clone state
      set(
        formClone,
        `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}.feature.${subFeatureIndex}.${sectionName}.${sectionIndex}`,
        JSON.parse(JSON.stringify(sectionState))
      )
      setOldSectionState(sectionState)
      // Update option subfeature state
      setSubFeatureState({
        type: 'reset',
        target: {
          value: get(
            formClone,
            `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}.feature.${subFeatureIndex}`
          ),
        },
      })
      setOldSubFeatureState(
        get(formClone, `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}.feature.${subFeatureIndex}`)
      )
      // Update option state
      setOptionState({
        type: 'reset',
        target: {
          value: get(formClone, `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}`),
        },
      })
      setOldOptionState(get(formClone, `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}`))
      // Update feature state
      setFeatureState({
        type: 'reset',
        target: {
          value: get(formClone, `${arrayName}.${featureIndex}`),
        },
      })
      setOldFeatureState(get(formClone, `${arrayName}.${featureIndex}`))
      // Update form state
      setFormState({
        type: 'reset',
        target: { value: formClone },
      })
      return formClone
    }
    if (featureContext === 'OptionContent') {
      if (context.title === 'feat') {
        // Set option clone state
        set(formClone, `option.${optionIndex}`, JSON.parse(JSON.stringify(optionState)))
        // Set option section clone state
        set(formClone, `option.${optionIndex}.${sectionName}.${sectionIndex}`, JSON.parse(JSON.stringify(sectionState)))
        setOldSectionState(sectionState)
        // Update option state
        setOptionState({
          type: 'reset',
          target: {
            value: get(formClone, `option.${optionIndex}`),
          },
        })
        setOldOptionState(get(formClone, `option.${optionIndex}`))
        // Update form state
        setFormState({
          type: 'reset',
          target: { value: formClone },
        })
        return formClone
      }
      // If not feat
      // Set feature clone state
      set(formClone, `${arrayName}.${featureIndex}`, JSON.parse(JSON.stringify(featureState)))
      // Set option clone state
      set(
        formClone,
        `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}`,
        JSON.parse(JSON.stringify(optionState))
      )
      // Set option section clone state
      set(
        formClone,
        `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}.${sectionName}.${sectionIndex}`,
        JSON.parse(JSON.stringify(sectionState))
      )
      setOldSectionState(sectionState)
      // Update option state
      setOptionState({
        type: 'reset',
        target: {
          value: get(formClone, `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}`),
        },
      })
      setOldOptionState(get(formClone, `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}`))
      // Update feature state
      setFeatureState({
        type: 'reset',
        target: {
          value: get(formClone, `${arrayName}.${featureIndex}`),
        },
      })
      setOldFeatureState(get(formClone, `${arrayName}.${featureIndex}`))
      // Update form state
      setFormState({
        type: 'reset',
        target: { value: formClone },
      })
      return formClone
    }
    // If not option nor subfeature
    if (context.title === 'feat') {
      // Set section clone state
      set(formClone, `${sectionName}.${sectionIndex}`, JSON.parse(JSON.stringify(sectionState)))
    }
    // If not feat
    // Set feature clone state
    set(formClone, `${arrayName}.${featureIndex}`, JSON.parse(JSON.stringify(featureState)))
    // Set feature section clone state
    set(
      formClone,
      `${arrayName}.${featureIndex}.${sectionName}.${sectionIndex}`,
      JSON.parse(JSON.stringify(sectionState))
    )
    setOldSectionState(sectionState)
    // Set feature states
    setFeatureState({
      type: 'reset',
      target: {
        value: get(formClone, `${arrayName}.${featureIndex}`),
      },
    })
    setOldFeatureState(get(formClone, `${arrayName}.${featureIndex}`))
    // Update form state
    setFormState({
      type: 'reset',
      target: {
        value: formClone,
      },
    })
    return formClone
  }

  // Save option form state
  const handleSaveOptionContent = (clone?: any) => {
    const formClone = clone ? JSON.parse(JSON.stringify(clone)) : {}
    const arrayName = stepName === 'Ancestry' ? 'ancestry.option' : 'feature'
    const subArrayName = stepName === 'Ancestry' ? 'feature' : 'option'
    if (featureContext === 'OptionFeatureContent') {
      if (context.title === 'feat') {
        // Set option state
        set(formClone, `option.${optionIndex}`, JSON.parse(JSON.stringify(optionState)))
        // Set sub feature state
        set(formClone, `option.${featureIndex}.feature.${subFeatureIndex}`, JSON.parse(JSON.stringify(subFeatureState)))
        setOldSubFeatureState(subFeatureState)
        // Set option state
        setOptionState({
          type: 'reset',
          target: { value: get(formClone, `option.${featureIndex}`) },
        })
        setOldOptionState(get(formClone, `option.${featureIndex}`))
        // Update form state
        setFormState({
          type: 'reset',
          target: {
            value: formClone,
          },
        })
        return formClone
      }
      // If not feat
      // Set feature state
      set(formClone, `${arrayName}.${featureIndex}`, JSON.parse(JSON.stringify(featureState)))
      // Set option state
      set(
        formClone,
        `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}`,
        JSON.parse(JSON.stringify(optionState))
      )
      // Set sub feature state
      set(
        formClone,
        `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}.feature.${subFeatureIndex}`,
        JSON.parse(JSON.stringify(subFeatureState))
      )
      // set old sub feature state
      setOldSubFeatureState(subFeatureState)
      setOptionState({
        type: 'reset',
        target: {
          value: get(formClone, `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}`),
        },
      })
      // Set old option state
      setOldOptionState(get(formClone, `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}`))
      // Set old feature state
      setFeatureState({
        type: 'reset',
        target: { value: get(formClone, `${arrayName}.${featureIndex}`) },
      })
      setOldFeatureState(get(formClone, `${arrayName}.${featureIndex}`))
      // Update form state
      setFormState({
        type: 'reset',
        target: {
          value: formClone,
        },
      })
      return formClone
    }
    // If not subfeature
    if (context.title === 'feat') {
      // Set option state
      set(formClone, `option.${optionIndex}`, JSON.parse(JSON.stringify(optionState)))
      // Set option state
      setOptionState({
        type: 'reset',
        target: { value: get(formClone, `option.${featureIndex}`) },
      })
      setOldOptionState(get(formClone, `option.${featureIndex}`))
      // Update form state
      setFormState({
        type: 'reset',
        target: {
          value: formClone,
        },
      })
      return formClone
    }
    // If not feat
    // Set feature state
    set(formClone, `${arrayName}.${featureIndex}`, JSON.parse(JSON.stringify(featureState)))
    // Set option state
    set(
      formClone,
      `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}`,
      JSON.parse(JSON.stringify(optionState))
    )
    // Set old option state
    setOldOptionState(optionState)
    // Set feature states
    setFeatureState({
      type: 'reset',
      target: {
        value: get(formClone, `${arrayName}.${featureIndex}`),
      },
    })
    setOldFeatureState(get(formClone, `${arrayName}.${featureIndex}`))
    // Update form state
    setFormState({
      type: 'reset',
      target: {
        value: formClone,
      },
    })
    return formClone
  }

  // Save feature form state if not feat or background
  const handleSaveFeatureContent = (clone?: any) => {
    const formClone = clone ? JSON.parse(JSON.stringify(clone)) : {}
    const arrayName = stepName === 'Ancestry' ? 'ancestry.option' : 'feature'
    set(formClone, `${arrayName}.${featureIndex}`, JSON.parse(JSON.stringify(featureState)))
    setOldFeatureState(featureState)
    setFormState({
      target: {
        name: `${arrayName}.${featureIndex}`,
        value: featureState,
      },
    })
    return formClone
  }

  // Update feature hierarchy and pass back updated formState
  const handleUpdateFeature = async () => {
    let formClone = JSON.parse(JSON.stringify(formState))
    if (featureStepName === 'SectionContent' && !isEqual(oldSectionState, sectionState)) {
      formClone = handleSaveSectionContent(formClone)
      return formClone
    }
    if (featureContext === 'OptionContent' && !isEqual(oldOptionState, optionState)) {
      formClone = handleSaveOptionContent(formClone)
      return formClone
    }
    if (featureStepName === 'FeatureContent' && !isEqual(oldFeatureState, featureState) && context.title !== 'feat') {
      formClone = handleSaveFeatureContent(formClone)
      return formClone
    }
    return formClone
  }

  // Save feature hierachy and clear states
  const handleSave = () => {
    if (featureStepName === 'SectionContent') {
      if (featureContext === 'OptionFeatureContent') {
        setSubFeatureState({
          target: {
            name: `${sectionName}.${sectionIndex}`,
            value: sectionState,
          },
        })
      } else if (featureContext === 'OptionContent') {
        setOptionState({
          target: {
            name: `${sectionName}.${sectionIndex}`,
            value: sectionState,
          },
        })
      } else {
        if (context.title === 'feat') {
          setFormState({
            target: {
              name: `${sectionName}.${sectionIndex}`,
              value: sectionState,
            },
          })
        }
        setFeatureState({
          target: {
            name: `${sectionName}.${sectionIndex}`,
            value: sectionState,
          },
        })
      }

      setOldSectionState(sectionState)
      setValidForm({ ...validForm, [filteredSteps[stepIndex]]: true })
      return setFeatureStepName('FeatureContent')
    }

    if (featureContext === 'OptionFeatureContent') {
      setOptionState({
        target: {
          name: `feature.${subFeatureIndex}`,
          value: subFeatureState,
        },
      })
      return setFeatureContext('OptionContent')
    }

    if (featureContext === 'OptionContent') {
      const parentName = stepName === 'Ancestry' ? 'feature' : 'option'
      if (context.title === 'feat') {
        setFormState({
          target: {
            name: `option.${optionIndex}`,
            value: optionState,
          },
        })
        /* Form Saving */
        setOldFormState(formState)
      }
      setFeatureState({
        target: {
          name: `${parentName}.${optionIndex}`,
          value: optionState,
        },
      })
      setFeatureContext('')
      return setFeatureStepName('FeatureContent')
    }

    if (featureStepName === 'FeatureContent' && context.title !== 'feat') {
      const parentName = stepName === 'Ancestry' ? 'ancestry.option' : 'feature'
      setFormState({
        target: {
          name: `${parentName}.${featureIndex}`,
          value: featureState,
        },
      })
      return setFeatureStepName('')
    }
    /* Form Saving */
    setOldFormState(formState)
  }

  const handleReset = () => {
    if (featureStepName === 'SectionContent') {
      return setSectionState({
        type: 'reset',
        target: { value: oldSectionState },
      })
    }
    if (featureContext === 'OptionFeatureContent') {
      return setSubFeatureState({
        type: 'reset',
        target: { value: oldSubFeatureState },
      })
    }
    if (featureContext === 'OptionContent') {
      return setOptionState({
        type: 'reset',
        target: { value: oldOptionState },
      })
    }
    if (featureStepName === 'FeatureContent') {
      return setFeatureState({
        type: 'reset',
        target: { value: oldFeatureState },
      })
    }
    setFormState({
      type: 'reset',
      target: { value: oldFormState },
    })
  }

  const formProps = {
    formSteps,
    formState,
    setFormState,
    oldFormState,
    setOldFormState,
    saving,
    setSaving,
    stepName,
    setStepName,
    stepIndex,
    setStepIndex,
    context,
    setContext,
    isFirstStep,
    setIsFirstStep,
    isLastStep,
    setIsLastStep,
    successMessage,
    setSuccessMessage,
    errorMessage,
    setErrorMessage,
    validForm,
    setValidForm,
    addClass,
    setAddClass,
    selectedClass,
    setSelectedClass,
    changeRace,
    setChangeRace,
    selectedRace,
    setSelectedRace,
    handleSave,
    handleUpdateFeature,
    handleReset,
    filteredSteps,
  }

  const sharedProperties = {
    sectionName,
    setSectionName,
    setFeatureStepName,
    featureContext,
    setFeatureContext,
    setSectionState,
    setOldSectionState,
    setSectionIndex,
    featureState,
    setFeatureState,
    oldFeatureState,
    setOldFeatureState,
    featureIndex,
    setFeatureIndex,
    oldOptionState,
    optionIndex,
    oldSectionState,
    sectionIndex,
    oldSubFeatureState,
    subFeatureIndex,
  }

  // Additional properties based on conditions
  const additionalProperties: any = {}

  if (featureStepName === 'FeatureContent') {
    additionalProperties.featureState = context && context.title === 'feat' ? formState : featureState
    additionalProperties.setFeatureState = context && context.title === 'feat' ? setFormState : setFeatureState
    additionalProperties.setOptionState = setOptionState
    additionalProperties.setOldOptionState = setOldOptionState
    additionalProperties.setOptionIndex = setOptionIndex
    additionalProperties.setSubFeatureState = setSubFeatureState
    additionalProperties.setOldSubFeatureState = setOldSubFeatureState
    additionalProperties.setSubFeatureIndex = setSubFeatureIndex
  }

  if (featureStepName === 'SectionContent') {
    additionalProperties.featureState = featureContext === 'OptionFeatureContent' ? subFeatureState : optionState
    additionalProperties.sectionState = sectionState
  }

  const featureProps = {
    ...sharedProperties,
    ...additionalProperties,
    featureStepName,
    setFeatureStepName,
    setOldFeatureState,
    setFeatureIndex,
  }

  return <FormStepsContext.Provider value={{ ...formProps, ...featureProps }}>{children}</FormStepsContext.Provider>
}

export default FormStepsProvider
