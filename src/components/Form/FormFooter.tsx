import { form_footer } from './Form.css'
import Group from '../Group/Group'
import Button from '../Button/Button'
import { validate } from '../../utils/formValidation'
import { BaseQueryFn, FetchArgs, FetchBaseQueryError, TypedUseMutation } from '@reduxjs/toolkit/query/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { isEqual, startCase } from 'lodash'
import { useContext, useEffect, useState } from 'react'
import { FormStepsContext } from './FormStepsContext'

interface FormFooterProps {
  useAddNewItem: TypedUseMutation<any, any, BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>>
  useUpdateItem: TypedUseMutation<any, any, BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>>
}

const FormFooterTest = ({ useAddNewItem, useUpdateItem }: FormFooterProps) => {
  const [confirmBack, setConfirmBack] = useState<boolean>(false)
  const [confirmForward, setConfirmForward] = useState<boolean>(false)
  const [alertTriggered, setAlertTriggered] = useState<boolean>(false)
  const navigate = useNavigate()
  const location = useLocation()

  const {
    validForm,
    setValidForm,
    filteredSteps,
    setStepIndex,
    isLastStep,
    isFirstStep,
    context,
    formState,
    setFormState,
    setOldFormState,
    oldFormState,
    setSaving,
    setSuccessMessage,
    setErrorMessage,
    stepName,
    handleUpdateFeature,
    handleSave,
    handleReset,
    featureStepName,
    stepIndex,
  } = useContext(FormStepsContext)

  const [addNewItem, { isSuccess: addIsSuccess, isError: addIsError, error: addError }] = useAddNewItem()

  const [updateItem, { isSuccess: updateIsSuccess, isError: updateIsError, error: updateError }] = useUpdateItem()

  // set confirm state based on alert response
  useEffect(() => {
    if (!confirmBack && alertTriggered) {
      const alertBack = location.state?.confirmBack
      if (alertBack) {
        setConfirmBack(true)
      }
    }
    if (!confirmForward && alertTriggered) {
      const alertForward = location.state?.confirmForward
      if (alertForward) {
        setConfirmForward(true)
      }
    }
  }, [confirmBack, alertTriggered, location.state?.confirmBack, location.state?.confirmForward, confirmForward])

  // Confirm Alert
  useEffect(() => {
    if (confirmForward && alertTriggered && !isLastStep) {
      if (featureStepName === '') {
        setConfirmForward(false)
        setAlertTriggered(false)
        setStepIndex(stepIndex + 1)
      }
    }
    if (confirmBack && alertTriggered && !isFirstStep) {
      if (featureStepName === '') {
        setConfirmBack(false)
        setAlertTriggered(false)
        setStepIndex(stepIndex - 1)
      }
    }
  }, [confirmForward, featureStepName, isLastStep, setStepIndex, stepIndex, isFirstStep, confirmBack, alertTriggered])

  const forwardLabel =
    featureStepName === '' ? (isLastStep ? (context.type === 'edit' ? 'Update' : 'Create') : 'Next') : 'Finish'

  const backLabel = isFirstStep ? 'Cancel' : 'Back'

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
    setErrorMessage,
    setSuccessMessage,
    addIsError,
    updateIsError,
    addError,
    updateError,
  ])

  const handleNavigateEdit = (item: any) => {
    const form = context
    navigate(`/${form}/edit/${formState.name}`, {
      state: { data: item, previous: `/${form}` },
    })
    setStepIndex(0)
    setSaving(false)
  }

  const handleAlert = ({ alertType, message, index }: { alertType: string; message: string; index?: number }) => {
    setAlertTriggered(true)
    navigate(`${location.pathname}/alert`, {
      state: {
        background: location,
        alertType: alertType,
        message: message,
        index: index,
      },
    })
  }

  const handleForward = async () => {
    const isValid = validate()
    if ((!isLastStep || (isLastStep && featureStepName !== '')) && context.title !== 'feat') {
      if (isValid) {
        setValidForm({ ...validForm, [filteredSteps[stepIndex]]: true })
        if (featureStepName !== '') {
          setValidForm({ ...validForm, [filteredSteps[stepIndex]]: true })
          return handleSave()
        }
        setOldFormState(formState)
        return setStepIndex(stepIndex + 1)
      }
      setValidForm({ ...validForm, [filteredSteps[stepIndex]]: false })
      if (featureStepName != '') {
        return handleAlert({
          alertType: 'forward',
          message: 'Some required fields are missing. Current form step will not be saved.',
        })
      }
    }
    if ((isLastStep && featureStepName === '') || (context.title === 'feat' && featureStepName === 'FeatureContent')) {
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
      setValidForm({ ...validForm, [filteredSteps[stepIndex]]: true })
      if (featureStepName !== '') {
        return handleSave()
      }
    } else {
      setValidForm({ ...validForm, [filteredSteps[stepIndex]]: false })
    }
    if (featureStepName != '') {
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
    const isValid = validate()
    if (isValid) {
      setValidForm({ ...validForm, [filteredSteps[stepIndex]]: true })
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
      setValidForm({ ...validForm, [filteredSteps[stepIndex]]: true })
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

  return (
    <Group className={form_footer} justifyContentVariant={'spaceBetween'}>
      <Group>
        <Button variant='default' type='button' onClick={handleBack}>
          {backLabel}
        </Button>
        <Button variant='warning' type='button' onClick={handleReset}>
          Reset
        </Button>
      </Group>
      <Group>
        {context.type === 'edit' && !isLastStep && (
          <Button variant='update' type='button' onClick={handleUpdate}>
            Update
          </Button>
        )}
        <Button variant={forwardLabel === 'Update' ? 'update' : 'primary'} type='button' onClick={handleForward}>
          {forwardLabel}
        </Button>
      </Group>
    </Group>
  )
}

export default FormFooterTest
