import { base } from './Footer.css'
import { Button } from '@mantine/core'
import { sprinkles } from '@css/sprinkles.css'
import { Group } from '@mantine/core'
import { useOptimizedSelector, useTypedFormStore } from '@store'
import { ModalContext } from '@components/Modal'
import { use } from 'react'
import { useNavigate } from '@tanstack/react-router'

const Footer = () => {
  const store = useTypedFormStore()
  // TODO: Get isDefaultValue from form state - disabled submit if true, error message on back conditionally based on this
  const navigate = useNavigate()
  const {
    stepIndex,
    steps,
    setStepIndex,
    stepReset,
    featureIndex,
    optionIndex,
    sectionIndex,
    ancestryOptionIndex,
    reset,
    formSubmit,
    isValid
  } = useOptimizedSelector(store, (state) => ({
    stepIndex: state.meta.stepIndex,
    steps: state.meta.steps,
    setStepIndex: state.setStepIndex,
    stepReset: state.resetStepFields,
    featureIndex: state.meta.editing.featureIndex,
    optionIndex: state.meta.editing.optionIndex,
    sectionIndex: state.meta.editing.sectionIndex,
    ancestryOptionIndex: state.meta.editing.ancestryOptionIndex,
    reset: state.reset,
    formSubmit: state.formSubmit!,
    isValid: state.meta.isValid
  }))

  const { showModal } = use(ModalContext)

  const isLastStep = stepIndex === steps.length - 1
  const isFirstStep = stepIndex === 0
  const isNonStep
    = featureIndex !== null || optionIndex !== null || sectionIndex !== null || ancestryOptionIndex !== null

  const handleCancel = () => {
    navigate({ to: '..' })
    reset()
  }

  const handleBack = () => {
    if (isFirstStep) {
      showModal({
        type: 'alert',
        props: {
          title: 'Changes not saved',
          message: 'There are changes that are not saved. Please update or submit to save these changes',
          cancelLabel: 'Cancel',
          confirmLabel: 'Ok',
          onConfirm: () => handleCancel()
        }
      })
    } else {
      setStepIndex(stepIndex - 1)
    }
  }

  const handleForward = () => {
    if (isLastStep && !isNonStep) {
      if (!isValid) {
        showModal({
          type: 'alert',
          props: {
            title: 'Errors',
            message: 'Please fix the errors before submitting.',
            confirmLabel: 'OK'
          }
        })
      }
      formSubmit()
    } else {
      setStepIndex(stepIndex + 1)
    }
  }

  const handleSubmit = () => {
    if (!isValid) {
      showModal({
        type: 'alert',
        props: {
          title: 'Errors',
          message: 'Please fix the errors before submitting.',
          confirmLabel: 'OK'
        }
      })
    }
    formSubmit()
  }

  const backLabel = stepIndex === 0 ? 'Cancel' : 'Back'
  const forwardLabel = stepIndex === steps.length - 1 ? 'Submit' : 'Next'

  return (
    <Group className={base} justify="space-between">
      <Group>
        <Button color="red" type="button" onClick={handleBack} className={sprinkles({ marginRight: 'space-2' })}>
          {backLabel}
        </Button>
        <Button color="yellow" type="button" onClick={stepReset}>
          Reset
        </Button>
      </Group>
      <Group>
        {(!isLastStep || (isLastStep && !isNonStep)) && (
          <Button color="green" type="button" onClick={handleSubmit} className={sprinkles({ marginRight: 'space-2' })}>
            Update
          </Button>
        )}
        <Button type="button" onClick={handleForward}>
          {forwardLabel}
        </Button>
      </Group>
    </Group>
  )
}

export default Footer
