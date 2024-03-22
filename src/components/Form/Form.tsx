import {
  error_message,
  form_header,
  form_wrapper,
  success_message,
} from './Form.css'
import { useEffect, useReducer, useState, useRef } from 'react'
import { get, set, startCase } from 'lodash'
import ProgressBar from './ProgressBar'
import Spinner from '../Spinner/Spinner'
import DetailForm from './DetailForm'
import AttributeForm from './AttributeForm'
import TraitForm from './TraitForm'
import {
  FormContext,
  Step,
  FeatureStepName,
  FeatureContext,
  SectionName,
} from '../../utils/types'
import ContainsForm from './ContainsForm'
import ProficiencyForm from './ProficiencyForm'
import EquipmentForm from './EquipmentForm'
import formReducer from '../../hooks/useReducer'
import { useNavigate } from 'react-router-dom'
import { validate } from '../../utils/formValidation'
import { isEqual } from 'lodash'
import FormFooter from './FormFooter'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../app/store'
import { clearBack, clearForward, clearStep } from '../../app/modalSlice'
import { useEventListener } from 'usehooks-ts'
import {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
  TypedUseMutation,
} from '@reduxjs/toolkit/query/react'
import FeatureList from './FeatureList'
import FeatureContent from './FeatureContent'
import SectionContent from './SectionContent'
import { sprinkles } from '../../css/sprinkles.css'
import { useGetBuildersQuery } from '../../features/builder/builderApiSlice'
import RaceForm from './RaceForm'
import Group from '../Group/Group'
import Button from '../Button/Button'

interface FormProps {
  context: FormContext
  steps: Step[]
  item: any
  location: any
  useAddNewItem: TypedUseMutation<
    any,
    any,
    BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>
  >
  useUpdateItem: TypedUseMutation<
    any,
    any,
    BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>
  >
  stepFilter?: {
    name: string
    value: string
    filter: Step
  }
}

