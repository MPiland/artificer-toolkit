import { useState, useRef, useEffect } from 'react'
import { progress_tab, progress_step, progress_line, progress_step_container } from './ProgressBar.css'
import clsx from 'clsx'
import ScrollArea from '../../ScrollArea/ScrollArea'
import { validate } from '../../../utils/form'
import { isEqual } from 'lodash'
import { use } from 'react'
import { FormContext } from '../FormContext'
import { FeatureContext } from '../Features/FeatureContext'
import { LoadingContext } from '../../Loading/LoadingContext'
import { useEnumChecks } from '../../../hooks/useEnumChecks'
import { FormDataType } from '../../../types/form'
import { useLocation, useNavigate } from 'react-router-dom'
import Grid from '../../Grid/Grid'

const ProgressBar = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const [lineWidth, setLineWidth] = useState<number>(0)
  const [lineLeft, setLineLeft] = useState<number>(0)
  const stepsRefs = useRef<HTMLDivElement[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const stepsContainerRef = useRef<HTMLDivElement>(null)

  const {
    validForm,
    setValidForm,
    steps,
    setStepIndex,
    formData,
    updateFormData,
    initialFormData,
    stepIndex,
    setSteps,
    setAddClass,
    setChangeRace,
  } = use(FormContext)

  const { containsEquipment } = useEnumChecks({ data: formData })

  const { setSectionStep, featureStep, setFeatureStep, handleSaveFeatures } = use(FeatureContext)

  const { isLoading } = use(LoadingContext)

  useEffect(() => {
    let updatedSteps = [...steps]

    if (formData.__typename === 'Equipment' && containsEquipment) {
      if (!updatedSteps.includes({ id: 'contains', label: 'Contains' })) {
        updatedSteps.push({ id: 'contains', label: 'Contains' })
      }
    } else {
      updatedSteps = updatedSteps.filter((step) => step.label !== 'Contains')
    }

    if (!isEqual(updatedSteps, steps)) {
      setSteps(updatedSteps)
    }
  }, [setSteps, steps, containsEquipment, formData.__typename])

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

  const handleAlert = ({ alertType, message, index }: { alertType: 'step'; message: string; index: number }) => {
    navigate(`alert/${alertType}`, {
      state: {
        message: message,
        previous: location,
        index,
      },
    })
  }

  const handleStepChange = async (progressStepIndex: number) => {
    setAddClass(false)
    setChangeRace(false)
    let formClone: FormDataType = JSON.parse(JSON.stringify(formData))
    const isValid = validate()
    if (isValid) {
      setValidForm({ ...validForm, [steps[stepIndex].id]: true })
      if (isEqual(formData, initialFormData) && featureStep == null) {
        return setStepIndex(progressStepIndex)
      }
      if (featureStep === 'option' || (featureStep === 'feature' && formData.__typename !== 'Feat')) {
        formClone = await handleSaveFeatures({ type: featureStep, state: formClone })
      }
      if (!isEqual(formClone, formData)) {
        updateFormData({
          type: 'reset',
          value: formClone,
        })
      }
      setFeatureStep(null)
      setSectionStep(null)
    }
    if (!isValid) {
      setValidForm({ ...validForm, [steps[stepIndex].id]: false })
      if (featureStep != null) {
        return handleAlert({
          alertType: 'step',
          message: 'Some required fields are missing. Current form step will not be saved.',
          index: progressStepIndex,
        })
      }
    }
    return setStepIndex(progressStepIndex)
  }

  return (
    <Grid.Item className={progress_tab} ref={containerRef}>
      <ScrollArea
        scrollDirection='horizontal'
        visibility='hidden'
        className={progress_step_container}
        ref={stepsContainerRef}
        arrows={true}
      >
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
    </Grid.Item>
  )
}

export default ProgressBar
