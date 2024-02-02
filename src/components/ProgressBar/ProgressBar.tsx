import { FC, Fragment, useRef } from 'react'
import { progress_bar, progress, progress_step } from './ProgressBar.css'
import clsx from 'clsx'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import palette from '../../css/colors.css'

interface ProgressBarProps {
  steps: any[]
  currentStepIndex: number
}

const ProgressBar: FC<ProgressBarProps> = ({ steps, currentStepIndex }) => {
  const progressBarRef = useRef<HTMLDivElement | null>(null)

  useGSAP(() => {
    const progressBar = progressBarRef.current
    if (progressBar) {
      gsap.to(progressBar, {
        width:
          currentStepIndex === 0
            ? '2rem'
            : `calc((100% / ${steps.length}) * ${currentStepIndex + 1})`,
        backgroundColor: palette['blue-7'],
        duration: 0.3,
        ease: 'power1.inOut',
      })
    }
  }, [currentStepIndex])

  return (
    <section className={progress_bar}>
      <div className={progress} ref={progressBarRef} />
      <>
        {steps.map((stepItem, stepIndex: number) => {
          return (
            <Fragment key={stepIndex}>
              <div
                className={clsx(progress_step, {
                  ['active']: currentStepIndex >= stepIndex,
                })}
                data-atapp-step={stepItem.name}
              />
            </Fragment>
          )
        })}
      </>
    </section>
  )
}

export default ProgressBar
