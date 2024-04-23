import { error_message, form_header, form_wrapper, success_message } from './Form.css'
import { useEffect, useReducer, useState, useRef, useMemo, useCallback } from 'react'
import { get, set, startCase } from 'lodash'
import ProgressBar from './ProgressBar'
import Spinner from '../Spinner/Spinner'
import DetailForm from './Generic/DetailForm'
import AttributeForm from './Generic/AttributeForm'
import TraitForm from './Generic/TraitForm'
import { Step, FeatureStepName, FeatureContext, SectionName } from '../../utils/types'
import ContainsForm from './Generic/ContainsForm'
import ProficiencyForm from './Generic/ProficiencyForm'
import EquipmentForm from './Generic/EquipmentForm'
import formReducer from '../../hooks/useReducer'
import { useLocation, useNavigate } from 'react-router-dom'
import { validate } from '../../utils/formValidation'
import { isEqual } from 'lodash'
import FormFooter from './FormFooter'
import { useEventListener } from 'usehooks-ts'
import { BaseQueryFn, FetchArgs, FetchBaseQueryError, TypedUseMutation } from '@reduxjs/toolkit/query/react'
import FeatureList from './Feature/FeatureList'
import FeatureContent from './Feature/FeatureContent'
import SectionContent from './Feature/SectionContent'
import { sprinkles } from '../../css/sprinkles.css'
import { useGetBuildersQuery } from '../../features/builder/builderApiSlice'
import RaceSelectionForm from './Character/RaceSelectionForm'
import Group from '../Group/Group'
import Button from '../Button/Button'
import ClassSelectionForm from './Character/ClassSelectionForm'

interface FormProps {
  context: 'class' | 'spell' | 'race' | 'item' | 'feat' | 'option' | 'background' | 'character'
  steps: Step[]
  item?: any
  useAddNewItem: TypedUseMutation<any, any, BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>>
  useUpdateItem: TypedUseMutation<any, any, BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>>
  stepFilter?: {
    name: string
    value: string
    filter: Step
  }
}

