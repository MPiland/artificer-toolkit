import { useFormStore } from '@/store'
import { Stepper as MantineStepper, Progress } from '@mantine/core'
import { CircleX } from 'lucide-react'
import { useMediaQuery } from '@mantine/hooks'
import { label } from './Stepper.css'

const Stepper = () => {
  const addClass = useFormStore((state) => state.addClass)
  const changeRace = useFormStore((state) => state.changeRace)
  const stepIndex = useFormStore((state) => state.stepIndex)
  const steps = useFormStore((state) => state.steps)

  const sm = useMediaQuery('(max-width: 768px)')

  const handleStepChange = async (progressStepIndex: number) => {
    if (addClass) {
      useFormStore.setState({ addClass: false })
    }
    if (changeRace) {
      useFormStore.setState({ changeRace: false })
    }
    return useFormStore.setState({ stepIndex: progressStepIndex })
  }

  // Create a validation state key to force re-render when validation changes
  const validationKey = steps?.map((step) => Object.keys(step.fieldValidation)).join('-')

  return !sm ?
      <MantineStepper key={validationKey} active={stepIndex} onStepClick={handleStepChange} size='xs' w='100%'>
        {steps?.map((step, i) => {
          const hasErrors = Object.values(step.fieldValidation).some((isValid) => isValid === false)

          return (
            <MantineStepper.Step
              key={`${step.label}-${i}`}
              label={step.label}
              color={hasErrors ? 'red' : undefined}
              completedIcon={hasErrors ? <CircleX /> : undefined}
            />
          )
        })}
      </MantineStepper>
    : <>
        {steps?.map((step, i) => (
          <Progress.Root
            size='lg'
            transitionDuration={200}
            w={`calc(100%/${steps?.length})`}
            onClick={() => handleStepChange(i)}
          >
            <Progress.Label className={label}>{step.label}</Progress.Label>
            <Progress.Section value={i < stepIndex ? 100 : 0}></Progress.Section>
          </Progress.Root>
        ))}
      </>
}

export default Stepper
