import clsx from 'clsx'
import * as styles from './ActionBar.css'
import { ActionIcon, Tooltip } from '@mantine/core'
import { ArrowLeft, ArrowRight } from 'lucide-react'
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
  const { goToNextStep, goToPreviousStep, isFirstStep, isLastStep, stagedEditorOpen } =
    useAuthoringForm()
  const { setVisitedStepIds, stepId } = useAuthoringLayout()
  const handlePrevious = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      void goToPreviousStep()
    },
    [goToPreviousStep]
  )
  const handleNext = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      setVisitedStepIds((current) => {
        if (!stepId || current.has(stepId)) return current
        const next = new Set(current)
        next.add(stepId)
        return next
      })
      void goToNextStep()
    },
    [goToNextStep, setVisitedStepIds, stepId]
  )
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
          <Tooltip label='Back'>
            <ActionIcon
              aria-label='Back'
              className={styles.secondaryButton}
              disabled={isFirstStep || stagedEditorOpen}
              onClick={handlePrevious}
              type='button'
              variant='transparent'
            >
              <ArrowLeft aria-hidden='true' className={styles.icon} />
            </ActionIcon>
          </Tooltip>
        </div>
        <div className={styles.end}>
          <Tooltip label='Next'>
            <ActionIcon
              aria-label='Next'
              className={styles.primaryButton}
              disabled={isLastStep || stagedEditorOpen}
              onClick={handleNext}
              type='button'
              variant='transparent'
            >
              <ArrowRight aria-hidden='true' className={styles.icon} />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>
    </footer>
  )
}