const Form = ({ context, steps, useAddNewItem, useUpdateItem, stepFilter }: FormProps) => {
  const navigate = useNavigate()
  const location = useLocation()

  const { data: builders } = useGetBuildersQuery(undefined)

  const formItem = location.state?.item
  const defaultCategory = location.state?.defaultCategory
  const formType = location.state?.formType
  const confirmBack = location.state?.confirmBack
  const confirmForward = location.state?.confirmForward
  const confirmStep = location.state?.confirmStep
  const index = location.state?.index

  const [addNewItem, { isSuccess: addIsSuccess, isError: addIsError, error: addError }] = useAddNewItem()

  const [updateItem, { isSuccess: updateIsSuccess, isError: updateIsError, error: updateError }] = useUpdateItem()

  const [isLoading, setIsLoading] = useState<boolean>((formType === 'new' && formItem?._id) ?? false)
  const [saving, setSaving] = useState<boolean>(false)
  const [validForm, setValidForm] = useState<any>()
  const [formName, setFormName] = useState<string>()
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [stepIndex, setStepIndex] = useState<number>(0)
  const [isFirstStep, setIsFirstStep] = useState<boolean>(false)
  const [isLastStep, setIsLastStep] = useState<boolean>(false)
  // Form state
  const [formState, setFormState] = useReducer(formReducer, formItem ?? {})
  const [oldFormState, setOldFormState] = useState<any>(formItem ?? {})
  const [selectedRace, setSelectedRace] = useState<any>(null)
  const [changeRace, setChangeRace] = useState<boolean>(false)
  const [selectedClass, setSelectedClass] = useState<any[]>([])
  const [addClass, setAddClass] = useState<boolean>(false)
  const [featureStepName, setFeatureStepName] = useState<FeatureStepName>(context === 'feat' ? 'FeatureContent' : '')
  // Feature state
  const [featureState, setFeatureState] = useReducer(formReducer, context === 'feat' ? formState : {})
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
    const form = context
    navigate(`/${form}/edit/${formState.name}`, {
      state: { data: item, previous: `/${form}` },
    })
    setStepIndex(0)
    setSaving(false)
  }

  const handleShowDetail = useCallback(
    (item: any, context: string) => {
      navigate(`/${context}/${item.name}/short`, {
        state: {
          background: location,
          item: item,
          size: 'sm',
          context: context,
        },
      })
    },
    [location, navigate]
  )

  const commonProps = useMemo(() => {
    return {
      context: { type: formType, title: context },
      formState,
      setFormState,
      stepName,
      selectedRace,
      setSelectedRace,
      changeRace,
      setChangeRace,
      selectedClass,
      setSelectedClass,
      addClass,
      setAddClass,
      handleShowDetail,
    }
  }, [context, formType, formState, stepName, changeRace, selectedRace, selectedClass, addClass, handleShowDetail])

  const featureProps = useMemo(() => {
    return {
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
  }, [
    featureContext,
    featureStepName,
    featureState,
    optionState,
    sectionName,
    oldSectionState,
    subFeatureState,
    sectionState,
  ])

  const formSteps = useMemo(() => {
    return [
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
        content: <RaceSelectionForm {...commonProps} />,
      },
      {
        name: 'Class',
        content: <ClassSelectionForm {...commonProps} />,
      },
    ]
  }, [commonProps, featureProps])

  useEffect(() => {
    if (formSteps) {
      setFormName(
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
      )
    }
  }, [formState, formSteps, stepFilter, stepIndex, steps])

  // Set character defaults
  useEffect(() => {
    if (builders) {
      let formClone = JSON.parse(JSON.stringify(formState))
      if (context === 'character' && (!formState.ability || !(formState.ability.length > 0))) {
        const abilityArray: any[] = []
        builders.ability.type
          .filter((ability: any) => ability.name !== 'spellAbility')
          .forEach((ability: any) => abilityArray.push({ name: ability.name, value: ability.value, _id: ability._id }))
        formClone = { ...formClone, ability: [...abilityArray] }

        setFormState({
          type: 'reset',
          target: { value: formClone },
        })
      }

      console.log({ formState })

      if (context === 'character' && (!formState.skill || !(formState.skill.length > 0))) {
        let formClone = JSON.parse(JSON.stringify(formState))
        const skillArray: any[] = []
        if (formClone.skill) {
          builders.skill.type.forEach((skill: any) =>
            skillArray.push({
              name: skill.name,
              value: skill.value,
              _id: skill._id,
              ability: skill.ability,
            })
          )
        }
        formClone = { ...formClone, skill: [...skillArray] }

        setFormState({
          type: 'reset',
          target: { value: formClone },
        })
      }
    }
  }, [builders, context, formState])

  // Set Valid default
  useEffect(() => {
    steps.forEach((step: string) => setValidForm((prev: any) => ({ ...prev, [`${step}`]: true })))
  }, [steps])

  // Reset a copy name
  useEffect(() => {
    if (formItem && formItem?.value !== '' && isLoading && formType === 'new') {
      setFormState({ target: { name: 'value', value: '' } })
      const oldFormItem = JSON.parse(JSON.stringify(formItem))
      oldFormItem.value = ''
      setOldFormState(oldFormItem)
    }
    setIsLoading(false)
  }, [isLoading, formItem, formType])

  // Set base category dropdown value
  useEffect(() => {
    if ((context === 'race' || context === 'class') && !formState.category?.name && defaultCategory) {
      setFormState({
        target: {
          name: 'category.name',
          value: defaultCategory,
        },
      })
    }

    if (formState.category?.name && !formState.category?.value) {
      let category = {}
      if (context === 'class') {
        category = builders?.class.category.find((categoryItem: any) => categoryItem.name === formState.category?.name)
      }
      if (context === 'race') {
        category = {
          ...builders?.race.category.find((categoryItem: any) => categoryItem.name === formState.category?.name),
        }
      }
      const formClone = formItem ? JSON.parse(JSON.stringify(formItem)) : {}
      set(formClone, 'category', category)
      setFormState({
        target: { name: 'category', value: category },
      })
      setOldFormState(formClone)
    }
  }, [
    builders?.class.category,
    builders?.race.category,
    context,
    formState.category?.name,
    formState.category?.value,
    setFormState,
    defaultCategory,
    formItem,
  ])

  // Inject form step based on attribute
  useEffect(() => {
    if (formItem?.attribute?.some((attributeItem: any) => attributeItem.name === 'containsItems')) {
      steps.push('Contains')
    }
  })

  // Filter any steps as needed
  useEffect(() => {
    setStepName(
      steps?.filter((step: Step) =>
        stepFilter && get(formState, stepFilter?.name) === stepFilter?.value ? step !== stepFilter?.filter : step
      )[stepIndex]
    )
  }, [stepIndex, steps, formState, stepFilter])

  // Last/First Step
  useEffect(() => {
    if (stepIndex === 0) {
      setIsFirstStep(true)
      setIsLastStep(false)
    } else if (
      stepIndex ===
      steps?.filter((step: Step) =>
        stepFilter && get(formState, stepFilter?.name) === stepFilter?.value ? step !== stepFilter?.filter : step
      ).length -
        1
    ) {
      setIsLastStep(true)
      setIsFirstStep(false)
    } else {
      setIsLastStep(false)
      setIsFirstStep(false)
    }
  }, [stepIndex, steps, formState, stepFilter])

  // Set formState if an item is being edited
  useEffect(() => {
    if ((formItem?._id && !formState._id) || (formItem && !formState)) {
      setFormState({ type: 'reset', target: { value: formItem } })
    }
  }, [formState, formItem])

  // Confirm Alert back
  useEffect(() => {
    if (confirmBack === true) {
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
        if (!isFirstStep) {
          setStepIndex((prev: number) => prev - 1)
        } else {
          navigate(-1)
        }
      }
    }
  }, [confirmBack, featureContext, featureStepName, isLastStep, isFirstStep, navigate])

  // Confirm Alert forward
  useEffect(() => {
    if (confirmForward === true) {
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
        } else {
          setStepIndex((prev: number) => prev + 1)
        }
      }
    }
  }, [confirmForward, featureContext, featureStepName, isLastStep, formName])

  // Confirm Alert step
  useEffect(() => {
    if (confirmStep === true) {
      if (featureStepName !== '') {
        setFeatureContext('')
        setFeatureStepName('')
      } else {
        setStepIndex(index as number)
      }
    }
  }, [confirmStep, index, featureStepName, formName])

  // Sucess Message
  useEffect(() => {
    if (updateIsSuccess) {
      setSuccessMessage(`${startCase(context)} updated successfully!`)
      setErrorMessage(null)
    }
  }, [updateIsSuccess, context, setErrorMessage, setSuccessMessage])

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
    setErrorMessage,
    setSuccessMessage,
    addIsError,
    updateIsError,
    addError,
    updateError,
  ])

  const handleAlert = ({ alertType, message, index }: { alertType: string; message: string; index?: number }) => {
    navigate(`${location.pathname}/alert`, {
      state: {
        background: location,
        alertType: alertType,
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
      if (context === 'feat') {
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
      if (context === 'feat') {
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
    if (context === 'feat') {
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
      if (context === 'feat') {
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
    if (context === 'feat') {
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
    if (featureStepName === 'FeatureContent' && !isEqual(oldFeatureState, featureState) && context !== 'feat') {
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
        if (context === 'feat') {
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
      setValidForm((prev: any) => ({ ...prev, [`${formName}`]: true }))
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
      if (context === 'feat') {
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

    if (featureStepName === 'FeatureContent' && context !== 'feat') {
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

  const handleForward = async () => {
    const isValid = validate()
    if ((!isLastStep || (isLastStep && featureStepName !== '')) && context !== 'feat') {
      if (isValid) {
        setValidForm((prev: any) => ({ ...prev, [`${formName}`]: true }))
        if (featureStepName !== '') {
          setValidForm((prev: any) => ({ ...prev, [`${formName}`]: true }))
          return handleSave()
        }
        setOldFormState(formState)
        return setStepIndex((prev: number) => prev + 1)
      }
      setValidForm((prev: any) => ({ ...prev, [`${formName}`]: false }))
      if (featureStepName != '') {
        return handleAlert({
          alertType: 'forward',
          message: 'Some required fields are missing. Current form step will not be saved.',
        })
      }
    }
    if ((isLastStep && featureStepName === '') || (context === 'feat' && featureStepName === 'FeatureContent')) {
      if (isValid) {
        if (!Object.values(validForm).every((value) => value === true)) {
          return handleAlert({
            alertType: 'invalidForm',
            message: 'There are missing fields are required. Please review each step.',
          })
        }
        setSaving(true)
        const payload: any = await addNewItem(formState)
        if (payload) {
          return handleNavigateEdit(payload.data.item)
        } else {
          return setErrorMessage('No data returned')
        }
      }
    }
  }

  const handleBack = () => {
    if (isFirstStep) {
      if (!isEqual(oldFormState, formState)) {
        return handleAlert({
          alertType: 'back',
          message:
            formType === 'edit'
              ? `Changes have not been saved. Press 'Cancel' and then 'Update' to save changes. Otherwise, press 'Continue'`
              : `${startCase(
                  context
                )} has not been created. Press 'Cancel' and then 'Create' at end of form to save. Otherwise, press 'Continue'.`,
        })
      }
      return navigate(-1)
    }
    const isValid = validate()
    if (isValid) {
      setValidForm((prev: any) => ({ ...prev, [`${formName}`]: true }))
      if (featureStepName !== '') {
        return handleSave()
      }
      return setStepIndex((i: number) => {
        if (i <= 0) {
          return i
        } else {
          return i - 1
        }
      })
    }
    setValidForm((prev: any) => ({ ...prev, [`${formName}`]: false }))
    if (featureStepName != '') {
      return handleAlert({
        alertType: 'back',
        message: 'Some required fields are missing. Current form step will not be saved.',
      })
    }
    return setStepIndex((i: number) => {
      if (i <= 0) {
        return i
      } else {
        return i - 1
      }
    })
  }

  const handleUpdate = async () => {
    const isValid = validate()
    if (isValid) {
      setValidForm((prev: any) => ({ ...prev, [`${formName}`]: true }))
      if (featureStepName !== '') {
        const formClone = await handleUpdateFeature()
        if (Object.values(validForm).every((value) => value === true)) {
          try {
            await updateItem(formClone)
          } catch (err: any) {
            setErrorMessage(err.data.message)
          }
          setOldFormState(formClone)
          return setFormState({
            type: 'reset',
            target: { value: formClone },
          })
        }
        return handleAlert({
          alertType: 'invalidForm',
          message: 'There are missing fields are required. Please review each step.',
        })
      }
      setValidForm((prev: any) => ({ ...prev, [`${formName}`]: true }))
      if (
        Object.entries(validForm)
          .filter(([key]) => key !== stepName)
          .every(([key]) => validForm[key] === true)
      ) {
        try {
          await updateItem(formState)
        } catch (err: any) {
          setErrorMessage(err.data.message)
        }
        setOldFormState(formState)
      }
    }
    return handleAlert({
      alertType: 'invalidForm',
      message: 'There are missing fields are required. Please review each step.',
    })
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

  const handleStepChange = async (progressStepIndex: number) => {
    const isValid = validate()
    if (isValid) {
      if (isEqual(formState, oldFormState) && featureStepName === '') {
        return setStepIndex(progressStepIndex)
      }
      setValidForm((prev: any) => ({ ...prev, [`${formName}`]: true }))
      const formClone = await handleUpdateFeature()
      setFormState({
        type: 'reset',
        target: { value: formClone },
      })
      setFeatureContext('')
      setFeatureStepName('')
      return setStepIndex(progressStepIndex)
    }
    setValidForm((prev: any) => ({ ...prev, [`${formName}`]: false }))
    if (featureStepName !== '') {
      // return handleAlert({
      //   context: 'step',
      //   message: 'Some required fields are missing. Current form step will not be saved.',
      //   index: progressStepIndex,
      // })
    }
    return setStepIndex(progressStepIndex)
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

  return isLoading || !formState || saving ? (
    <Spinner />
  ) : (
    <form className={form_wrapper}>
      {steps.length > 1 && (
        <ProgressBar
          currentStepIndex={stepIndex}
          steps={steps?.filter((step: Step) =>
            stepFilter && get(formState, stepFilter?.name) === stepFilter?.value ? step !== stepFilter?.filter : step
          )}
          handleStepChange={handleStepChange}
        />
      )}
      <div className={form_header}>
        <Group justifyContentVariant='spaceBetween'>
          <h1>
            {`${formType === 'new' ? 'Create' : startCase(formType)} ${context === 'item' ? ' An ' : ' A '}`}
            {startCase(context)}
            {formState?.value && ` (${formState.value})`}
          </h1>
          {selectedRace && stepName === 'Race' && !changeRace ? (
            <Button
              variant='warning'
              onClick={() => {
                setChangeRace(true)
              }}
            >
              Change Race
            </Button>
          ) : (
            selectedRace &&
            stepName === 'Race' && (
              <Button
                variant='primary'
                onClick={() => {
                  setChangeRace(false)
                }}
              >
                Keep Race
              </Button>
            )
          )}
          {selectedClass?.length > 0 && (
            <Button
              variant='warning'
              onClick={() => {
                setChangeRace(true)
              }}
            >
              Add Class
            </Button>
          )}
        </Group>
        {errorMessage && <span className={error_message}>{errorMessage}</span>}
        {successMessage && <span className={success_message}>{successMessage}</span>}
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
                    } (${featureContext !== '' ? optionState.value : featureState.value}${
                      featureContext === 'OptionFeatureContent'
                        ? subFeatureState.value
                          ? ` - ${subFeatureState.value}`
                          : ` - Sub-Feature ${subFeatureIndex + 1}`
                        : ''
                    })`}
                </h2>
                {featureStepName === 'FeatureContent' ? (
                  context === 'feat' ? (
                    <FeatureContent
                      formState={formState}
                      context={{ type: formType, title: context }}
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
                      formState={formState}
                      context={{ type: formType, title: context }}
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
                      formState={formState}
                      context={{ type: formType, title: context }}
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
                      formState={formState}
                      context={{ type: formType, title: context }}
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
                      formState={formState}
                      sectionName={sectionName}
                      featureState={subFeatureState}
                      setSectionState={setSectionState}
                      sectionState={sectionState}
                      context={{ type: formType, title: context }}
                    />
                  ) : featureContext === 'OptionContent' ? (
                    <SectionContent
                      formState={formState}
                      sectionName={sectionName}
                      featureState={optionState}
                      setSectionState={setSectionState}
                      sectionState={sectionState}
                      context={{ type: formType, title: context }}
                    />
                  ) : (
                    <SectionContent
                      formState={formState}
                      sectionName={sectionName}
                      featureState={featureState}
                      setSectionState={setSectionState}
                      sectionState={sectionState}
                      context={{ type: formType, title: context }}
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
                    stepFilter && get(formState, stepFilter?.name) === stepFilter?.value
                      ? step !== stepFilter?.filter
                      : step
                  )[stepIndex]
              )
            ]?.content
          )}
          <FormFooter
            handleBack={handleBack}
            forwardLabel={
              featureStepName === '' ? (isLastStep ? (formType === 'edit' ? 'Update' : 'Create') : 'Next') : 'Finish'
            }
            handleReset={() => handleReset()}
            handleForward={() => {
              if (isLastStep && formType === 'edit' && featureStepName === '') {
                handleUpdate()
              } else {
                handleForward()
              }
            }}
            backLabel={isFirstStep ? 'Cancel' : 'Back'}
            handleUpdate={() => handleUpdate()}
            isLastStep={isLastStep && featureStepName === ''}
            context={{ type: formType, title: context }}
          />
        </>
      )}
    </form>
  )
}

export default Form
