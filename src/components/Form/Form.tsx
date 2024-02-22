import {
  error_message,
  form_header,
  form_wrapper,
  success_message,
} from './Form.css'
import { FC, useEffect, useState } from 'react'
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
  handleUpdate: () => Promise<void>
  steps: Steps
  state: any
  setState: (arg: ReducerActionType) => void
  errorMessage: string | null
  successMessage: string | null
}

const Form: FC<FormProps> = ({
  context,
  handleSubmit,
  handleUpdate,
  steps,
  state,
  setState,
  errorMessage,
  successMessage,
}) => {
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
          handleUpdate={handleUpdate}
          handleSubmit={handleSubmit}
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
          handleUpdate={handleUpdate}
          handleSubmit={handleSubmit}
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
          handleUpdate={handleUpdate}
          handleSubmit={handleSubmit}
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
          handleUpdate={handleUpdate}
          handleSubmit={handleSubmit}
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
          handleUpdate={handleUpdate}
          handleSubmit={handleSubmit}
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
          handleUpdate={handleUpdate}
          handleSubmit={handleSubmit}
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
          handleUpdate={handleUpdate}
          handleSubmit={handleSubmit}
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
