import { useOptimizedSelector } from '~/store'
import { Stepper as MantineStepper, Progress } from '@mantine/core'
import { CircleX } from 'lucide-react'
import { useMediaQuery } from '@mantine/hooks'
import { label } from './Stepper.css'

const Stepper = () => {
  const {
    stepIndex,
    steps,
    setAddClass,
    setChangeRace,
    setFeatureIndex,
    setOptionIndex,
    setAncestryOptionIndex,
    setStepIndex,
    stepValidation,
    featureValidation,
    optionValidation,
    ancestryOptionValidation,
    __kind,
    sectionValidation,
  } = useOptimizedSelector((state) => ({
    __kind: state.current?.__kind,
    setAddClass: state.setAddClass,
    setChangeRace: state.setChangeRace,
    setFeatureIndex: state.setFeatureIndex,
    setAncestryOptionIndex: state.setAncestryOptionIndex,
    setOptionIndex: state.setOptionIndex,
    steps: state.meta.steps,
    stepIndex: state.meta.stepIndex,
    setStepIndex: state.setStepIndex,
    stepValidation: state.stepValidation,
    featureValidation: state.featureValidation,
    optionValidation: state.optionValidation,
    ancestryOptionValidation: state.ancestryOptionValidation,
    sectionValidation: state.sectionValidation,
  }))

  const sm = useMediaQuery('(max-width: 768px)')

  const handleStepChange = async (progressStepIndex: number) => {
    setAddClass(false)
    setChangeRace(false)
    setFeatureIndex(null)
    setAncestryOptionIndex(null)
    setOptionIndex(null)
    return setStepIndex(progressStepIndex)
  }

  // Create a validation state key to force re-render when validation changes
  return !sm ?
      <MantineStepper key={stepIndex} active={stepIndex} onStepClick={handleStepChange} size='xs' w='100%'>
        {steps?.map((step, i) => {
          // Helper function to get all validation records from a Map
          const getAllValidationRecords = (validationMap: Map<string, Record<string, boolean>>) => {
            const allRecords: Record<string, boolean> = {}
            for (const record of validationMap.values()) {
              Object.assign(allRecords, record)
            }
            return allRecords
          }

          // Build validation object based on step and form type
          const validation = (() => {
            const baseValidation = stepValidation.get(step.id) || {}
            
            if (__kind === 'FeatInput' || step.id === 'features') {
              return {
                ...baseValidation,
                ...getAllValidationRecords(featureValidation),
                ...getAllValidationRecords(optionValidation),
                ...getAllValidationRecords(sectionValidation),
              }
            }
            
            if (__kind === 'RaceInput' && step.id === 'ancestry') {
              return {
                ...baseValidation,
                ...getAllValidationRecords(ancestryOptionValidation),
              }
            }
            
            return baseValidation
          })()

          const hasErrors = Object.values(validation).some((isValid) => isValid === false)

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
