import { form_footer } from '../Form.css'
import Group from '../../Group/Group'
import Button from '../../Button/Button'
import { validateForm } from '../../../utils/form'
import { isEqual, startCase } from 'lodash'
import { useEffect } from 'react'
import { UseMutationResult } from '@tanstack/react-query'
import { FormDataType } from '../../../types/form'
import { use } from 'react'
import { FormContext } from '../FormContext'
import { FeatureContext } from '../Features/FeatureContext'
import { routeRoot } from '../../../utils/formatting'
import { sprinkles } from '../../../css/sprinkles.css'
import { ModalContext } from '../../Modal/ModalContext'
import { Navigate } from '@tanstack/react-router'
import { FormType, navigatePath } from '../../../utils/form'

interface FooterProps<T extends FormDataType> {
  useAddNewItemMutation: () => UseMutationResult<T, Error, T, unknown>
  useUpdateItemMutation: () => UseMutationResult<T, Error, T, unknown>
}

const Footer = <T extends FormDataType>({ useAddNewItemMutation, useUpdateItemMutation }: FooterProps<T>) => {
  const { showModal } = use(ModalContext)

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
    sectionData,
    updateSectionData,
    initialSectionData,
    sectionIndex,
    sectionStep,
    setSectionStep,
    featureStep,
    setFeatureStep,
    handleSaveFeatures,
    resetAncestry,
    resetFeature,
    resetOption,
    resetSection,
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

  const forwardLabel =
    isLastStep ?
      featureStep != null ? 'Finish'
      : formData.id != null ? 'Update'
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

  const handleNavigateEdit = (item: FormDataType) => {
    const route = routeRoot(formData.__typename) as FormType
    const navPath = navigatePath({ form: route, type: 'form', action: 'edit', label: item.label })

    setStepIndex(0)
    setSaving(false)
    return <Navigate to={navPath.path} params={navPath.params} />
  }

  const handleSaveSection = () => {
    if (sectionStep !== null) {
      if (featureStep === 'option') {
        updateOptionData({
          type: 'update',
          path: `${sectionStep}.${sectionIndex}`,
          value: sectionData,
        })
      } else {
        if (formData.__typename === 'Feat') {
          updateFormData({
            type: 'update',
            path: `${sectionStep}.${sectionIndex}`,
            value: sectionData,
          })
        } else {
          if (steps[stepIndex].id === 'ancestry') {
            updateAncestryData({
              type: 'update',
              path: `features.${featureIndex}.${sectionStep}.${sectionIndex}`,
              value: sectionData,
            })
          }
        }
      }
    }
    updateSectionData({ type: 'initialReset', value: sectionData })
    if (steps && steps?.length > 0) {
      setValidForm({ ...validForm, [steps[stepIndex].id]: true })
    }
    return setSectionStep(null)
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
    const isValid = validateForm()
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
        return showModal({
          type: 'alert',
          props: {
            message: 'Some required fields are missing. Current form step will not be saved.',
            onConfirm: handleConfirmForward,
          },
        })
      }
    }
    if ((isLastStep && featureStep == null) || (formData.__typename === 'Feat' && sectionStep == null)) {
      if (isValid) {
        setValidForm({ ...validForm, [steps[stepIndex].id]: true })
        if (Object.values(validForm).length > 0 && !Object.values(validForm).every((value) => value === true)) {
          return showModal({
            type: 'alert',
            props: {
              message: 'Some required fields are missing. Current form step will not be saved.',
              onConfirm: handleConfirmForward,
            },
          })
        }
        setSaving(true)
        const payload = await addNewItem(formData as T)
        if (payload) {
          return handleNavigateEdit(payload)
        } else {
          return setErrorMessage('No formData returned')
        }
      }
    }
  }

  const handleBack = () => {
    if (isFirstStep) {
      if (!isEqual(initialFormData, formData)) {
        return showModal({
          type: 'alert',
          props: {
            message:
              formData.id != null ?
                `Changes have not been saved. Press 'Cancel' and then 'Update' to save changes. Otherwise, press 'Continue'`
              : `${formData.__typename} has not been created. Press 'Cancel' and then 'Create' at end of form to save. Otherwise, press 'Continue'.`,
            onConfirm: handleConfirmBack,
          },
        })
      }
      return <Navigate to={'..'} />
    }
    const isValid = validateForm()
    if (isValid) {
      setValidForm({ ...validForm, [steps[stepIndex].id]: true })
      if (featureStep != null) {
        return handleSave()
      }
    } else {
      setValidForm({ ...validForm, [steps[stepIndex].id]: false })
    }
    if (featureStep != null) {
      return showModal({
        type: 'alert',
        props: {
          message: 'Some required fields are missing. Current form step will not be saved.',
          onConfirm: handleConfirmBack,
        },
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
    const isValid = validateForm()
    let formClone: FormDataType = JSON.parse(JSON.stringify(formData))
    if (isValid) {
      setValidForm({ ...validForm, [steps[stepIndex].id]: true })
      if (featureStep === 'option' || (featureStep === 'feature' && formData.__typename !== 'Feat')) {
        formClone = await handleSaveFeatures({ type: featureStep, state: formClone })
      }
      if (!(Object.values(validForm).length > 0) || Object.values(validForm).every((value) => value === true)) {
        try {
          await updateItem(formClone as T)
          updateFormData({
            type: 'initialReset',
            value: formClone,
          })
          return updateFormData({
            type: 'reset',
            value: formClone,
          })
        } catch (err: any) {
          console.log(err)
          return setErrorMessage(err.message)
        }
      }
    }
    if (featureStep != null) {
      return showModal({
        type: 'alert',
        props: {
          message: 'There are missing fields are required. Please review each step.',
        },
      })
    }
  }

  const handleReset = () => {
    if (sectionStep != null) {
      return updateSectionData({
        type: 'reset',
        value: initialSectionData,
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

  const reset = () => {
    if (sectionStep != null) {
      resetSection()
      setSectionStep(null)
    } else if (featureStep === 'option') {
      resetOption()
      setFeatureStep('feature')
    } else if (featureStep === 'ancestry') {
      resetFeature()
      setFeatureStep('ancestryOption')
    } else if (featureStep === 'ancestryOption') {
      resetAncestry()
      setFeatureStep(null)
    } else {
      resetFeature()
      setFeatureStep(null)
    }
  }

  const handleConfirmBack = () => {
    if (!isFirstStep) {
      if (featureStep != null) {
        reset()
      }
      setStepIndex(stepIndex - 1)
    }
  }

  const handleConfirmForward = () => {
    if (!isLastStep) {
      if (featureStep != null) {
        reset()
      }
      setStepIndex(stepIndex + 1)
    }
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
