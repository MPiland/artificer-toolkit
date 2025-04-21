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
import { Navigate, useNavigate } from '@tanstack/react-router'
import { navigatePath } from '../../../utils/form'
import { type FormType } from '../../../types/form'

interface FooterProps<T extends FormDataType> {
  useAddNewItemMutation: () => UseMutationResult<T, Error, T, unknown>
  useUpdateItemMutation: () => UseMutationResult<T, Error, T, unknown>
}

const Footer = <T extends FormDataType>({ useAddNewItemMutation, useUpdateItemMutation }: FooterProps<T>) => {
  const navigate = useNavigate()
  const { showModal } = use(ModalContext)

  const { validForm, steps, formStore, stepIndex, isFirstStep, isLastStep } = use(FormContext)

  const { featureStore, ancestryStore, optionStore, sectionStore, handleSaveFeatures } = use(FeatureContext)

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
      : formStore.data.id != null ? 'Update'
      : 'Create'
    : 'Next'

  const backLabel = isFirstStep ? 'Cancel' : 'Back'

  // Sucess Message
  useEffect(() => {
    if (updateIsSuccess) {
      formStore.setSuccessMessage(`${startCase(formStore.data.__typename)} updated successfully!`)
      formStore.setErrorMessage(null)
    }
  }, [updateIsSuccess, formStore.data.__typename, formStore.setErrorMessage, formStore.setSuccessMessage])

  // Error Message
  useEffect(() => {
    if (addIsError || updateIsError) {
      if (addError) {
        formStore.setErrorMessage((addError as any).message)
      }
      if (updateError) {
        formStore.setErrorMessage((updateError as any).message)
      }
    }
  }, [addIsSuccess, updateIsSuccess, formStore, addIsError, updateIsError, addError, updateError])

  const handleNavigateEdit = (item: FormDataType) => {
    const route = routeRoot(formStore.data.__typename) as FormType
    const navPath = navigatePath({ form: route, type: 'form', action: 'edit', id: item.id })

    formStore.setStepIndex(0)
    formStore.setSaving(false)
    return navigate({ to: navPath.to, params: navPath.params })
  }

  const handleSaveSection = () => {
    if (sectionStore.step !== null) {
      if (featureStore.step === 'option') {
        optionStore.updateField({ path: `${sectionStore.step}.${sectionStore.index}`, value: sectionStore.data })
      } else {
        if (formStore.data.__typename === 'Feat') {
          formStore.updateField({
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
      formStore.setValidForm({ ...validForm, [steps[stepIndex].id]: true })
    }
    return sectionStore.setStep(null)
  }

  const handleSaveOption = () => {
    if (formStore.data.__typename === 'Feat') {
      formStore.updateField({
        path: `options.${optionStore.index}`,
        value: optionStore.data,
      })
      formStore.resetInit({ value: optionStore.data })
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
    if (sectionStore.step == null && featureStore.step != null && formStore.data.__typename !== 'Feat') {
      if (steps[stepIndex].id === 'ancestry') {
        if (featureStore.step === 'ancestry') {
          ancestryStore.updateField({
            path: `features.${featureStore.index}`,
            value: featureStore.data,
          })
          return featureStore.setStep('ancestryOption')
        }
        if (featureStore.step === 'ancestryOption') {
          formStore.updateField({
            path: `ancestry.options.${optionStore.index}`,
            value: ancestryStore.data,
          })
          return featureStore.setStep(null)
        }
      } else {
        formStore.updateField({
          path: `features.${featureStore.index}`,
          value: featureStore.data,
        })
        return featureStore.setStep(null)
      }
    }
    return formStore.resetInit({ value: formStore.data })
  }

  const handleForward = async () => {
    const isValid = validateForm()
    if ((!isLastStep || (isLastStep && featureStore.step != null)) && formStore.data.__typename !== 'Feat') {
      if (isValid) {
        formStore.setValidForm({ ...validForm, [steps[stepIndex].id]: true })
        if (featureStore.step != null) {
          formStore.setValidForm({ ...validForm, [steps[stepIndex].id]: true })
          return handleSave()
        }
        formStore.resetInit({ value: formStore.data })
        return formStore.setStepIndex(stepIndex + 1)
      }
      formStore.setValidForm({ ...validForm, [steps[stepIndex].id]: false })
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
    if (
      (isLastStep && featureStore.step == null) ||
      (formStore.data.__typename === 'Feat' && sectionStore.step == null)
    ) {
      if (isValid) {
        formStore.setValidForm({ ...validForm, [steps[stepIndex].id]: true })
        if (Object.values(validForm).length > 0 && !Object.values(validForm).every((value) => value === true)) {
          return showModal({
            type: 'alert',
            props: {
              message: 'Some required fields are missing. Current form step will not be saved.',
              onConfirm: handleConfirmForward,
            },
          })
        }
        formStore.setSaving(true)
        const payload = await addNewItem(formStore.data as T)
        if (payload) {
          return handleNavigateEdit(payload)
        } else {
          return formStore.setErrorMessage('No formStore.data returned')
        }
      }
    }
  }

  const handleBack = () => {
    if (isFirstStep) {
      if (!isEqual(featureStore.initData, formStore.data)) {
        return showModal({
          type: 'alert',
          props: {
            message:
              formStore.data.id != null ?
                `Changes have not been saved. Press 'Cancel' and then 'Update' to save changes. Otherwise, press 'Continue'`
              : `${formStore.data.__typename} has not been created. Press 'Cancel' and then 'Create' at end of form to save. Otherwise, press 'Continue'.`,
            onConfirm: handleConfirmBack,
          },
        })
      }
      return <Navigate to={'..'} />
    }
    const isValid = validateForm()
    if (isValid) {
      formStore.setValidForm({ ...validForm, [steps[stepIndex].id]: true })
      if (featureStore.step != null) {
        return handleSave()
      }
    } else {
      formStore.setValidForm({ ...validForm, [steps[stepIndex].id]: false })
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
      return formStore.setStepIndex(stepIndex)
    } else {
      return formStore.setStepIndex(stepIndex - 1)
    }
  }

  const handleUpdate = async () => {
    formStore.setAddClass(false)
    formStore.setChangeRace(false)
    const isValid = validateForm()
    let formClone: FormDataType = JSON.parse(JSON.stringify(formStore.data))
    if (isValid) {
      formStore.setValidForm({ ...validForm, [steps[stepIndex].id]: true })
      if (featureStore.step === 'option' || (featureStore.step === 'feature' && formStore.data.__typename !== 'Feat')) {
        formClone = await handleSaveFeatures({ type: featureStore.step, state: formClone })
      }
      if (!(Object.values(validForm).length > 0) || Object.values(validForm).every((value) => value === true)) {
        try {
          await updateItem(formClone as T)
          formStore.reinitState(formClone)
        } catch (err: any) {
          console.log(err)
          return formStore.setErrorMessage(err.message)
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
    return formStore.resetData({ value: featureStore.initData })
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
      formStore.setStepIndex(stepIndex - 1)
    }
  }

  const handleConfirmForward = () => {
    if (!isLastStep) {
      if (featureStore.step != null) {
        reset()
      }
      formStore.setStepIndex(stepIndex + 1)
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
        {formStore.data.id != null && (!isLastStep || (isLastStep && featureStore.step != null)) && (
          <Button color='update' type='button' onClick={handleUpdate} className={sprinkles({ marginRight: 'space-2' })}>
            Update
          </Button>
        )}
        <Button
          color={forwardLabel === 'Update' ? 'update' : 'primary'}
          type='button'
          onClick={() =>
            isLastStep && featureStore.step == null && formStore.data.id != null ? handleUpdate() : handleForward()
          }
        >
          {forwardLabel}
        </Button>
      </Group>
    </Group>
  )
}

export default Footer
