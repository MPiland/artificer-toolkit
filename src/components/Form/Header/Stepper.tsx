import { useFormStore } from '@/store'
import { Stepper as MantineStepper } from '@mantine/core'

const Stepper = () => {
  const formStore = useFormStore()

  return (
    <>
      <MantineStepper active={formStore.stepIndex} onStepClick={formStore.setStepIndex}>
        {formStore.steps?.map((step, i) => <MantineStepper.Step key={`${i}-${step.label}`} label={step.label} />)}
      </MantineStepper>
    </>
  )
}

export default Stepper
