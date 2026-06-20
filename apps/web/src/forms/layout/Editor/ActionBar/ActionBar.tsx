import clsx from 'clsx'
import * as styles from './ActionBar.css'
import { Button } from '@mantine/core'
import { useCallback } from 'react'
import { useAuthoringForm } from '../../AuthoringFormContext'
import { useAuthoringLayout } from '../../AuthoringLayoutContext'

type ActionBarProps = {
  className?: string
  padding?: 'flush' | 'padded'
  surface?: 'canvas' | 'header'
}

export function ActionBar({ className, padding = 'flush', surface = 'canvas' }: ActionBarProps) {
  const {
    activate,
    activateLabel,
    cancel,
    canFinalize,
    goToNextStep,
    goToPreviousStep,
    isFirstStep,
    isLastStep,
    isSubmitting,
    readOnly
  } = useAuthoringForm()
  const { setVisitedStepIds, stepId } = useAuthoringLayout()
  const handleNext = useCallback(() => {
    setVisitedStepIds((current) => {
      if (!stepId || current.has(stepId)) return current
      const next = new Set(current)
      next.add(stepId)
      return next
    })
    void goToNextStep()
  }, [goToNextStep, setVisitedStepIds, stepId])

  return (
    <footer
      className={clsx(
        styles.root,
        padding === 'padded' ? styles.padded : styles.flush,
        surface === 'header' ? styles.headerSurface : styles.canvasSurface,
        className
      )}
      data-testid='authoring-action-bar'
    >
      <div className={styles.inner}>
        <div className={styles.start}>
          <Button
            type='button'
            variant='default'
            onClick={() => void (isFirstStep ? cancel() : goToPreviousStep())}
          >
            Back
          </Button>
        </div>
        <div className={styles.end}>
          {isLastStep ? (
            readOnly ? null : (
              <Button
                type='button'
                disabled={!canFinalize}
                loading={isSubmitting}
                onClick={() => void activate()}
              >
                {activateLabel}
              </Button>
            )
          ) : (
            <Button type='button' onClick={handleNext}>
              Next
            </Button>
          )}
        </div>
      </div>
    </footer>
  )
}
