import { form_footer } from './Form.css'
import Group from '../Group/Group'
import Button from '../Button/Button'
import { validate } from '../../utils/form'
import { useLocation, useNavigate } from 'react-router-dom'
import { isEqual, startCase } from 'lodash'
import { useEffect } from 'react'
import { SectionName } from '../../types/form'
import { UseMutationResult } from '@tanstack/react-query'
import { FormDataType, FormInputType } from '../../types/form'
import { use } from 'react'
import { FormContext } from './FormContext'
import { FeatureContext } from './Features/FeatureContext'
import { routeRoot } from '../../utils/formatting'
import { sprinkles } from '../../css/sprinkles.css'

interface FooterProps<T extends FormDataType> {
  useAddNewItemMutation: () => UseMutationResult<T, Error, FormInputType, unknown>
  useUpdateItemMutation: () => UseMutationResult<T, Error, FormInputType, unknown>
}

const Footer = <T extends FormDataType>({ useAddNewItemMutation, useUpdateItemMutation }: FooterProps<T>) => {
  const navigate = useNavigate()
  const location = useLocation()

  const {
    validForm,
    setValidForm,
    steps,
    setStepIndex,
    formData,
    updateFormData,
    initialFormData,
    setSaving,
    setSuccessMessage,
    setErrorMessage,
    stepIndex,
    isFirstStep,
    isLastStep,
    setAddClass,
    setChangeRace,
  } = use(FormContext)

  const {
    featureData,
    updateFeatureData,
    initialFeatureData,
    featureIndex,
    ancestryData,
    updateAncestryData,
    initialAncestryData,
    optionData,
    updateOptionData,
    initialOptionData,
    optionIndex,
    subfeatureData,
    updateSubfeatureData,
    initialSubfeatureData,
    subfeatureIndex,
    sectionData,
    updateSectionData,
    initialSectionData,
    sectionIndex,
    sectionStep,
    setSectionStep,
    featureStep,
    setFeatureStep,
    handleSaveFeatures,
  } = use(FeatureContext)

  const {
    mutateAsync: addNewItem,
    isSuccess: addIsSuccess,
    isError: addIsError,
    error: addError,
  } = useAddNewItemMutation()

  const {
    mutateAsync: updateItem,
    isSuccess: updateIsSuccess,
    isError: updateIsError,
    error: updateError,
  } = useUpdateItemMutation()

  const forwardLabel = isLastStep
    ? featureStep != null
      ? 'Finish'
      : formData.id != null
      ? 'Update'
      : 'Create'
    : 'Next'

  const backLabel = isFirstStep ? 'Cancel' : 'Back'

  // Sucess Message
  useEffect(() => {
    if (updateIsSuccess) {
      setSuccessMessage(`${startCase(formData.__typename)} updated successfully!`)
      setErrorMessage(null)
    }
  }, [updateIsSuccess, formData.__typename, setErrorMessage, setSuccessMessage])

  // Error Message
  useEffect(() => {
    if (addIsError || updateIsError) {
      if (addError) {
        setErrorMessage((addError as any).message)
      }
      if (updateError) {
        setErrorMessage((updateError as any).message)
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

  const handleNavigateEdit = (item: any) => {
    const route = routeRoot(formData.__typename)
    navigate(`/${route}/${formData.value}/edit`, {
      state: { formData: item, previous: `/${route}` },
    })
    setStepIndex(0)
    setSaving(false)
  }

  const handleAlert = ({ alertType, message }: { alertType: string; message: string; index?: number }) => {
    navigate(`alert/${alertType}`, {
      state: {
        message: message,
        previous: location,
      },
    })
  }

  const handleSaveSection = () => {
    if (featureStep === 'subfeature') {
      updateSubfeatureData({
        type: 'update',
        path: `${sectionStep as Exclude<SectionName, 'options' | 'subfeatures'>}.${sectionIndex}`,
        value: sectionData,
      })
    } else if (featureStep === 'option') {
      updateOptionData({
        type: 'update',
        path: `${sectionStep as Exclude<SectionName, 'options' | 'subfeatures'>}.${sectionIndex}`,
        value: sectionData,
      })
    } else {
      if (formData.__typename === 'Feat') {
        updateFormData({
          type: 'update',
          path: `${sectionStep as Exclude<SectionName, 'subfeatures' | 'ancestries'> & 'ancestry'}.${sectionIndex}`,
          value: sectionData,
        })
      } else {
        if (steps[stepIndex].id === 'ancestry') {
          updateAncestryData({
            type: 'update',
            path: `features.${featureIndex}.${
              sectionStep as Exclude<SectionName, 'ancestries' | 'subfeatures'>
            }.${sectionIndex}`,
            value: sectionData,
          })
        } else {
          updateFeatureData({
            type: 'update',
            path: `${sectionStep as Exclude<SectionName, 'subfeatures'>}.${sectionIndex}`,
            value: sectionData,
          })
        }
      }
    }
    updateSectionData({ type: 'initialReset', value: sectionData })
    if (steps && steps?.length > 0) {
      setValidForm({ ...validForm, [steps[stepIndex].id]: true })
    }
    return setSectionStep(null)
  }

  const handleSaveSubfeature = () => {
    updateOptionData({
      type: 'update',
      path: `subfeatures.${subfeatureIndex}`,
      value: subfeatureData,
    })
    return setFeatureStep('option')
  }

  const handleSaveOption = () => {
    if (formData.__typename === 'Feat') {
      updateFormData<typeof formData>({
        type: 'update',
        path: `options.${optionIndex}`,
        value: optionData,
      })
      updateFormData<typeof formData>({
        type: 'initialReset',
        value: optionData,
      })
    } else {
      if (steps[stepIndex].id === 'ancestry') {
        updateAncestryData({
          type: 'update',
          path: `features.${featureIndex}.options.${optionIndex}`,
          value: optionData,
        })
      } else {
        updateFeatureData({
          type: 'update',
          path: `options.${optionIndex}`,
          value: optionData,
        })
      }
    }
    return setFeatureStep('feature')
  }

  // Save feature hierachy and clear states
  const handleSave = () => {
    if (sectionStep != null) {
      return handleSaveSection()
    }
    if (featureStep === 'subfeature') {
      return handleSaveSubfeature()
    }
    if (featureStep === 'option') {
      return handleSaveOption()
    }
    if (sectionStep == null && featureStep != null && formData.__typename !== 'Feat') {
      if (steps[stepIndex].id === 'ancestry') {
        if (featureStep === 'ancestry') {
          updateAncestryData({
            type: 'update',
            path: `features.${featureIndex}`,
            value: featureData,
          })
          return setFeatureStep('ancestryOption')
        }
        if (featureStep === 'ancestryOption') {
          updateFormData({
            type: 'update',
            path: `ancestry.options.${optionIndex}`,
            value: ancestryData,
          })
          return setFeatureStep(null)
        }
      } else {
        updateFormData({
          type: 'update',
          path: `features.${featureIndex}`,
          value: featureData,
        })
        return setFeatureStep(null)
      }
    }
    return updateFormData({ type: 'initialReset', value: formData })
  }

  const handleForward = async () => {
    const isValid = validate()
    if ((!isLastStep || (isLastStep && featureStep != null)) && formData.__typename !== 'Feat') {
      if (isValid) {
        setValidForm({ ...validForm, [steps[stepIndex].id]: true })
        if (featureStep != null) {
          setValidForm({ ...validForm, [steps[stepIndex].id]: true })
          return handleSave()
        }
        updateFormData({ type: 'initialReset', value: formData })
        return setStepIndex(stepIndex + 1)
      }
      setValidForm({ ...validForm, [steps[stepIndex].id]: false })
      if (featureStep != null) {
        return handleAlert({
          alertType: 'forward',
          message: 'Some required fields are missing. Current form step will not be saved.',
        })
      }
    }
    if ((isLastStep && featureStep == null) || (formData.__typename === 'Feat' && sectionStep == null)) {
      if (isValid) {
        setValidForm({ ...validForm, [steps[stepIndex].id]: true })
        if (Object.values(validForm).length > 0 && !Object.values(validForm).every((value) => value === true)) {
          return handleAlert({
            alertType: 'invalidForm',
            message: 'There are missing fields are required. Please review each step.',
          })
        }
        setSaving(true)
        const payload: any = await addNewItem(formData as FormInputType)
        if (payload) {
          return handleNavigateEdit(payload.formData.item)
        } else {
          return setErrorMessage('No formData returned')
        }
      }
    }
  }

  const handleBack = () => {
    if (isFirstStep) {
      if (!isEqual(initialFormData, formData)) {
        return handleAlert({
          alertType: 'back',
          message:
            formData.id != null
              ? `Changes have not been saved. Press 'Cancel' and then 'Update' to save changes. Otherwise, press 'Continue'`
              : `${formData.__typename} has not been created. Press 'Cancel' and then 'Create' at end of form to save. Otherwise, press 'Continue'.`,
        })
      }
      return navigate(-1)
    }
    const isValid = validate()
    if (isValid) {
      setValidForm({ ...validForm, [steps[stepIndex].id]: true })
      if (featureStep != null) {
        return handleSave()
      }
    } else {
      setValidForm({ ...validForm, [steps[stepIndex].id]: false })
    }
    if (featureStep != null) {
      return handleAlert({
        alertType: 'back',
        message: 'Some required fields are missing. Current form step will not be saved.',
      })
    }
    if (stepIndex <= 0) {
      return setStepIndex(stepIndex)
    } else {
      return setStepIndex(stepIndex - 1)
    }
  }

  const handleUpdate = async () => {
    setAddClass(false)
    setChangeRace(false)
    const isValid = validate()
    let formClone = JSON.parse(JSON.stringify(formData))
    if (isValid) {
      setValidForm({ ...validForm, [steps[stepIndex].id]: true })
      if (
        featureStep === 'subfeature' ||
        featureStep === 'option' ||
        (featureStep === 'feature' && formData.__typename !== 'Feat')
      ) {
        formClone = await handleSaveFeatures({ type: featureStep, state: formClone })
      }
      setValidForm({ ...validForm, [steps[stepIndex].id]: true })
      if (!(Object.values(validForm).length > 0) || Object.values(validForm).every((value) => value === true)) {
        try {
          await updateItem(formClone)
          updateFormData({
            type: 'initialReset',
            value: formClone,
          })
          return updateFormData({
            type: 'reset',
            value: formClone,
          })
        } catch (err: any) {
          console.log({ err })
          setErrorMessage(err.message)
        }
      }
    }
    return handleAlert({
      alertType: 'invalidForm',
      message: 'There are missing fields are required. Please review each step.',
    })
  }

  const handleReset = () => {
    if (sectionStep != null) {
      return updateSectionData({
        type: 'reset',
        value: initialSectionData,
      })
    }
    if (featureStep === 'subfeature') {
      return updateSubfeatureData({
        type: 'reset',
        value: initialSubfeatureData,
      })
    }
    if (featureStep === 'option') {
      return updateOptionData({
        type: 'reset',
        value: initialOptionData,
      })
    }
    if (featureStep === 'feature') {
      if (steps[stepIndex].id === 'ancestry') {
        return updateAncestryData({
          type: 'reset',
          value: initialAncestryData,
        })
      }
      return updateFeatureData({
        type: 'reset',
        value: initialFeatureData,
      })
    }
    return updateFormData({
      type: 'reset',
      value: initialFormData,
    })
  }

  return (
    <Group className={form_footer} justifyContentVariant={'spaceBetween'}>
      <Group>
        <Button color='main' type='button' onClick={handleBack} className={sprinkles({ marginRight: 'space-2' })}>
          {backLabel}
        </Button>
        <Button color='warning' type='button' onClick={handleReset}>
          Reset
        </Button>
      </Group>
      <Group>
        {formData.id != null && (!isLastStep || (isLastStep && featureStep != null)) && (
          <Button color='update' type='button' onClick={handleUpdate} className={sprinkles({ marginRight: 'space-2' })}>
            Update
          </Button>
        )}
        <Button
          color={forwardLabel === 'Update' ? 'update' : 'primary'}
          type='button'
          onClick={() => (isLastStep && featureStep == null && formData.id != null ? handleUpdate() : handleForward())}
        >
          {forwardLabel}
        </Button>
      </Group>
    </Group>
  )
}

export default Footer
