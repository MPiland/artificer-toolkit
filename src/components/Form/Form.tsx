import {
  error_message,
  form_header,
  form_wrapper,
  success_message,
} from './Form.css'
import { useEffect, useReducer, useState, useRef } from 'react'
import { get, set, startCase } from 'lodash'
import ProgressBar from './ProgressBar'
import useIsLoading from '../../hooks/useIsLoading'
import Spinner from '../Spinner/Spinner'
import DetailForm from './DetailForm'
import AttributeForm from './AttributeForm'
import TraitForm from './TraitForm'
import FeatureForm from './FeatureList'
import {
  FormContext,
  ReducerActionType,
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
import { clearBack } from '../../app/modalSlice'
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

interface FormProps {
  context: FormContext
  steps: Step[]
  state: any
  setState: (arg: ReducerActionType) => void
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
  state,
  setState,
  location,
  useAddNewItem,
  useUpdateItem,
  stepFilter,
}: FormProps) => {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const isLoading = useIsLoading()

  const confirmBack = useSelector((state: RootState) => state.modal.back)

  const [
    addNewItem,
    { isSuccess: addIsSuccess, isError: addIsError, error: addError },
  ] = useAddNewItem()

  const [
    updateItem,
    { isSuccess: updateIsSuccess, isError: updateIsError, error: updateError },
  ] = useUpdateItem()

  const [saving, setSaving] = useState<boolean>(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [stepIndex, setStepIndex] = useState<number>(0)
  const [isFirstStep, setIsFirstStep] = useState<boolean>(false)
  const [isLastStep, setIsLastStep] = useState<boolean>(false)
  // Form state
  const [formState, setFormState] = useReducer(formReducer, state)
  const [oldFormState, setOldFormState] = useState<any>(formState)
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

  const handleNavigateEdit = (id: number) => {
    const form = `${context.title === 'class' ? 'classe' : context.title}s`
    navigate(`/${form}/edit/${formState.name}`, {
      state: { data: id, previous: `/${form}` },
    })
    setStepIndex(0)
    setSaving(false)
  }

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

  // Confirm Alert back
  useEffect(() => {
    if (confirmBack.status) {
      dispatch(clearBack())
      navigate(-1)
    }
  }, [confirmBack.status, dispatch, navigate])

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

  // Add Ancestry step
  useEffect(() => {
    if (
      formState?.attribute?.some(
        (attributeItem: any) => attributeItem.name === 'ancestryOptions'
      ) &&
      !steps.includes('Ancestry')
    ) {
      steps.splice(2, 0, 'Ancestry')
    }
    if (
      !formState?.attribute?.some(
        (attributeItem: any) => attributeItem.name === 'ancestryOptions'
      ) &&
      steps.includes('Ancestry')
    ) {
      const index = steps.indexOf('Ancestry')
      steps.splice(index, 1)
    }
  }, [formState.attribute, steps])

  const handleAlert = ({
    context,
    message,
  }: {
    context: string
    message: string
  }) => {
    navigate(`/alert`, {
      state: {
        background: location,
        context: context,
        message: message,
      },
    })
  }

  // Save section form state
  const handleSaveFeatureSection = (clone?: any) => {
    const formClone = clone ? JSON.parse(JSON.stringify(clone)) : {}
    const arrayName = stepName === 'Ancestry' ? 'ancestry.option' : 'feature'
    const subArrayName = stepName === 'Ancestry' ? 'feature' : 'option'
    setOldSectionState(sectionState)
    if (context.title === 'feat') {
      if (featureContext === 'OptionContent') {
        // Set option state
        set(formClone, `option.${optionIndex}`, optionState)
        // Set option state section
        set(
          formClone,
          `option.${optionIndex}.${sectionName}.${sectionIndex}`,
          sectionState
        )
        setOldSectionState(sectionState)
        setOldOptionState(get(formClone, `option.${optionIndex}`))
        // Update form state
        setFormState({
          type: 'reset',
          target: {
            value: formClone,
          },
        })
        return formClone
      }
      // Set section state
      set(
        formClone,
        `${sectionName}.${sectionIndex}`,
        JSON.parse(JSON.stringify(sectionState))
      )
      // Update form state
      setFormState({
        type: 'reset',
        target: {
          value: formClone,
        },
      })
      return formClone
    }
    if (featureContext === 'OptionFeatureContent') {
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
      // Set option sub feature clone state
      set(
        formClone,
        `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}.feature.${subFeatureIndex}`,
        JSON.parse(JSON.stringify(subFeatureState))
      )
      // Set sub feature section clone state
      set(
        formClone,
        `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}.feature.${subFeatureIndex}.${sectionName}.${sectionIndex}`,
        JSON.parse(JSON.stringify(sectionState))
      )
      // Set old section state
      setOldSectionState(sectionState)
      // Set sub feature states
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
      // Set option states
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
      // Set feature states
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
    if (featureContext === 'OptionContent') {
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
      // Set option states
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
      // Set feature states
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
      console.log({ sectionOptionClone: formClone })
      return formClone
    }
    // Set feature clone state
    set(
      formClone,
      `${arrayName}.${featureIndex}`,
      JSON.parse(JSON.stringify(featureState))
    )
    // Set feature section clone state
    set(
      formClone,
      `${arrayName}.${featureIndex}.${subArrayName}.${optionIndex}.${sectionName}.${sectionIndex}`,
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
  const handleSaveFeatureOption = (clone?: any) => {
    const formClone = clone ? JSON.parse(JSON.stringify(clone)) : {}
    const arrayName = stepName === 'Ancestry' ? 'ancestry.option' : 'feature'
    const subArrayName = stepName === 'Ancestry' ? 'feature' : 'option'
    if (context.title === 'feat') {
      // Set option state
      set(
        formClone,
        `option.${optionIndex}`,
        JSON.parse(JSON.stringify(optionState))
      )
      setOldOptionState(optionState)
      // Update form state
      setFormState({
        type: 'reset',
        target: {
          value: formClone,
        },
      })
      return formClone
    }
    if (featureContext === 'OptionFeatureContent') {
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
        target: {
          name: `feature.${subFeatureIndex}`,
          value: subFeatureState,
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

  // Save feature form state
  const handleSaveFeature = (clone?: any) => {
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

  const handleUpdateFeature = async () => {
    let formClone = JSON.parse(JSON.stringify(formState))
    if (
      featureStepName === 'SectionContent' &&
      !isEqual(oldSectionState, sectionState)
    ) {
      formClone = handleSaveFeatureSection(formClone)
      return formClone
    }
    if (
      featureContext === 'OptionContent' &&
      !isEqual(oldOptionState, optionState)
    ) {
      formClone = handleSaveFeatureOption(formClone)
      return formClone
    }
    if (
      featureStepName === 'FeatureContent' &&
      !isEqual(oldFeatureState, featureState)
    ) {
      formClone = handleSaveFeature(formClone)
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
          if (context.title === 'feat') {
            setFormState({
              target: {
                name: `${sectionName}.${sectionIndex}`,
                value: sectionState,
              },
            })
          } else if (featureContext === 'OptionFeatureContent') {
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
            setFeatureState({
              target: {
                name: `${sectionName}.${sectionIndex}`,
                value: sectionState,
              },
            })
          }
          return setFeatureStepName('FeatureContent')
        }
        return
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
          return setFeatureContext('OptionContent')
        }
        return
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
        return
      }
      setFeatureContext('')
      return setFeatureStepName('FeatureContent')
    }
    if (featureStepName === 'FeatureContent') {
      if (!isEqual(featureState, oldFeatureState)) {
        if (isValid) {
          if (context.title !== 'feat') {
            const parentName =
              stepName === 'Ancestry' ? 'ancestry.option' : 'feature'
            setFormState({
              target: {
                name: `${parentName}.${featureIndex}`,
                value: featureState,
              },
            })
          }
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
    if (isValid) {
      if (featureStepName !== '') {
        return handleSave()
      }
      setOldFormState(formState)
      setStepIndex((prev: number) => prev + 1)
    }
    if (isLastStep && featureStepName === '') {
      setSaving(true)
      const payload = await addNewItem(formState)
      if ('data' in payload) {
        return handleNavigateEdit(payload.data.id)
      }
    }
  }

  const handleBack = () => {
    const isValid = validate()
    if (isFirstStep) {
      if (isValid) {
        if (!isEqual(state, formState)) {
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
    }
    if (!isFirstStep) {
      if (featureStepName !== '') {
        return handleSave()
      }
      if (isEqual(oldFormState, formState)) {
        if (isFirstStep) {
          return navigate(-1)
        }
      }
      setStepIndex((i: number) => {
        if (i <= 0) {
          return i
        } else {
          return i - 1
        }
      })
    }
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
        await updateItem(formClone)
        return setOldFormState(formClone)
      }
      setState({
        type: 'reset',
        target: { value: formState },
      })
      setOldFormState(formState)
      await updateItem(formState)
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

  const handleStepChange = (progressStepIndex: number) => {
    const isValid = validate()
    if (featureStepName !== '') {
      const formClone = handleUpdateFeature()
      if (isValid) {
        setFormState({
          type: 'reset',
          target: { value: formClone },
        })
      }
      setFeatureContext('')
      setFeatureStepName('')
      return setStepIndex(progressStepIndex)
    }
    if (
      (isEqual(formState, oldFormState) || isValid) &&
      featureStepName === ''
    ) {
      return setStepIndex(progressStepIndex)
    }
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
  }

  const featureProps = {
    formState,
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
      content: <FeatureForm {...commonProps} {...featureProps} />,
    },
    {
      name: 'Features',
      content: <FeatureForm {...commonProps} {...featureProps} />,
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
  ]

  return saving ? (
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
        <h1>
          {`${context.type === 'new' ? 'Create' : startCase(context.type)} ${
            context.title === 'item' ? ' An ' : ' A '
          }`}
          {startCase(context.title)}
          {formState?.value && ` (${formState.value})`}
        </h1>
        {errorMessage && <span className={error_message}>{errorMessage}</span>}
        {successMessage && (
          <span className={success_message}>{successMessage}</span>
        )}
      </div>
      {isLoading ? (
        <Spinner />
      ) : (
        <>
          {formSteps[
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
          ]?.name === 'Features' ? (
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
