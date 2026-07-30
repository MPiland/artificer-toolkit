import clsx from 'clsx'
import * as styles from './ActionBar.css'
import { ActionIcon, Tooltip } from '@mantine/core'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { MouseEvent } from 'react'
import { useLocation } from '@tanstack/react-router'
import { useAuthoringForm } from '../../AuthoringFormContext'
import { getAuthoringStepHref } from '../../authoringSearch'

type ActionBarProps = {
  className?: string
  padding?: 'flush' | 'padded'
  surface?: 'canvas' | 'header'
}

export function ActionBar({ className, padding = 'flush', surface = 'canvas' }: ActionBarProps) {
  const {
    activeNavigationTarget,
    activeStep,
    authoringKind,
    goToNextStep,
    goToPreviousStep,
    isFirstStep,
    isLastStep,
    navigationTargets,
    visibleSteps,
    stagedEditorOpen
  } = useAuthoringForm()
  const currentHref = useLocation({ select: (location) => location.href })
  const destinations =
    authoringKind === 'character-builder' ? visibleSteps : (navigationTargets ?? [])
  const activeId =
    authoringKind === 'character-builder' ? activeStep?.id : activeNavigationTarget?.id
  const activeIndex = destinations.findIndex((entry) => entry.id === activeId)
  const previousStepId = activeIndex > 0 ? destinations[activeIndex - 1]?.id : undefined
  const nextStepId = activeIndex >= 0 ? destinations[activeIndex + 1]?.id : undefined
  const previousHref = previousStepId
    ? getAuthoringStepHref(currentHref, previousStepId)
    : undefined
  const nextHref = nextStepId ? getAuthoringStepHref(currentHref, nextStepId) : undefined
  const handlePrevious = (event: MouseEvent<HTMLElement>) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    event.stopPropagation()
    void goToPreviousStep()
  }
  const handleNext = (event: MouseEvent<HTMLElement>) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    event.stopPropagation()
    void goToNextStep()
  }
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
            {previousHref && !isFirstStep && !stagedEditorOpen ? (
              <ActionIcon
                component='a'
                href={previousHref}
                aria-label='Back'
                className={styles.secondaryButton}
                onClick={handlePrevious}
                variant='transparent'
              >
                <ArrowLeft aria-hidden='true' className={styles.icon} />
                <span className={styles.buttonLabel}>Back</span>
              </ActionIcon>
            ) : (
              <ActionIcon
                aria-label='Back'
                className={styles.secondaryButton}
                disabled
                type='button'
                variant='transparent'
              >
                <ArrowLeft aria-hidden='true' className={styles.icon} />
                <span className={styles.buttonLabel}>Back</span>
              </ActionIcon>
            )}
          </Tooltip>
        </div>
        <div className={styles.end}>
          <Tooltip label='Next'>
            {nextHref && !isLastStep && !stagedEditorOpen ? (
              <ActionIcon
                component='a'
                href={nextHref}
                aria-label='Next'
                className={styles.primaryButton}
                onClick={handleNext}
                variant='transparent'
              >
                <span className={styles.buttonLabel}>Next</span>
                <ArrowRight aria-hidden='true' className={styles.icon} />
              </ActionIcon>
            ) : (
              <ActionIcon
                aria-label='Next'
                className={styles.primaryButton}
                disabled
                type='button'
                variant='transparent'
              >
                <span className={styles.buttonLabel}>Next</span>
                <ArrowRight aria-hidden='true' className={styles.icon} />
              </ActionIcon>
            )}
          </Tooltip>
        </div>
      </div>
    </footer>
  )
}
