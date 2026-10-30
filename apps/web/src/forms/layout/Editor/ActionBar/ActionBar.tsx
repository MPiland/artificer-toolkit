import clsx from 'clsx'
import * as styles from './ActionBar.css'
import { ActionIcon, Tooltip } from '@mantine/core'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { MouseEvent } from 'react'
import { useLocation } from '@tanstack/react-router'
import {
  useAuthoringActions,
  useAuthoringNavigation,
  useAuthoringSession,
  useAuthoringStagedEditor
} from '../../AuthoringFormContext'
import { useAuthoringFormStatus } from '../../useAuthoringFormStatus'
import { getAuthoringStepHref } from '../../authoringSearch'

type ActionBarProps = {
  className?: string
  padding?: 'flush' | 'padded'
  surface?: 'canvas' | 'header'
}

export function ActionBar({ className, padding = 'flush', surface = 'canvas' }: ActionBarProps) {
  const { activateLabel, domain, isHostedForm, readOnly } = useAuthoringSession()
  const { activate } = useAuthoringActions()
  const {
    activeNavigationTarget,
    activeStep,
    goToNextStep,
    goToPreviousStep,
    isFirstStep,
    isLastStep,
    navigationTargets,
    visibleSteps
  } = useAuthoringNavigation()
  const { canFinalize, isSubmitting } = useAuthoringFormStatus()
  const stagedEditorOpen = Boolean(useAuthoringStagedEditor().groupEditor)
  const currentHref = useLocation({ select: (location) => location.href })
  const destinations = isHostedForm ? visibleSteps : (navigationTargets ?? [])
  const activeId = isHostedForm ? activeStep?.id : activeNavigationTarget?.id
  // A registered authored form activates from its last step; a hosted form only advances.
  const activatesHere = Boolean(domain) && isLastStep
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
          <Tooltip label={activatesHere ? activateLabel : 'Next'}>
            {activatesHere ? (
              <ActionIcon
                aria-label={activateLabel}
                className={styles.primaryButton}
                disabled={readOnly || !canFinalize || stagedEditorOpen}
                loading={isSubmitting}
                onClick={() => void activate()}
                type='button'
                variant='transparent'
              >
                <span className={styles.buttonLabel}>{activateLabel}</span>
              </ActionIcon>
            ) : nextHref && !isLastStep && !stagedEditorOpen ? (
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
