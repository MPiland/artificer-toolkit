import { FC, useState, useEffect, useRef } from 'react'
import { progress_tab, progress_step, progress_line, progress_step_container } from './ProgressBar.css'
import clsx from 'clsx'
import ScrollArea from '../ScrollArea/ScrollArea'

interface ProgressBarProps {
  steps: any[]
  currentStepIndex: number
  handleStepChange: (arg: number) => void
}

const ProgressBar: FC<ProgressBarProps> = ({ steps, currentStepIndex, handleStepChange }) => {
  const [lineWidth, setLineWidth] = useState<number>(0)
  const [lineLeft, setLineLeft] = useState<number>(0)
  const stepsRefs = useRef<HTMLDivElement[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const stepsContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const steps: HTMLDivElement[] = stepsRefs.current
    const stepsContainer = stepsContainerRef.current

    if (container && steps && stepsContainer) {
      const updateLinePosition = (entries: Array<ResizeObserverEntry>) => {
        entries.forEach(() => {
          if (steps) {
            const activeStep = steps.find((step: HTMLElement) => step.classList.contains('active'))
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
  }, [currentStepIndex, steps, containerRef, stepsContainerRef])

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
        {steps.map((stepItem, stepIndex: number) => (
          <div
            key={stepIndex}
            className={clsx(progress_step, {
              ['active']: currentStepIndex === stepIndex,
            })}
            onClick={() => handleStepChange(stepIndex)}
            ref={(el) => {
              if (el) {
                stepsRefs.current[stepIndex] = el
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

export default ProgressBar