const Form = ({
  context,
  steps,
  item,
  location,
  useAddNewItem,
  useUpdateItem,
  stepFilter,
}: FormProps) => {
  const navigate = useNavigate()
  const dispatch = useDispatch()

  const confirmBack = useSelector((state: RootState) => state.modal.back)
  const confirmForward = useSelector((state: RootState) => state.modal.forward)
  const confirmStep = useSelector((state: RootState) => state.modal.step)

  const formData = location.state?.data
  const defaultCategory = location.state?.defaultCategory

  const [
    addNewItem,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewItem()

  const [
    updateItem,
    { isSuccess: updateIsSuccess, isError: updateIsError, error: updateError },
  ] = useUpdateItem()

  const [state, setState] = useReducer(
    formReducer,
    context.type === 'edit'
      ? formData
        ? formData
        : item
      : context.title === 'race' || context.title === 'class'
      ? { category: { name: defaultCategory } }
      : {}
  )
  const [oldState, setOldState] = useState(item)
  const [isLoading, setIsLoading] = useState<boolean>(
    (context.type === 'new' && formData?._id) ?? false
  )
  const [saving, setSaving] = useState<boolean>(false)
  const [validForm, setValidForm] = useState<boolean>(true)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [stepIndex, setStepIndex] = useState<number>(0)
  const [isFirstStep, setIsFirstStep] = useState<boolean>(false)
  const [isLastStep, setIsLastStep] = useState<boolean>(false)
  // Form state
  const [formState, setFormState] = useReducer(formReducer, state)
  const [oldFormState, setOldFormState] = useState<any>(formState)
  const [selectedRace, setSelectedRace] = useState<any>(null)
  const [changeRace, setChangeRace] = useState<boolean>(false)
  const [featureStepName, setFeatureStepName] = useState<FeatureStepName>(
    context.title === 'feat' ? 'FeatureContent' : ''
  )
  // Feature state
  const [featureState, setFeatureState] = useReducer(
    formReducer,
    context.title === 'feat' ? formState : {}
  )
  const [oldFeatureState, setOldFeatureState] = useState<any>({})
  const [featureIndex, setFeatureIndex] = useState<number>(0)
  // Option state
  const [optionState, setOptionState] = useReducer(formReducer, {})
  const [oldOptionState, setOldOptionState] = useState<any>({})
  const [optionIndex, setOptionIndex] = useState<number>(0)
  // Feature section state
  const [sectionState, setSectionState] = useReducer(formReducer, {})
  const [oldSectionState, setOldSectionState] = useState<any>({})
  const [sectionIndex, setSectionIndex] = useState<number>(0)
  // Subfeature state
  const [subFeatureState, setSubFeatureState] = useReducer(formReducer, {})
  const [oldSubFeatureState, setOldSubFeatureState] = useState<any>({})
  const [subFeatureIndex, setSubFeatureIndex] = useState<number>(0)
  const [featureContext, setFeatureContext] = useState<FeatureContext>('')
  const [sectionName, setSectionName] = useState<SectionName>('')
  const [stepName, setStepName] = useState<Step>(steps[stepIndex])

  const documentRef = useRef(document)

  const handleNavigateEdit = (item: any) => {
    const form = context.title
    navigate(`/${form}/edit/${formState.name}`, {
      state: { data: item, previous: `/${form}` },
    })
    setStepIndex(0)
    setSaving(false)
  }

  const { data: builders } = useGetBuildersQuery(undefined)

  // Reset state with formData or item
  useEffect(() => {
    if (
      state &&
      Object.keys(state).length === 0 &&
      (formData || item) &&
      context.type === 'edit'
    ) {
      if (formData && !isEqual(state, formData)) {
        setState({
          type: 'reset',
          target: { value: formData },
        })
      } else if (item && !isEqual(state, item)) {
        setState({
          type: 'reset',
          target: { value: item },
        })
      }
    }
  }, [item, state, state?.value, context, formData])

  // Reset a copy name
  useEffect(() => {
    if (state && state?.value !== '' && isLoading && context.type === 'new') {
      setState({ target: { name: 'value', value: '' } })
      setOldState(state)
    }
    setIsLoading(false)
  }, [state, state?.value, isLoading, context.type])

  useEffect(() => {
    if (item && !oldState) {
      setOldState(item)
    }
  }, [oldState, item])

  // Set base category dropdown value
  useEffect(() => {
    if (formState.category?.name && !formState.category?.value) {
      let category = {}
      if (context.title === 'class') {
        category = {
          ...builders?.class.category.find(
            (categoryItem: any) =>
              categoryItem.name === formState.category?.name
          ),
        }
      }
      if (context.title === 'race') {
        category = {
          ...builders?.race.category.find(
            (categoryItem: any) =>
              categoryItem.name === formState.category?.name
          ),
        }
      }
      const formClone = JSON.parse(JSON.stringify(state))
      set(formClone, 'category', category)
      setFormState({
        target: { name: 'category', value: category },
      })
      setOldFormState(formClone)
    }
  }, [
    builders?.class.category,
    builders?.race.category,
    context.title,
    formState.category?.name,
    formState.category?.value,
    setFormState,
    state,
  ])

  // Inject form step based on attribute
  useEffect(() => {
    if (
      state.attribute?.some(
        (attributeItem: any) => attributeItem.name === 'containsItems'
      )
    ) {
      steps.push('Contains')
    }
  })

  // Filter any steps as needed
  useEffect(() => {
    setStepName(
      steps?.filter((step: Step) =>
        stepFilter && get(formState, stepFilter?.name) === stepFilter?.value
          ? step !== stepFilter?.filter
          : step
      )[stepIndex]
    )
  }, [stepIndex, steps, formState, stepFilter])

  // Last/First Step
  useEffect(() => {
    if (stepIndex === 0) {
      setIsFirstStep(true)
    } else {
      setIsFirstStep(false)
    }
    if (
      stepIndex ===
      steps?.filter((step: Step) =>
        stepFilter && get(formState, stepFilter?.name) === stepFilter?.value
          ? step !== stepFilter?.filter
          : step
      ).length -
        1
    ) {
      setIsLastStep(true)
    } else {
      setIsLastStep(false)
    }
  }, [stepIndex, steps, formState, stepFilter])

  // Set formState
  useEffect(() => {
    if (state && !formState) {
      setFormState({ type: 'reset', target: { value: state } })
    }
  }, [state, formState])

  useEffect(() => {
    if (state.id && !formState.id) {
      setFormState({ type: 'reset', target: { value: state } })
    }
  }, [formState, state])

  // Confirm Alert back
  useEffect(() => {
    if (confirmBack.status === true) {
      if (featureStepName !== '') {
        if (featureStepName === 'SectionContent') {
          setFeatureStepName('FeatureContent')
        } else if (featureStepName === 'FeatureContent') {
          if (featureContext === 'OptionFeatureContent') {
            setFeatureContext('OptionContent')
          } else if (featureContext === 'OptionContent') {
            setFeatureContext('')
          } else {
            setFeatureStepName('')
          }
        }
      } else {
        setStepIndex((prev: number) => prev - 1)
      }
      dispatch(clearBack())
    }
  }, [
    confirmBack.status,
    dispatch,
    featureContext,
    featureStepName,
    isLastStep,
  ])

  // If Alert forward status is true
  useEffect(() => {
    if (confirmForward.status === true) {
      if (!isLastStep) {
        if (featureStepName !== '') {
          if (featureStepName === 'SectionContent') {
            setFeatureStepName('FeatureContent')
          } else if (featureStepName === 'FeatureContent') {
            if (featureContext === 'OptionFeatureContent') {
              setFeatureContext('OptionContent')
            } else if (featureContext === 'OptionContent') {
              setFeatureContext('')
            } else {
              setFeatureStepName('')
            }
          }
        } else {
          setStepIndex((prev: number) => prev + 1)
        }
        dispatch(clearForward())
      }
      setValidForm(false)
    }
  }, [
    confirmForward.status,
    dispatch,
    featureContext,
    featureStepName,
    isLastStep,
  ])

  // If Alert step status is true
  useEffect(() => {
    if (confirmStep.status === true) {
      setValidForm(false)
      if (featureStepName !== '') {
        setFeatureContext('')
        setFeatureStepName('')
      } else {
        setStepIndex(confirmStep.index as number)
        dispatch(clearStep())
      }
    }
  }, [confirmStep.status, dispatch, confirmStep.index, featureStepName])

  // Sucess Message
  useEffect(() => {
    if (updateIsSuccess) {
      setSuccessMessage(`${startCase(context.title)} updated successfully!`)
      setErrorMessage(null)
    }
  }, [updateIsSuccess, context.title, setErrorMessage, setSuccessMessage])

  // Error Message
  useEffect(() => {
    if (addIsError || updateIsError) {
      if (addError && 'data' in addError) {
        setErrorMessage((addError.data as any).message)
      }
      if (updateError && 'data' in updateError) {
        setErrorMessage((updateError.data as any).message)
      }
    }
  }, [
    addIsSuccess,
    updateIsSuccess,
    context.type,
    context.title,
    setErrorMessage,
    setSuccessMessage,
    addIsError,
    updateIsError,
    addError,
    updateError,
  ])

  const handleAlert = ({
    context,
    message,
    index,
  }: {
    context: string
    message: string
    index?: number
  }) => {
    navigate(`${location.pathname}/alert`, {
      state: {
        background: location,
        context: context,
        message: message,
        index: index,
      },
    })
  }

  // Save section form state
  const handleSaveSectionContent = (clone?: any) => {
    const formClone = clone ? JSON.parse(JSON.stringify(clone)) : {}
    const arrayName = stepName === 'Ancestry' ? 'ancestry.option' : 'feature'
    const subArrayName = stepName === 'Ancestry' ? 'feature' : 'option'
    if (featureContext === 'OptionFeatureContent') {
      if (context.title === 'feat') {
        // Set option clone state
        set(
          formClone,
          `option.${optionIndex}`,
          JSON.parse(JSON.stringify(optionState))
        )
        // set option subfeature clone state
        set(
          formClone,
          `option.${optionIndex}.feature.${subFeatureIndex}`,
          JSON.parse(JSON.stringify(subFeatureState))
        )
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
            value: get(
              formClone,
              `option.${optionIndex}.feature.${subFeatureIndex}`
            ),
          },
        })
        setOldSubFeatureState(
          get(formClone, `option.${optionIndex}.feature.${subFeatureIndex}`)
        )
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
        get(
          formClone,
          `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}.feature.${subFeatureIndex}`
        )
      )
      // Update option state
      setOptionState({
        type: 'reset',
        target: {
          value: get(
            formClone,
            `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}`
          ),
        },
      })
      setOldOptionState(
        get(
          formClone,
          `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}`
        )
      )
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
        set(
          formClone,
          `option.${optionIndex}`,
          JSON.parse(JSON.stringify(optionState))
        )
        // Set option section clone state
        set(
          formClone,
          `option.${optionIndex}.${sectionName}.${sectionIndex}`,
          JSON.parse(JSON.stringify(sectionState))
        )
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
      set(
        formClone,
        `${arrayName}.${featureIndex}`,
        JSON.parse(JSON.stringify(featureState))
      )
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
          value: get(
            formClone,
            `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}`
          ),
        },
      })
      setOldOptionState(
        get(
          formClone,
          `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}`
        )
      )
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
      set(
        formClone,
        `${sectionName}.${sectionIndex}`,
        JSON.parse(JSON.stringify(sectionState))
      )
    }
    // If not feat
    // Set feature clone state
    set(
      formClone,
      `${arrayName}.${featureIndex}`,
      JSON.parse(JSON.stringify(featureState))
    )
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
        set(
          formClone,
          `option.${optionIndex}`,
          JSON.parse(JSON.stringify(optionState))
        )
        // Set sub feature state
        set(
          formClone,
          `option.${featureIndex}.feature.${subFeatureIndex}`,
          JSON.parse(JSON.stringify(subFeatureState))
        )
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
      set(
        formClone,
        `${arrayName}.${featureIndex}`,
        JSON.parse(JSON.stringify(featureState))
      )
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
          value: get(
            formClone,
            `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}`
          ),
        },
      })
      // Set old option state
      setOldOptionState(
        get(
          formClone,
          `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}`
        )
      )
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
      set(
        formClone,
        `option.${optionIndex}`,
        JSON.parse(JSON.stringify(optionState))
      )
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
    set(
      formClone,
      `${arrayName}.${featureIndex}`,
      JSON.parse(JSON.stringify(featureState))
    )
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
    set(
      formClone,
      `${arrayName}.${featureIndex}`,
      JSON.parse(JSON.stringify(featureState))
    )
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
    if (
      featureStepName === 'SectionContent' &&
      !isEqual(oldSectionState, sectionState)
    ) {
      formClone = handleSaveSectionContent(formClone)
      return formClone
    }
    if (
      featureContext === 'OptionContent' &&
      !isEqual(oldOptionState, optionState)
    ) {
      formClone = handleSaveOptionContent(formClone)
      return formClone
    }
    if (
      featureStepName === 'FeatureContent' &&
      !isEqual(oldFeatureState, featureState) &&
      context.title !== 'feat'
    ) {
      formClone = handleSaveFeatureContent(formClone)
      return formClone
    }
    return formClone
  }

  // Save feature hierachy and clear states
  const handleSave = () => {
    const isValid = validate()
    if (featureStepName === 'SectionContent') {
      if (!isEqual(sectionState, oldSectionState)) {
        if (isValid) {
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
        }
      }
      return setFeatureStepName('FeatureContent')
    }
    if (featureContext === 'OptionFeatureContent') {
      if (!isEqual(subFeatureState, oldSubFeatureState)) {
        if (isValid) {
          setOptionState({
            target: {
              name: `feature.${subFeatureIndex}`,
              value: subFeatureState,
            },
          })
        }
      }
      return setFeatureContext('OptionContent')
    }
    if (featureContext === 'OptionContent') {
      if (!isEqual(optionState, oldOptionState)) {
        if (isValid) {
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
        }
      }
      setFeatureContext('')
      return setFeatureStepName('FeatureContent')
    }
    if (featureStepName === 'FeatureContent' && context.title !== 'feat') {
      if (!isEqual(featureState, oldFeatureState)) {
        if (isValid) {
          const parentName =
            stepName === 'Ancestry' ? 'ancestry.option' : 'feature'
          setFormState({
            target: {
              name: `${parentName}.${featureIndex}`,
              value: featureState,
            },
          })
          return setFeatureStepName('')
        }
        return
      }
      return setFeatureStepName('')
    }
    /* Form Saving */
    setOldFormState(formState)
  }

  const handleForward = async () => {
    const isValid = validate()
    if (!isLastStep || (isLastStep && featureStepName !== '')) {
      if (isValid) {
        if (featureStepName !== '') {
          setValidForm(true)
          return handleSave()
        }
        setOldFormState(formState)
        setStepIndex((prev: number) => prev + 1)
        return setValidForm(true)
      }
      return handleAlert({
        context: 'forward',
        message:
          'Some required fields are missing. Current form step will not be saved.',
      })
    }
    if (
      isLastStep &&
      (featureStepName === '' ||
        (context.title === 'feat' && featureStepName === 'FeatureContent'))
    ) {
      if (!validForm) {
        return handleAlert({
          context: 'invalidForm',
          message:
            'There are missing fields are required. Please review each step.',
        })
      }
      setSaving(true)
      const payload: any = await addNewItem(formState)
      if (payload) {
        return handleNavigateEdit(payload.data.item)
      } else {
        setErrorMessage('No data returned')
      }
    }
  }

  const handleBack = () => {
    if (isFirstStep) {
      if (!isEqual(oldFormState, formState)) {
        return handleAlert({
          context: 'back',
          message:
            context.type === 'edit'
              ? `Changes have not been saved. Press 'Cancel' and then 'Update' to save changes. Otherwise, press 'Continue'`
              : `${startCase(
                  context.title
                )} has not been created. Press 'Cancel' and then 'Create' at end of form to save. Otherwise, press 'Continue'.`,
        })
      }
      return navigate(-1)
    }
    const isValid = validate()
    if (isValid) {
      if (featureStepName !== '') {
        return handleSave()
      }
      if (isEqual(oldFormState, formState)) {
        if (isFirstStep) {
          return navigate(-1)
        }
      }
      return setStepIndex((i: number) => {
        if (i <= 0) {
          return i
        } else {
          return i - 1
        }
      })
    }
    handleAlert({
      context: 'back',
      message:
        'Some required fields are missing. Current form step will not be saved.',
    })
  }

  const handleUpdate = async () => {
    const isValid = validate()
    if (isValid) {
      if (featureStepName !== '') {
        const formClone = await handleUpdateFeature()
        setOldFormState(formClone)
        setState({
          type: 'reset',
          target: { value: formClone },
        })
        try {
          await updateItem(formState)
        } catch (err: any) {
          setErrorMessage(err.data.message)
        }
        setOldFormState(formClone)
        return setState({
          type: 'reset',
          target: { value: formState },
        })
      }
      try {
        await updateItem(formState)
      } catch (err: any) {
        setErrorMessage(err.data.message)
      } finally {
        setOldFormState(formState)
        setState({
          type: 'reset',
          target: { value: formState },
        })
      }
    }
  }

  const handleReset = () => {
    if (featureStepName === 'SectionContent') {
      return setSectionState({
        type: 'reset',
        target: { value: oldSectionState },
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

  const handleStepChange = async (progressStepIndex: number) => {
    const isValid = validate()
    if (isValid) {
      if (isEqual(formState, oldFormState) && featureStepName === '') {
        return setStepIndex(progressStepIndex)
      }
      setValidForm(true)
      const formClone = await handleUpdateFeature()
      setFormState({
        type: 'reset',
        target: { value: formClone },
      })
      setFeatureContext('')
      setFeatureStepName('')
      return setStepIndex(progressStepIndex)
    }
    return handleAlert({
      context: 'step',
      message:
        'Some required fields are missing. Current form step will not be saved.',
      index: progressStepIndex,
    })
  }

  useEventListener(
    'keypress',
    () => {
      if (successMessage !== null) {
        setSuccessMessage(null)
      }
      if (errorMessage) {
        setErrorMessage(null)
      }
    },
    documentRef
  )

  useEventListener(
    'mouseup',
    () => {
      if (successMessage !== null) {
        setSuccessMessage(null)
      }
      if (errorMessage) {
        setErrorMessage(null)
      }
    },
    documentRef
  )

  const commonProps = {
    context,
    formState,
    setFormState,
    stepName,
    selectedRace,
    setSelectedRace,
    changeRace,
    setChangeRace,
  }

  const featureProps = {
    featureContext,
    setFeatureContext,
    featureStepName,
    setFeatureStepName,
    featureState,
    setFeatureState,
    setOldFeatureState,
    setFeatureIndex,
    optionState,
    setOptionState,
    setOldOptionState,
    setOptionIndex,
    sectionState,
    setSectionState,
    oldSectionState,
    setOldSectionState,
    setSectionIndex,
    subFeatureState,
    setSubFeatureState,
    setOldSubFeatureState,
    setSubFeatureIndex,
    sectionName,
    setSectionName,
  }

  const formSteps = [
    {
      name: 'Details',
      content: <DetailForm {...commonProps} />,
    },
    {
      name: 'Attributes',
      content: <AttributeForm {...commonProps} />,
    },
    {
      name: 'Traits',
      content: <TraitForm {...commonProps} />,
    },
    {
      name: 'Ancestry',
      content: <FeatureList {...commonProps} {...featureProps} />,
    },
    {
      name: 'Background',
      content: <FeatureList {...commonProps} {...featureProps} />,
    },
    {
      name: 'Features',
      content: <FeatureList {...commonProps} {...featureProps} />,
    },
    {
      name: 'Contains',
      content: <ContainsForm {...commonProps} />,
    },
    {
      name: 'Proficiencies',
      content: <ProficiencyForm {...commonProps} />,
    },
    {
      name: 'Equipment',
      content: <EquipmentForm {...commonProps} />,
    },
    {
      name: 'Race',
      content: <RaceForm {...commonProps} />,
    },
  ]

  console.log({ formState: formState })

  const formName =
    formSteps[
      formSteps.findIndex(
        (step) =>
          step.name ===
          steps?.filter((step: Step) =>
            stepFilter && get(formState, stepFilter?.name) === stepFilter?.value
              ? step !== stepFilter?.filter
              : step
          )[stepIndex]
      )
    ]?.name

  return isLoading || !state || saving ? (
    <Spinner />
  ) : (
    <form className={form_wrapper}>
      {steps.length > 1 && (
        <ProgressBar
          currentStepIndex={stepIndex}
          steps={steps?.filter((step: Step) =>
            stepFilter && get(formState, stepFilter?.name) === stepFilter?.value
              ? step !== stepFilter?.filter
              : step
          )}
          handleStepChange={handleStepChange}
        />
      )}
      <div className={form_header}>
        <Group
          justifyContentVariant='spaceBetween'
          className={sprinkles({ mt: 'size-2', pb:'size-00' })}
        >
          <h1>
            {`${context.type === 'new' ? 'Create' : startCase(context.type)} ${
              context.title === 'item' ? ' An ' : ' A '
            }`}
            {startCase(context.title)}
            {formState?.value && ` (${formState.value})`}
          </h1>
          {formState?.race && stepName === 'Race' && (
            <Button
              variant='warning'
              onClick={() => {
                setChangeRace(true)
              }}
            >
              Change Race
            </Button>
          )}
        </Group>
        {errorMessage && <span className={error_message}>{errorMessage}</span>}
        {successMessage && (
          <span className={success_message}>{successMessage}</span>
        )}
      </div>
      {isLoading ? (
        <Spinner />
      ) : (
        <>
          {formName === 'Features' || formName === 'Ancestry' ? (
            featureStepName === '' ? (
              <FeatureList {...commonProps} {...featureProps} />
            ) : (
              <>
                <h2 className={sprinkles({ mb: 'size-2', px: 'size-4' })}>
                  {featureState.value != null &&
                    featureState.value !== '' &&
                    `${
                      stepName === 'Ancestry'
                        ? 'Ancestry'
                        : featureContext === 'OptionContent'
                        ? 'Option'
                        : featureContext === 'OptionFeatureContent'
                        ? 'Sub-Feature'
                        : 'Feature'
                    } (${
                      featureContext !== ''
                        ? optionState.value
                        : featureState.value
                    }${
                      featureContext === 'OptionFeatureContent'
                        ? subFeatureState.value
                          ? ` - ${subFeatureState.value}`
                          : ` - Sub-Feature ${subFeatureIndex + 1}`
                        : ''
                    })`}
                </h2>
                {featureStepName === 'FeatureContent' ? (
                  context.title === 'feat' ? (
                    <FeatureContent
                      state={formState}
                      context={context}
                      setSectionName={setSectionName}
                      setFeatureStepName={setFeatureStepName}
                      featureContext={featureContext}
                      setFeatureContext={setFeatureContext}
                      featureState={formState}
                      setFeatureState={setFormState}
                      setSectionState={setSectionState}
                      setOldSectionState={setOldSectionState}
                      setSectionIndex={setSectionIndex}
                      stepName={stepName}
                    />
                  ) : featureContext === 'OptionFeatureContent' ? (
                    <FeatureContent
                      state={formState}
                      context={context}
                      setSectionName={setSectionName}
                      setFeatureStepName={setFeatureStepName}
                      featureContext={featureContext}
                      setFeatureContext={setFeatureContext}
                      featureState={subFeatureState}
                      setFeatureState={setSubFeatureState}
                      setSubFeatureState={setSubFeatureState}
                      setOldSubFeatureState={setOldSubFeatureState}
                      setSubFeatureIndex={setSubFeatureIndex}
                      setSectionState={setSectionState}
                      setOldSectionState={setOldSectionState}
                      setSectionIndex={setSectionIndex}
                      stepName={stepName}
                    />
                  ) : featureContext === 'OptionContent' ? (
                    <FeatureContent
                      state={formState}
                      context={context}
                      setSectionName={setSectionName}
                      setFeatureStepName={setFeatureStepName}
                      featureContext={featureContext}
                      setFeatureContext={setFeatureContext}
                      featureState={optionState}
                      setFeatureState={setOptionState}
                      setOptionState={setOptionState}
                      setOldOptionState={setOldOptionState}
                      setOptionIndex={setOptionIndex}
                      setSectionState={setSectionState}
                      setOldSectionState={setOldSectionState}
                      setSectionIndex={setSectionIndex}
                      setSubFeatureState={setSubFeatureState}
                      setOldSubFeatureState={setOldSubFeatureState}
                      setSubFeatureIndex={setSubFeatureIndex}
                      stepName={stepName}
                    />
                  ) : (
                    <FeatureContent
                      state={formState}
                      context={context}
                      setSectionName={setSectionName}
                      setFeatureStepName={setFeatureStepName}
                      featureContext={featureContext}
                      setFeatureContext={setFeatureContext}
                      featureState={featureState}
                      setFeatureState={setFeatureState}
                      setOptionState={setOptionState}
                      setOldOptionState={setOldOptionState}
                      setOptionIndex={setOptionIndex}
                      setSectionState={setSectionState}
                      setOldSectionState={setOldSectionState}
                      setSectionIndex={setSectionIndex}
                      stepName={stepName}
                    />
                  )
                ) : (
                  featureStepName === 'SectionContent' &&
                  (featureContext === 'OptionFeatureContent' ? (
                    <SectionContent
                      state={formState}
                      sectionName={sectionName}
                      featureState={subFeatureState}
                      setSectionState={setSectionState}
                      sectionState={sectionState}
                    />
                  ) : featureContext === 'OptionContent' ? (
                    <SectionContent
                      state={formState}
                      sectionName={sectionName}
                      featureState={optionState}
                      setSectionState={setSectionState}
                      sectionState={sectionState}
                    />
                  ) : (
                    <SectionContent
                      state={formState}
                      sectionName={sectionName}
                      featureState={featureState}
                      setSectionState={setSectionState}
                      sectionState={sectionState}
                    />
                  ))
                )}
              </>
            )
          ) : (
            formSteps[
              formSteps.findIndex(
                (step) =>
                  step.name ===
                  steps?.filter((step: Step) =>
                    stepFilter &&
                    get(formState, stepFilter?.name) === stepFilter?.value
                      ? step !== stepFilter?.filter
                      : step
                  )[stepIndex]
              )
            ]?.content
          )}
          <FormFooter
            handleBack={handleBack}
            forwardLabel={
              featureStepName === ''
                ? isLastStep
                  ? context.type === 'edit'
                    ? 'Update'
                    : 'Create'
                  : 'Next'
                : 'Finish'
            }
            handleReset={() => handleReset()}
            handleForward={() => {
              if (
                isLastStep &&
                context.type === 'edit' &&
                featureStepName === ''
              ) {
                handleUpdate()
              } else {
                handleForward()
              }
            }}
            backLabel={isFirstStep ? 'Cancel' : 'Back'}
            handleUpdate={() => handleUpdate()}
            isLastStep={isLastStep && featureStepName === ''}
            context={context}
          />
        </>
      )}
    </form>
  )
}

export default Form
