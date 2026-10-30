import { Alert, Button } from '@mantine/core'
import { useAuthoringActions, useAuthoringSession } from '../AuthoringFormContext'
import { ActionBar } from './ActionBar/ActionBar'
import { Header } from '../Header/Header'
import * as styles from './Editor.css'
import type { ReactNode } from 'react'

export function Editor({
  children,
  showActivate = true,
  showStepNavigation = true,
  title
}: {
  children: ReactNode
  showActivate?: boolean
  showStepNavigation?: boolean
  title?: ReactNode
}) {
  const { canCopy, copyLabel, readOnly, subjectKindLabel } = useAuthoringSession()
  const { copy } = useAuthoringActions()

  return (
    <section id='authoring-form' className={styles.canvas}>
      <Header showActivate={showActivate} showStepsNavigation={showStepNavigation} title={title} />
      <div
        className={styles.content}
        data-step-navigation={showStepNavigation ? 'true' : 'false'}
        data-testid='authoring-form-content'
      >
        <div className={styles.stage} data-fill-stage={showStepNavigation ? undefined : 'true'}>
          {readOnly ? (
            <Alert className={styles.alertSlot} color='orange'>
              {`This ${subjectKindLabel.toLowerCase()} is locked for direct editing. Duplicate it to make your own draft.`}
              {canCopy ? (
                <Button mt='sm' type='button' variant='filled' onClick={() => void copy()}>
                  {copyLabel}
                </Button>
              ) : null}
            </Alert>
          ) : null}
          {children}
        </div>
      </div>
      {showStepNavigation ? <ActionBar className={styles.actionBarSlot} padding='padded' /> : null}
    </section>
  )
}
