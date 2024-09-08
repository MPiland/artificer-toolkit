import { form_footer } from './Form.css'
import Group from '../Group/Group'
import Button from '../Button/Button'
import { validate } from '../../utils/form'
import { useLocation, useNavigate } from 'react-router-dom'
import { isEqual, startCase } from 'lodash'
import { useEffect } from 'react'
import { useForm } from '../../hooks/UseForm'
import { SectionNameType } from '../../utils/types'
import { useFeature } from '../../hooks/UseFeature'
import { UseMutationResult } from '@tanstack/react-query'
import { CustomError } from '../../app/api/api'

interface FooterProps {
  useAddNewItem: () => UseMutationResult<any, CustomError, string, unknown>
  useUpdateItem: () => UseMutationResult<any, CustomError, string, unknown>
}

const Footer = ({ useAddNewItem, useUpdateItem }: FooterProps) => {
  const navigate = useNavigate()
  const location = useLocation()

  const {
    validForm,
    setValidForm,
    steps,
    setStepIndex,
    context,
    formState,
    setFormState,
    setOldFormState,
    oldFormState,
    setSaving,
    setSuccessMessage,
    setErrorMessage,
    stepIndex,
    isFirstStep,
    isLastStep,
    setAddClass,
    setChangeRace,
  } = useForm()

  const {
    featureState,
    setFeatureState,
    oldFeatureState,
    featureIndex,
    optionState,
    setOptionState,
    oldOptionState,
    optionIndex,
    subfeatureState,
    setSubfeatureState,
    oldSubfeatureState,
    subfeatureIndex,
    sectionState,
    setSectionState,
    oldSectionState,
    setOldSectionState,
    sectionIndex,
    sectionName,
    setSectionName,
    subContext,
    setSubContext,
    handleSaveFeatures,
  } = useFeature()

  const { mutateAsync: addNewItem, isSuccess: addIsSuccess, isError: addIsError, error: addError } = useAddNewItem()

  const {
    mutateAsync: updateItem,
    isSuccess: updateIsSuccess,
    isError: updateIsError,
    error: updateError,
  } = useUpdateItem()

  const forwardLabel = isLastStep
    ? subContext !== ''
      ? 'Finish'
      : context.type === 'edit'
        ? 'Update'
        : 'Create'
    : 'Next'

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
    const form = context.title
    navigate(`/${form}/edit/${formState.name}`, {
      state: { data: item, previous: `/${form}` },
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

  // Save feature hierachy and clear states
  const handleSave = () => {
    if (sectionName !== '') {
      if (subContext === 'subfeature') {
        setSubfeatureState({
          target: {
            name: `${sectionName}.${sectionIndex}`,
            value: sectionState,
          },
        })
      } else if (subContext === 'option') {
        setOptionState({
          target: {
            name: `${sectionName}.${sectionIndex}`,
            value: sectionState,
          },
        })
      } else {
        if (context.title === 'feats') {
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
      if (steps && steps?.length > 0) {
        setValidForm({ ...validForm, [steps[stepIndex].id]: true })
      }
      return setSectionName('')
    }
    if (subContext === 'subfeature') {
      setOptionState({
        target: {
          name: `features.${subfeatureIndex}`,
          value: subfeatureState,
        },
      })
      return setSubContext('option')
    }
    if (subContext === 'option') {
      const parentName: SectionNameType = steps[stepIndex].id === 'ancestry' ? 'features' : 'options'
      if (context.title === 'feats') {
        setFormState({
          target: {
            name: `options.${optionIndex}`,
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
      setSubContext('')
      return setSectionName('')
    }
    if (sectionName === '' && context.title !== 'feats') {
      const parentName = steps[stepIndex].id === 'ancestry' ? 'ancestry.option' : 'features'
      setFormState({
        target: {
          name: `${parentName}.${featureIndex}`,
          value: featureState,
        },
      })
      return setSubContext('')
    }
    /* Form Saving */
    setOldFormState(formState)
  }

  const handleForward = async () => {
    const isValid = validate()
    if ((!isLastStep || (isLastStep && subContext !== '')) && context.title !== 'feats') {
      if (isValid) {
        setValidForm({ ...validForm, [steps[stepIndex].id]: true })
        if (subContext !== '') {
          setValidForm({ ...validForm, [steps[stepIndex].id]: true })
          return handleSave()
        }
        setOldFormState(formState)
        return setStepIndex(stepIndex + 1)
      }
      setValidForm({ ...validForm, [steps[stepIndex].id]: false })
      if (subContext != '') {
        return handleAlert({
          alertType: 'forward',
          message: 'Some required fields are missing. Current form step will not be saved.',
        })
      }
    }
    if ((isLastStep && subContext === '') || (context.title === 'feats' && sectionName === '')) {
      if (isValid) {
        setValidForm({ ...validForm, [steps[stepIndex].id]: true })
        if (Object.values(validForm).length > 0 && !Object.values(validForm).every((value) => value === true)) {
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
      setValidForm({ ...validForm, [steps[stepIndex].id]: true })
      if (subContext !== '') {
        return handleSave()
      }
    } else {
      setValidForm({ ...validForm, [steps[stepIndex].id]: false })
    }
    if (subContext != '') {
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
    let formClone = JSON.parse(JSON.stringify(formState))
    if (isValid) {
      setValidForm({ ...validForm, [steps[stepIndex].id]: true })
      if (
        subContext === 'subfeature' ||
        subContext === 'option' ||
        (subContext === 'feature' && context.title !== 'feats')
      ) {
        formClone = await handleSaveFeatures({ type: subContext, state: formClone })
      }
      setValidForm({ ...validForm, [steps[stepIndex].id]: true })
      if (!(Object.values(validForm).length > 0) || Object.values(validForm).every((value) => value === true)) {
        try {
          await updateItem(formClone)
          setOldFormState(formClone)
          return setFormState({
            type: 'reset',
            target: { value: formClone },
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
    if (sectionName !== '') {
      return setSectionState({
        type: 'reset',
        target: { value: oldSectionState },
      })
    }
    if (subContext === 'subfeature') {
      return setSubfeatureState({
        type: 'reset',
        target: { value: oldSubfeatureState },
      })
    }
    if (subContext === 'option') {
      return setOptionState({
        type: 'reset',
        target: { value: oldOptionState },
      })
    }
    if (subContext === 'feature') {
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

  return (
    <Group className={form_footer} justifyContentVariant={'spaceBetween'}>
      <Group>
        <Button color='default' type='button' onClick={handleBack}>
          {backLabel}
        </Button>
        <Button color='warning' type='button' onClick={handleReset}>
          Reset
        </Button>
      </Group>
      <Group>
        {context.type === 'edit' && (!isLastStep || (isLastStep && subContext !== '')) && (
          <Button color='update' type='button' onClick={handleUpdate}>
            Update
          </Button>
        )}
        <Button
          color={forwardLabel === 'Update' ? 'update' : 'primary'}
          type='button'
          onClick={() => (isLastStep && subContext === '' && context.type !== 'new' ? handleUpdate() : handleForward())}
        >
          {forwardLabel}
        </Button>
      </Group>
    </Group>
  )
}

export default Footer
