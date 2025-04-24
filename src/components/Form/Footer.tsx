import { form_footer } from './Form.css'
import Group from '@/components/Group'
import Button from '@/components/Button'
import { isEqual, startCase } from 'lodash'
import { useEffect } from 'react'
import { UseMutationResult } from '@tanstack/react-query'
import { use } from 'react'
import { FormContext, FeatureContext, validateForm } from '@/components/Form'
import { routeRoot } from '@/utils'
import { sprinkles } from '@/css/sprinkles.css'
import { ModalContext } from '@/components/Modal'
import { Navigate, useNavigate } from '@tanstack/react-router'
import type { FormDataType, FormType } from '@/types'
import { useRouteNavigation } from '@/hooks'

interface FooterProps<T extends FormDataType> {
  useAddNewItemMutation: () => UseMutationResult<T, Error, T, unknown>
  useUpdateItemMutation: () => UseMutationResult<T, Error, T, unknown>
}

const Footer = <T extends FormDataType>({ useAddNewItemMutation, useUpdateItemMutation }: FooterProps<T>) => {
  const navigate = useNavigate()
  const { showModal } = use(ModalContext)
  const {
    formStore: {
      data,
      updateField,
      setStepIndex,
      setErrorMessage,
      setSuccessMessage,
      setValidForm,
      setSaving,
      setAddClass,
      setChangeRace,
      resetData,
      reinitState,
    },
    isFirstStep,
    isLastStep,
    steps,
    validForm,
    stepIndex,
  } = use(FormContext)
  const { featureStore, ancestryStore, optionStore, sectionStore, handleSaveFeatures } = use(FeatureContext)

  const form = routeRoot(data.__typename) as FormType
  const routeNav = useRouteNavigation(form)

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
      featureStore.step != null ? 'Finish'
      : data.id != null ? 'Update'
      : 'Create'
    : 'Next'

  const backLabel = isFirstStep ? 'Cancel' : 'Back'

  // Sucess Message
  useEffect(() => {
    if (updateIsSuccess) {
      setSuccessMessage(`${startCase(data.__typename)} updated successfully!`)
      setErrorMessage(null)
    }
  }, [updateIsSuccess, data.__typename, setSuccessMessage, setErrorMessage])

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
  }, [addIsSuccess, updateIsSuccess, addIsError, updateIsError, addError, updateError, setErrorMessage])

  const handleNavigateEdit = (item: FormDataType) => {
    setStepIndex(0)
    setSaving(false)
    const itemNav = routeNav.forItem(item.id, item.label)
    return navigate({ to: itemNav.edit.to, params: itemNav.edit.params, mask: itemNav.edit.mask })
  }

  const handleSaveSection = () => {
    if (sectionStore.step !== null) {
      if (featureStore.step === 'option') {
        optionStore.updateField({ path: `${sectionStore.step}.${sectionStore.index}`, value: sectionStore.data })
      } else {
        if (data.__typename === 'Feat') {
          updateField<typeof data>({
            path: `${sectionStore.step}.${sectionStore.index}`,
            value: sectionStore.data,
          })
        } else {
          if (steps[stepIndex].id === 'ancestry') {
            ancestryStore.updateField({
              path: `features.${featureStore.index}.${sectionStore.step}.${sectionStore.index}`,
              value: sectionStore.data,
            })
          }
        }
      }
    }
    sectionStore.resetInit({ value: sectionStore.data })
    if (steps && steps?.length > 0) {
      setValidForm({ ...validForm, [steps[stepIndex].id]: true })
    }
    return sectionStore.setStep(null)
  }

  const handleSaveOption = () => {
    if (data.__typename === 'Feat') {
      updateField<typeof data>({
        path: `options.${optionStore.index}`,
        value: optionStore.data,
      })
    } else {
      if (steps[stepIndex].id === 'ancestry') {
        ancestryStore.updateField({
          path: `features.${featureStore.index}.options.${optionStore.index}`,
          value: optionStore.data,
        })
      } else {
        featureStore.updateField({
          path: `options.${optionStore.index}`,
          value: optionStore.data,
        })
      }
    }
    return featureStore.setStep('feature')
  }

  // Save feature hierachy and clear states
  const handleSave = () => {
    if (sectionStore.step != null) {
      return handleSaveSection()
    }
    if (featureStore.step === 'option') {
      return handleSaveOption()
    }
    if (sectionStore.step == null && featureStore.step != null && data.__typename !== 'Feat') {
      if (steps[stepIndex].id === 'ancestry') {
        if (featureStore.step === 'ancestry') {
          ancestryStore.updateField({
            path: `features.${featureStore.index}`,
            value: featureStore.data,
          })
          return featureStore.setStep('ancestryOption')
        }
        if (featureStore.step === 'ancestryOption') {
          updateField<typeof data>({
            path: `ancestry.options.${optionStore.index}`,
            value: ancestryStore.data,
          })
          return featureStore.setStep(null)
        }
      } else {
        updateField<typeof data>({
          path: `features.${featureStore.index}`,
          value: featureStore.data,
        })
        return featureStore.setStep(null)
      }
    }
    return reinitState(data)
  }

  const handleForward = async () => {
    const isValid = validateForm()
    if ((!isLastStep || (isLastStep && featureStore.step != null)) && data.__typename !== 'Feat') {
      if (isValid) {
        setValidForm({ ...validForm, [steps[stepIndex].id]: true })
        if (featureStore.step != null) {
          setValidForm({ ...validForm, [steps[stepIndex].id]: true })
          return handleSave()
        }
        reinitState(data)
        return setStepIndex(stepIndex + 1)
      }
      setValidForm({ ...validForm, [steps[stepIndex].id]: false })
      if (featureStore.step != null) {
        return showModal({
          type: 'alert',
          props: {
            message: 'Some required fields are missing. Current form step will not be saved.',
            onConfirm: handleConfirmForward,
          },
        })
      }
    }
    if ((isLastStep && featureStore.step == null) || (data.__typename === 'Feat' && sectionStore.step == null)) {
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
        const payload = await addNewItem(data as T)
        if (payload) {
          return handleNavigateEdit(payload)
        } else {
          return setErrorMessage('No data returned')
        }
      }
    }
  }

  const handleBack = () => {
    if (isFirstStep) {
      if (!isEqual(featureStore.initData, data)) {
        return showModal({
          type: 'alert',
          props: {
            message:
              data.id != null ?
                `Changes have not been saved. Press 'Cancel' and then 'Update' to save changes. Otherwise, press 'Continue'`
              : `${data.__typename} has not been created. Press 'Cancel' and then 'Create' at end of form to save. Otherwise, press 'Continue'.`,
            onConfirm: handleConfirmBack,
          },
        })
      }
      return <Navigate to={'..'} />
    }
    const isValid = validateForm()
    if (isValid) {
      setValidForm({ ...validForm, [steps[stepIndex].id]: true })
      if (featureStore.step != null) {
        return handleSave()
      }
    } else {
      setValidForm({ ...validForm, [steps[stepIndex].id]: false })
    }
    if (featureStore.step != null) {
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
    let formClone: FormDataType = JSON.parse(JSON.stringify(data))
    if (isValid) {
      setValidForm({ ...validForm, [steps[stepIndex].id]: true })
      if (featureStore.step === 'option' || (featureStore.step === 'feature' && data.__typename !== 'Feat')) {
        formClone = await handleSaveFeatures({ type: featureStore.step, state: formClone })
      }
      if (!(Object.values(validForm).length > 0) || Object.values(validForm).every((value) => value === true)) {
        try {
          await updateItem(formClone as T)
          reinitState(formClone)
        } catch (err: any) {
          console.log(err)
          return setErrorMessage(err.message)
        }
      }
    }
    if (featureStore.step != null) {
      return showModal({
        type: 'alert',
        props: {
          message: 'There are missing fields are required. Please review each step.',
        },
      })
    }
  }

  const handleReset = () => {
    if (sectionStore.step != null) {
      return sectionStore.resetData({ value: sectionStore.initData })
    }
    if (featureStore.step === 'option') {
      return optionStore.resetData({ value: optionStore.initData })
    }
    if (featureStore.step === 'feature') {
      if (steps[stepIndex].id === 'ancestry') {
        return ancestryStore.resetData({ value: ancestryStore.initData })
      }
      return featureStore.resetData({ value: featureStore.initData })
    }
    return resetData({ value: featureStore.initData })
  }

  const reset = () => {
    if (sectionStore.step != null) {
      sectionStore.reinitState()
      return sectionStore.setStep(null)
    } else if (featureStore.step === 'option') {
      optionStore.reinitState()
      return featureStore.setStep('feature')
    } else if (featureStore.step === 'ancestryOption') {
      ancestryStore.reinitState()
      return featureStore.setStep(null)
    } else {
      featureStore.reinitState()
      if (featureStore.step === 'ancestry') {
        return featureStore.setStep('ancestryOption')
      }
      return featureStore.setStep(null)
    }
  }

  const handleConfirmBack = () => {
    if (!isFirstStep) {
      if (featureStore.step != null) {
        reset()
      }
      setStepIndex(stepIndex - 1)
    }
  }

  const handleConfirmForward = () => {
    if (!isLastStep) {
      if (featureStore.step != null) {
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
        {data.id != null && (!isLastStep || (isLastStep && featureStore.step != null)) && (
          <Button color='update' type='button' onClick={handleUpdate} className={sprinkles({ marginRight: 'space-2' })}>
            Update
          </Button>
        )}
        <Button
          color={forwardLabel === 'Update' ? 'update' : 'primary'}
          type='button'
          onClick={() =>
            isLastStep && featureStore.step == null && data.id != null ? handleUpdate() : handleForward()
          }
        >
          {forwardLabel}
        </Button>
      </Group>
    </Group>
  )
}

export default Footer
