import { useState, useRef, useEffect } from 'react'
import { progress_tab, progress_step, progress_line, progress_step_container } from './ProgressBar.css'
import clsx from 'clsx'
import { use } from 'react'
import { ModalContext } from '@/components/Modal'
import { Navigate } from '@tanstack/react-router'
import { Grid, ScrollArea } from '@mantine/core'
import { useFeatureStore, useFormStore } from '@/store'

const ProgressBar = () => {
  const { showModal } = use(ModalContext)

  const [lineWidth, setLineWidth] = useState<number>(0)
  const [lineLeft, setLineLeft] = useState<number>(0)
  const stepsRefs = useRef<HTMLDivElement[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const stepsContainerRef = useRef<HTMLDivElement>(null)

  const formStore = useFormStore()
  const featureStore = useFeatureStore()

  const { steps, stepIndex } = formStore

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
    if (!formStore.steps[formStore.stepIndex].isValid) {
      return showModal({
        type: 'alert',
        props: {
          message: 'Some required fields are missing. Current form step will not be saved.',
          onConfirm: () => handleConfirmStep(progressStepIndex),
        },
      })
    }
    formStore.setAddClass(false)
    formStore.setChangeRace(false)
    return formStore.setStepIndex(progressStepIndex)
  }

  const handleConfirmStep = (progressStepIndex: number) => {
    if (featureStore.step != null) {
      //TO DO: Add a reset function
    }
    formStore.setStepIndex(progressStepIndex)
    return <Navigate to={'..'} />
  }

  return (
    <Grid.Col className={progress_tab} ref={containerRef}>
      <ScrollArea scrollbars='x' className={progress_step_container} ref={stepsContainerRef}>
        <div
          className={clsx(progress_line)}
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
            })}
            onClick={() => handleStepChange(index)}
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
