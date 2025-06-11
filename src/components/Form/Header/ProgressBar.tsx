import { useState, useRef, useEffect } from 'react'
import { progress_tab, progress_step, progress_line, progress_step_container } from './ProgressBar.css'
import clsx from 'clsx'
import { validateForm } from '../utils'
import { isEqual } from 'lodash'
import { use } from 'react'
import { FormContext } from '../FormContext'
import { FeatureContext } from '../Features'
import { LoadingContext } from '@/components/Loading'
import { useEnumChecks } from '@/hooks'
import type { FormDataType } from '@/types'
import { ModalContext } from '@/components/Modal'
import { Navigate } from '@tanstack/react-router'
import { Grid, ScrollArea } from '@mantine/core'

const ProgressBar = () => {
  const { showModal } = use(ModalContext)

  const [lineWidth, setLineWidth] = useState<number>(0)
  const [lineLeft, setLineLeft] = useState<number>(0)
  const stepsRefs = useRef<HTMLDivElement[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const stepsContainerRef = useRef<HTMLDivElement>(null)

  const { formStore, validForm, steps, stepIndex } = use(FormContext)

  const { containsEquipment } = useEnumChecks({ data: formStore.data })

  const { handleSaveFeatures, sectionStore, featureStore, optionStore, ancestryStore } = use(FeatureContext)

  const { isLoading } = use(LoadingContext)

  useEffect(() => {
    let updatedSteps = [...steps]

    if (formStore.data.__typename === 'Equipment' && containsEquipment) {
      if (!updatedSteps.includes({ id: 'contains', label: 'Contains' })) {
        updatedSteps.push({ id: 'contains', label: 'Contains' })
      }
    } else {
      updatedSteps = updatedSteps.filter((step) => step.label !== 'Contains')
    }

    if (!isEqual(updatedSteps, steps)) {
      formStore.setSteps(updatedSteps)
    }
  }, [formStore, steps, containsEquipment])

  useEffect(() => {
    const updateLinePosition = () => {
      const stepsArrayRefs: HTMLDivElement[] = stepsRefs.current
      if (stepsArrayRefs.length > 0) {
        const activeStep = stepsArrayRefs[stepIndex]
        const stepWidth = activeStep?.offsetWidth ?? 0
        const stepLeft = activeStep?.offsetLeft ?? 0

        if (lineLeft !== stepLeft) {
          setLineLeft(stepLeft)
        }

        // Delay the width update to match the transition timing
        const timeoutId = setTimeout(() => {
          if (stepWidth !== lineWidth) {
            setLineWidth(stepWidth)
          }
        }, 100) // Matching the transition time of 0.3s

        // Clear the timeout if the component unmounts or updates
        return () => clearTimeout(timeoutId)
      }
    }

    updateLinePosition()

    const stepsContainer = stepsContainerRef.current
    if (stepsContainer) {
      const resizeObserver = new ResizeObserver(updateLinePosition)
      resizeObserver.observe(stepsContainer)

      return () => {
        resizeObserver.disconnect()
      }
    }
  }, [stepIndex, lineLeft, lineWidth])

  const handleStepChange = async (progressStepIndex: number) => {
    formStore.setAddClass(false)
    formStore.setChangeRace(false)
    let formClone: FormDataType = JSON.parse(JSON.stringify(formStore.data))
    const isValid = validateForm()
    if (isValid) {
      formStore.setValidForm({ ...validForm, [steps[stepIndex].id]: true })
      if (isEqual(formStore.data, formStore.initData) && featureStore.step == null) {
        return formStore.setStepIndex(progressStepIndex)
      }
      if (featureStore.step === 'option' || (featureStore.step === 'feature' && formStore.data.__typename !== 'Feat')) {
        formClone = await handleSaveFeatures({ type: featureStore.step, state: formClone })
      }
      if (!isEqual(formClone, formStore.data)) {
        formStore.reinitState(formClone)
      }
      featureStore.setStep(null)
      sectionStore.setStep(null)
    }
    if (!isValid) {
      formStore.setValidForm({ ...validForm, [steps[stepIndex].id]: false })
      if (featureStore.step != null) {
        return showModal({
          type: 'alert',
          props: {
            message: 'Some required fields are missing. Current form step will not be saved.',
            onConfirm: () => handleConfirmStep(progressStepIndex),
          },
        })
      }
    }
    return formStore.setStepIndex(progressStepIndex)
  }

  const reset = () => {
    if (sectionStore.step != null) {
      sectionStore.reinitState()
      sectionStore.setStep(null)
    } else if (featureStore.step === 'option') {
      optionStore.reinitState()
      featureStore.setStep('feature')
    } else if (featureStore.step === 'ancestry') {
      featureStore.reinitState()
      featureStore.setStep('ancestryOption')
    } else {
      if (featureStore.step === 'ancestryOption') {
        ancestryStore.reinitState()
      } else {
        featureStore.reinitState()
      }
      featureStore.setStep(null)
    }
  }

  const handleConfirmStep = (progressStepIndex: number) => {
    if (featureStore.step != null) {
      reset()
    }
    formStore.setStepIndex(progressStepIndex)
    return <Navigate to={'..'} />
  }

  return (
    <Grid.Col className={progress_tab} ref={containerRef}>
      <ScrollArea scrollbars='x' className={progress_step_container} ref={stepsContainerRef}>
        <div
          className={clsx(progress_line, {
            ['disabled']: isLoading,
          })}
          style={{
            width: `${lineWidth}px`,
            left: `${lineLeft}px`,
            transition: 'left 0.3s ease-in-out',
          }}
        />
        {steps.map((step, index) => (
          <div
            key={index}
            className={clsx(progress_step, {
              ['active']: stepIndex === index,
              ['disabled']: isLoading,
            })}
            onClick={() => !isLoading && handleStepChange(index)}
            ref={(el) => {
              if (el) {
                stepsRefs.current[index] = el
              }
            }}
          >
            {step.label}
          </div>
        ))}
      </ScrollArea>
    </Grid.Col>
  )
}

export default ProgressBar
