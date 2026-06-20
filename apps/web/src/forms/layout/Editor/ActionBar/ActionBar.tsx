import clsx from 'clsx'
import * as styles from './ActionBar.css'
import { Button } from '@mantine/core'
import { useAuthoringForm } from '../../AuthoringFormContext'

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
    canSubmit,
    goToNextStep,
    goToPreviousStep,
    isFirstStep,
    isLastStep,
    isSubmitting,
    readOnly
  } = useAuthoringForm()

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
                disabled={!canSubmit}
                loading={isSubmitting}
                onClick={() => void activate()}
              >
                {activateLabel}
              </Button>
            )
          ) : (
            <Button type='button' onClick={() => void goToNextStep()}>
              Next
            </Button>
          )}
        </div>
      </div>
    </footer>
  )
}
