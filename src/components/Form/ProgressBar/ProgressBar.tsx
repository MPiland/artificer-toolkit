import { useState, useRef, useEffect, useMemo } from 'react'
import { progress_tab, progress_step, progress_line, progress_step_container } from './ProgressBar.css'
import clsx from 'clsx'
import ScrollArea from '../../ScrollArea/ScrollArea'
import { validate } from '../../../utils/form'
import { isEqual } from 'lodash'
import { useForm } from '../../../hooks/UseForm'
import { useFeature } from '../../../hooks/UseFeature'
import { useIsFetching } from '@tanstack/react-query'

const ProgressBar = () => {
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
    formState,
    setFormState,
    oldFormState,
    stepIndex,
    setSteps,
    setAddClass,
    setChangeRace,
    context,
  } = useForm()

  const { setSectionName, subContext, setSubContext, handleSaveFeatures } = useFeature()

  const isLoading = useIsFetching() > 0

  const stepsArray = useMemo(() => {
    let updatedSteps = [...steps]

    if (formState?.attribute?.some((attributeItem: any) => attributeItem.name === 'containsItems')) {
      if (!updatedSteps.includes({ id: 'contains', name: 'Contains' })) {
        updatedSteps.push({ id: 'contains', name: 'Contains' })
      }
    } else {
      updatedSteps = updatedSteps.filter((step: any) => step.name !== 'Contains')
    }

    return updatedSteps
  }, [formState, steps])

  useEffect(() => {
    if (!isEqual(stepsArray, steps)) {
      setSteps(stepsArray)
    }
  }, [setSteps, steps, stepsArray])

  useEffect(() => {
    const updateLinePosition = () => {
      const stepsArrayRefs: HTMLDivElement[] = stepsRefs.current
      if (stepsArrayRefs.length > 0) {
        const activeStep = stepsArrayRefs[stepIndex]
        const stepWidth = activeStep?.offsetWidth ?? 0
        const stepLeft = activeStep?.offsetLeft ?? 0

        setLineLeft(stepLeft)

        // Delay the width update to match the transition timing
        const timeoutId = setTimeout(() => {
          setLineWidth(stepWidth)
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
  }, [stepIndex, stepsArray])

  const handleStepChange = async (progressStepIndex: number) => {
    setAddClass(false)
    setChangeRace(false)
    let formClone = JSON.parse(JSON.stringify(formState))
    const isValid = validate()
    if (isValid) {
      setValidForm({ ...validForm, [steps[stepIndex].id]: true })
      if (isEqual(formState, oldFormState) && subContext === '') {
        return setStepIndex(progressStepIndex)
      }
      if (
        subContext === 'subfeature' ||
        subContext === 'option' ||
        (subContext === 'feature' && context.title !== 'feats')
      ) {
        formClone = await handleSaveFeatures({ type: subContext, state: formClone })
      }
      setFormState({
        type: 'reset',
        target: { value: formClone },
      })
      setSubContext('')
      setSectionName('')
    }
    if (!isValid) {
      setValidForm({ ...validForm, [steps[stepIndex].id]: false })
    }
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
          className={clsx(progress_line, {
            ['disabled']: isLoading,
          })}
          style={{
            width: `${lineWidth}px`,
            left: `${lineLeft}px`,
            transition: 'left 0.3s ease-in-out',
          }}
        />
        {stepsArray.map((step, index: number) => (
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
            {step.name}
          </div>
        ))}
      </ScrollArea>
    </section>
  )
}

export default ProgressBar
