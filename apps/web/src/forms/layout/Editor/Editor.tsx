import { Alert, Button } from '@mantine/core'
import { useAuthoringForm } from '../AuthoringFormContext'
import { ActionBar } from './ActionBar/ActionBar'
import * as styles from './Editor.css'
import type { ReactNode } from 'react'

export function Editor({ children }: { children: ReactNode }) {
  const { subjectKindLabel, readOnly, canCopy, copyLabel, copy } = useAuthoringForm()

  return (
    <section id='authoring-form' className={styles.canvas}>
      <div className={styles.content}>
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
      <ActionBar className={styles.actionBarSlot} padding='padded' />
    </section>
  )
}
