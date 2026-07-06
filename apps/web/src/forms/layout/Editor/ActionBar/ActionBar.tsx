import clsx from 'clsx'
import * as styles from './ActionBar.css'
import { ActionIcon, Tooltip } from '@mantine/core'
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import type { MouseEvent } from 'react'
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
  const finalActionLabel = activateLabel ?? 'Activate'
  const handleCancel = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    void cancel()
  }, [cancel])
  const handlePrevious = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    void goToPreviousStep()
  }, [goToPreviousStep])
  const handleNext = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    setVisitedStepIds((current) => {
      if (!stepId || current.has(stepId)) return current
      const next = new Set(current)
      next.add(stepId)
      return next
    })
    void goToNextStep()
  }, [goToNextStep, setVisitedStepIds, stepId])
  const handleActivate = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    void activate()
  }, [activate])

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
          {isFirstStep ? (
            <Tooltip label='Cancel'>
              <ActionIcon
                aria-label='Cancel'
                className={styles.secondaryButton}
                onClick={handleCancel}
                type='button'
                variant='transparent'
              >
                <X aria-hidden='true' className={styles.icon} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <Tooltip label='Back'>
              <ActionIcon
                aria-label='Back'
                className={styles.secondaryButton}
                onClick={handlePrevious}
                type='button'
                variant='transparent'
              >
                <ArrowLeft aria-hidden='true' className={styles.icon} />
              </ActionIcon>
            </Tooltip>
          )}
        </div>
        <div className={styles.end}>
          {isLastStep ? (
            readOnly ? null : (
              <Tooltip label={finalActionLabel}>
                <ActionIcon
                  aria-label={finalActionLabel}
                  className={styles.primaryButton}
                  disabled={!canFinalize}
                  loading={isSubmitting}
                  onClick={handleActivate}
                  type='button'
                  variant='transparent'
                >
                  <Check aria-hidden='true' className={styles.icon} />
                </ActionIcon>
              </Tooltip>
            )
          ) : (
            <Tooltip label='Next'>
              <ActionIcon
                aria-label='Next'
                className={styles.primaryButton}
                onClick={handleNext}
                type='button'
                variant='transparent'
              >
                <ArrowRight aria-hidden='true' className={styles.icon} />
              </ActionIcon>
            </Tooltip>
          )}
        </div>
      </div>
    </footer>
  )
}
