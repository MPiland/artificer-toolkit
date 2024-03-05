import { FC, Fragment, useLayoutEffect, useRef, useState } from 'react'
import {
  progress_bar,
  progress_empty,
  progress_fill,
  progress_step,
  progress_width,
  progress_step_wrapper,
} from './ProgressBar.css'
import clsx from 'clsx'
import { assignInlineVars } from '@vanilla-extract/dynamic'
import { useMediaQuery } from 'usehooks-ts'

interface ProgressBarProps {
  steps: any[]
  currentStepIndex: number
  handleStepChange: (arg: number) => void
}

const ProgressBar: FC<ProgressBarProps> = ({
  steps,
  currentStepIndex,
  handleStepChange,
}) => {
  const [progressWidth, setProgressWidth] = useState<string>('0')
  const progressBarRef = useRef<HTMLDivElement | null>(null)

  const sm = useMediaQuery('screen and (max-width: 567px)')

  useLayoutEffect(() => {
    if (currentStepIndex === 0) {
      setProgressWidth('0')
    } else if (currentStepIndex === steps.length - 1) {
      setProgressWidth(`calc(100% - ${sm ? 0 : 2}rem)`)
    } else {
      setProgressWidth(
        `calc((((100% - ${sm ? 0 : 2}rem) / ${
          steps.length - 1
        }) * ${currentStepIndex}))`
      )
    }
  }, [currentStepIndex, steps, sm])

  return (
    <section className={progress_bar}>
      <div
        className={progress_empty}
        style={assignInlineVars({
          [progress_width]: `calc(100% - ${sm ? 4 : 6}rem)`,
        })}
        ref={progressBarRef}
      />
      <div
        className={progress_fill}
        style={assignInlineVars({
          [progress_width]: progressWidth,
        })}
        ref={progressBarRef}
      />
      <div className={progress_step_wrapper}>
        {steps.map((stepItem, stepIndex: number) => {
          return (
            <Fragment key={stepIndex}>
              <div
                className={clsx(progress_step, {
                  ['active']: currentStepIndex >= stepIndex,
                })}
                data-atapp-step={stepItem}
                onClick={() => handleStepChange(stepIndex)}
              />
            </Fragment>
          )
        })}
      </div>
    </section>
  )
}

export default ProgressBar
