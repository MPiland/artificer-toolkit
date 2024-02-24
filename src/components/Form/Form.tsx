import {
  error_message,
  form_header,
  form_wrapper,
  success_message,
} from './Form.css'
import { SerializedError } from '@reduxjs/toolkit'
import { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { useEffect, useState } from 'react'
import { startCase } from 'lodash'
import ProgressBar from '../ProgressBar/ProgressBar'
import useIsLoading from '../../hooks/useIsLoading'
import Spinner from '../Spinner/Spinner'
import DetailForm from './DetailForm'
import AttributeForm from './AttributeForm'
import TraitForm from './TraitForm'
import FeatureForm from './FeatureForm'
import { ReducerActionType, Steps } from '../../utils/types'
import ContainsForm from './ContainsForm'
import ProficiencyForm from './ProficiencyForm'
import EquipmentForm from './EquipmentForm'

interface FormProps {
  context: {
    type: 'edit' | 'create'
    title: string
  }
  handleSubmit: () => Promise<void>
  update: (
    arg: any
  ) => Promise<{ data: any } | { error: FetchBaseQueryError | SerializedError }>
  steps: Steps
  state: any
  setState: (arg: ReducerActionType) => void
  errorMessage: string | null
  successMessage: string | null
  setErrorMessage: (arg: string) => void
}

/**
 * Form wrapper component for other form sections.
 * @prop {object} context - Context for form type and builder.
 * @prop {Array} steps - String array listing form steps in order.
 * @prop {Object} state - Current state if editing an object.
 * @prop {(arg: ReducerActionType) => void} setState - Reducer function to set the object state.
 * @prop {() => void} handleSubmit - Function to submit the state back to server.
 * @prop {(arg: any) => { data: any } | { error: FetchBaseQueryError | SerializedError }} update - Function to update the state when editing an existing object.
 * @prop {string} errorMessage - String noting any error for submiting or updating.
 * @prop {string} successMessage - String noting if update or submit was successful.
 * @prop {arg: string} setErrorMessage - Sets the error message for the form header if any.
 */

const Form = ({
  context,
  handleSubmit,
  update,
  steps,
  state,
  setState,
  errorMessage,
  successMessage,
  setErrorMessage,
}: FormProps) => {
  const [stepIndex, setStepIndex] = useState<number>(0)
  const [isFirstStep, setIsFirstStep] = useState<boolean>(false)
  const [isLastStep, setIsLastStep] = useState<boolean>(false)

  // Last/First Step
  useEffect(() => {
    if (stepIndex === 0) {
      setIsFirstStep(true)
    } else {
      setIsFirstStep(false)
    }
    if (stepIndex === steps.length - 1) {
      setIsLastStep(true)
    } else {
      setIsLastStep(false)
    }
  }, [stepIndex, steps.length])

  const formSteps = [
    {
      name: 'Details',
      content: (
        <DetailForm
          state={state}
          setState={setState}
          context={context}
          isLastStep={isLastStep}
          isFirstStep={isFirstStep}
          setStepIndex={setStepIndex}
          update={update}
          handleSubmit={handleSubmit}
          setErrorMessage={setErrorMessage}
        />
      ),
    },
    {
      name: 'Attributes',
      content: (
        <AttributeForm
          state={state}
          setState={setState}
          context={context}
          isLastStep={isLastStep}
          isFirstStep={isFirstStep}
          setStepIndex={setStepIndex}
          update={update}
          handleSubmit={handleSubmit}
          setErrorMessage={setErrorMessage}
        />
      ),
    },
    {
      name: 'Traits',
      content: (
        <TraitForm
          state={state}
          setState={setState}
          context={context}
          isLastStep={isLastStep}
          isFirstStep={isFirstStep}
          setStepIndex={setStepIndex}
          update={update}
          handleSubmit={handleSubmit}
          setErrorMessage={setErrorMessage}
        />
      ),
    },
    {
      name: 'Features',
      content: (
        <FeatureForm
          state={state}
          isLastStep={isLastStep}
          isFirstStep={isFirstStep}
          setStepIndex={setStepIndex}
          context={context}
          setState={setState}
          update={update}
          handleSubmit={handleSubmit}
          setErrorMessage={setErrorMessage}
        />
      ),
    },
    {
      name: 'Contains',
      content: (
        <ContainsForm
          state={state}
          isLastStep={isLastStep}
          isFirstStep={isFirstStep}
          setStepIndex={setStepIndex}
          context={context}
          setState={setState}
          update={update}
          handleSubmit={handleSubmit}
          setErrorMessage={setErrorMessage}
        />
      ),
    },
    {
      name: 'Proficiencies',
      content: (
        <ProficiencyForm
          state={state}
          isLastStep={isLastStep}
          isFirstStep={isFirstStep}
          setStepIndex={setStepIndex}
          context={context}
          setState={setState}
          update={update}
          handleSubmit={handleSubmit}
          setErrorMessage={setErrorMessage}
        />
      ),
    },
    {
      name: 'Equipment',
      content: (
        <EquipmentForm
          state={state}
          isLastStep={isLastStep}
          isFirstStep={isFirstStep}
          setStepIndex={setStepIndex}
          context={context}
          setState={setState}
          update={update}
          handleSubmit={handleSubmit}
          setErrorMessage={setErrorMessage}
        />
      ),
    },
  ]

  const isLoading = useIsLoading()

  return (
    <>
      <form className={form_wrapper}>
        {steps.length > 1 && (
          <ProgressBar currentStepIndex={stepIndex} steps={steps} />
        )}
        <div className={form_header}>
          <h1>
            {startCase(context.type)}
            {context.title === 'item' ? ' An ' : ' A '}
            {startCase(context.title)}
            {state?.value && ` (${state.value})`}
            {errorMessage && (
              <span className={error_message}> - {errorMessage}</span>
            )}
            {successMessage && (
              <span className={success_message}> - {successMessage}</span>
            )}
          </h1>
        </div>
        {isLoading ? (
          <Spinner />
        ) : (
          formSteps[
            formSteps.findIndex((step) => step.name === steps[stepIndex])
          ].content
        )}
      </form>
    </>
  )
}

export default Form
