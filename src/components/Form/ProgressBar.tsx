import { useState, useEffect, useRef, useContext, useLayoutEffect } from 'react'
import { progress_tab, progress_step, progress_line, progress_step_container } from './ProgressBar.css'
import clsx from 'clsx'
import ScrollArea from '../ScrollArea/ScrollArea'
import { validate } from '../../utils/formValidation'
import { isEqual } from 'lodash'
import { useLocation } from 'react-router-dom'
import { FormStepsContext } from './FormStepsContext'

const ProgressBarTest = () => {
  const location = useLocation()

  const [confirmStep, setConfirmStep] = useState<boolean>(false)
  const [alertTriggered, setAlertTriggered] = useState<boolean>(false)
  const [lineWidth, setLineWidth] = useState<number>(0)
  const [lineLeft, setLineLeft] = useState<number>(0)
  const stepsRefs = useRef<HTMLDivElement[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const stepsContainerRef = useRef<HTMLDivElement>(null)

  const {
    stepIndex,
    formState,
    setFormState,
    oldFormState,
    setStepIndex,
    setValidForm,
    handleUpdateFeature,
    featureStepName,
    setFeatureContext,
    setFeatureStepName,
    validForm,
    filteredSteps,
  } = useContext(FormStepsContext)

  // set confirm state based on alert response
  useEffect(() => {
    if (!confirmStep && alertTriggered) {
      const alertStep = location.state?.confirmStep
      if (alertStep) {
        setConfirmStep(true)
      }
    }
  }, [confirmStep, alertTriggered, location.state?.confirmStep])

  // Confirm Alert
  useEffect(() => {
    const index = location.state?.index
    if (confirmStep && alertTriggered) {
      if (featureStepName === '') {
        setConfirmStep(false)
        setAlertTriggered(false)
        setStepIndex(index)
      }
    }
  }, [featureStepName, setStepIndex, stepIndex, alertTriggered, location.state?.index, confirmStep])

  useLayoutEffect(() => {
    const container = containerRef.current
    const stepsArray: HTMLDivElement[] = stepsRefs.current
    const stepsContainer = stepsContainerRef.current

    if (container && stepsArray && stepsContainer) {
      const updateLinePosition = (entries: Array<ResizeObserverEntry>) => {
        entries.forEach(() => {
          if (stepsArray) {
            const activeStep = stepsArray.find((step: HTMLElement) => step.classList.contains('active'))
            const stepWidth = activeStep?.offsetWidth ?? 0
            const stepLeft = activeStep?.offsetLeft ?? 0

            setLineWidth(stepWidth)
            setLineLeft(stepLeft)
          }
        })
      }

      const resizeObserver = new ResizeObserver(updateLinePosition)

      resizeObserver.observe(container)

      return () => {
        resizeObserver.disconnect()
      }
    }
  }, [stepIndex, containerRef, stepsContainerRef])

  const handleStepChange = async (progressStepIndex: number) => {
    const isValid = validate()
    if (isValid) {
      if (isEqual(formState, oldFormState) && featureStepName === '') {
        return setStepIndex(progressStepIndex)
      }
      setValidForm({ ...validForm, [filteredSteps[stepIndex]]: true })
      const formClone = await handleUpdateFeature()
      setFormState({
        type: 'reset',
        target: { value: formClone },
      })
      setFeatureContext('')
      setFeatureStepName('')
      return setStepIndex(progressStepIndex)
    }
    setValidForm({ ...validForm, [filteredSteps[stepIndex]]: false })
    return setStepIndex(progressStepIndex)
  }

  return (
    <section className={progress_tab} ref={containerRef}>
      <ScrollArea
        scrollDirection='horizontal'
        visibility='hidden'
        className={progress_step_container}
        ref={stepsContainerRef}
        arrows={true}
      >
        <div
          className={progress_line}
          style={{
            width: `${lineWidth}px`,
            left: `${lineLeft}px`,
            transition: 'left 0.3s ease-in-out',
          }}
        />
        {filteredSteps.map((stepItem, index: number) => (
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
            {stepItem}
          </div>
        ))}
      </ScrollArea>
    </section>
  )
}

export default ProgressBarTest
