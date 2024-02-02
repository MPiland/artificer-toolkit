import {
  form_footer,
  form_header,
  form_content,
  form_wrapper,
} from './Form.css'
import Button from '../Button/Button'
import Group from '../Group/Group'
import { FC, useState } from 'react'
import { startCase } from 'lodash'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../ProgressBar/ProgressBar'

type FormProps = {
  context: {
    title: string
    type: string
  }
  onSubmit: () => void
  steps: any[]
}

const Form: FC<FormProps> = ({ context, onSubmit, steps }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0)

  const navigate = useNavigate()

  const isFirstStep = currentStepIndex === 0 ? true : false
  const isLastStep = currentStepIndex === steps.length - 1 ? true : false

  // const submitForm = (e: FormEvent) => {
  //   e.preventDefault()
  //   if (!isLastStep) return onNext()
  //   onSubmit()
  // }

  const onBack = () => {
    setCurrentStepIndex((i) => {
      if (i <= 0) return i
      return i - 1
    })
  }

  const onNext = () => {
    setCurrentStepIndex((i) => {
      if (i >= steps.length - 1) return i
      return i + 1
    })
  }

  return (
    <>
      <form className={form_wrapper}>
        <ProgressBar currentStepIndex={currentStepIndex} steps={steps} />
        <div className={form_header}>
          <h1>
            {startCase(context.type)}
            {context.title === 'item' ? ' An ' : ' A '}
            {startCase(context.title)}
          </h1>
        </div>
        <div className={form_content}>{steps[currentStepIndex].content}</div>
        <Group className={form_footer} spaceVariant={'spaceBetween'}>
          <Button
            type='button'
            onClick={() => (isFirstStep ? navigate(-1) : onBack())}
          >
            Back
          </Button>
          <Button
            type='button'
            onClick={() => {
              if (isLastStep) {
                onSubmit()
              } else {
                return onNext()
              }
            }}
          >
            {isLastStep ? 'Finish' : 'Next'}
          </Button>
        </Group>
      </form>
    </>
  )
}

export default Form
